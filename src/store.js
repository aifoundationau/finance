import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { assertValid } from "../shared/json-schema.js";
import { REPORT } from "../shared/schemas.js";

const ID_RE = /^\d{4}-\d{2}-\d{2}-(?:standard|ai)$/;
export const isReportId = (id) => ID_RE.test(String(id));
const fileFor = (id) => path.join(config.reportsDir, `${id}.json`);

// id -> { mtimeMs, summary }, so listing reports does not re-parse unchanged files.
const summaryCache = new Map();

export async function saveReport(report) {
  if (!isReportId(report.id)) throw new Error(`Invalid report id: ${report.id}`);
  assertValid(REPORT, report); // never persist a report that breaks its contract
  await fs.mkdir(config.reportsDir, { recursive: true });
  const tmp = `${fileFor(report.id)}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(report));
  await fs.rename(tmp, fileFor(report.id));
}

export async function loadReport(id) {
  if (!isReportId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(fileFor(id), "utf8"));
  } catch {
    return null;
  }
}

const summarize = (r) => ({
  id: r.id,
  date: r.date,
  mode: r.mode,
  generatedAt: r.generatedAt,
  counts: { confirmed: r.confirmed.length, upcoming: r.upcoming.length, other: r.other?.length ?? 0 },
});

/** Report summaries, newest date first; an AI report sorts ahead of the standard one for the same day. */
export async function listReports() {
  let files;
  try {
    files = await fs.readdir(config.reportsDir);
  } catch {
    return [];
  }
  const ids = files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter(isReportId);
  const summaries = await Promise.all(
    ids.map(async (id) => {
      try {
        const { mtimeMs } = await fs.stat(fileFor(id));
        const hit = summaryCache.get(id);
        if (hit?.mtimeMs === mtimeMs) return hit.summary;
        const report = await loadReport(id);
        if (!report) return null;
        const summary = summarize(report);
        summaryCache.set(id, { mtimeMs, summary });
        return summary;
      } catch {
        return null;
      }
    }),
  );
  return summaries.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || (a.mode === "ai" ? -1 : b.mode === "ai" ? 1 : 0));
}

export async function latestReport() {
  const [first] = await listReports();
  return first ? loadReport(first.id) : null;
}
