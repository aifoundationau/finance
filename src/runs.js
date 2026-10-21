// Report runs: one at a time, with progress that every server instance can read. Status is the
// "runtime/run" document in storage.js (process memory locally, Firestore when deployed).
import { runPipeline } from "./pipeline.js";
import { loadSettings } from "./settings.js";
import { saveReport } from "./store.js";
import { storage } from "./storage.js";

// A run normally takes under a minute; one "running" for longer than this died with its
// instance (for example a timeout) and no longer blocks new runs.
const STALE_MS = 6 * 60_000;
const PROGRESS_WRITE_MS = 1_000;

export const IDLE_RUN = { running: false, mode: null, trigger: null, startedAt: null, finishedAt: null, label: "", pct: 0, error: null, log: [], lastReportId: null };

const isStale = (run) => run.running && Date.now() - Date.parse(run.startedAt) > STALE_MS;

export async function getRun() {
  const run = { ...IDLE_RUN, ...((await storage().get("runtime", "run")) ?? {}) };
  if (isStale(run)) return { ...run, running: false, error: run.error ?? "The run stopped before finishing (timed out).", label: "Run failed" };
  return run;
}

/**
 * Claims the run lock and starts the pipeline. Returns { started: false } when a run is already
 * going, otherwise { started: true, done } where `done` settles when the reports are saved.
 */
export async function startRun(mode, trigger, { log = () => {} } = {}) {
  const startedAt = new Date().toISOString();
  const claimed = await storage().transact("runtime", "run", async (saved) => {
    const current = { ...IDLE_RUN, ...(saved ?? {}) };
    if (current.running && !isStale(current)) return { value: undefined, result: false };
    return { value: { ...current, running: true, mode, trigger, startedAt, finishedAt: null, label: "Starting", pct: 1, error: null, log: [] }, result: true };
  });
  if (!claimed) return { started: false };

  // Progress is written at most once a second; the final state is always written.
  const progress = { label: "Starting", pct: 1, log: [] };
  let lastWrite = 0;
  let writing = Promise.resolve();
  const write = (patch) => {
    writing = writing
      .then(() => storage().transact("runtime", "run", async (saved) => {
        // Only touch the run this call started (a stale lock may have been taken over).
        if (saved?.startedAt !== startedAt) return { value: undefined, result: null };
        return { value: { ...saved, ...patch }, result: null };
      }))
      .catch((err) => log("warn", "run.status_write_failed", { message: err.message }));
    return writing;
  };
  const onProgress = ({ label, pct }) => {
    progress.label = label;
    progress.pct = Math.max(progress.pct, pct);
    if (progress.log.at(-1) !== label) progress.log.push(label);
    if (progress.log.length > 40) progress.log.shift();
    if (Date.now() - lastWrite < PROGRESS_WRITE_MS) return;
    lastWrite = Date.now();
    write({ label: progress.label, pct: progress.pct, log: [...progress.log] });
  };

  const done = (async () => {
    try {
      const reports = await runPipeline({ mode, settings: await loadSettings(), onProgress });
      for (const r of reports) await saveReport(r);
      await write({ running: false, finishedAt: new Date().toISOString(), label: "Report ready", pct: 100, log: progress.log, lastReportId: reports.at(-1).id });
      log("info", "run.completed", { trigger, mode, reports: reports.map((r) => r.id) });
      return reports;
    } catch (err) {
      await write({ running: false, finishedAt: new Date().toISOString(), label: "Run failed", error: err.message, log: progress.log });
      log("error", "run.failed", { trigger, mode, code: err.code ?? "RUN_FAILED", message: err.message, fields: err.fields?.slice(0, 5) });
      return null;
    }
  })();
  return { started: true, done };
}
