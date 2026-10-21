import { assertValid } from "../shared/json-schema.js";
import { REPORT } from "../shared/schemas.js";
import { storage } from "./storage.js";

const ID_RE = /^\d{4}-\d{2}-\d{2}-(?:standard|ai)$/;
export const isReportId = (id) => ID_RE.test(String(id));

// id -> { version, summary }, so listing reports does not re-read unchanged ones.
const summaryCache = new Map();

const summarize = (r) => ({
  id: r.id,
  date: r.date,
  mode: r.mode,
  generatedAt: r.generatedAt,
  counts: { confirmed: r.confirmed.length, upcoming: r.upcoming.length, other: r.other?.length ?? 0 },
});

export async function saveReport(report) {
  if (!isReportId(report.id)) throw new Error(`Invalid report id: ${report.id}`);
  assertValid(REPORT, report); // never persist a report that breaks its contract
  await storage().put("reports", report.id, report, summarize(report));
}

export async function loadReport(id) {
  if (!isReportId(id)) return null;
  try {
    return await storage().get("reports", id);
  } catch {
    return null;
  }
}

/** Report summaries, newest date first; an AI report sorts ahead of the standard one for the same day. */
export async function listReports() {
  const docs = (await storage().list("reports")).filter((d) => isReportId(d.id));
  const summaries = await Promise.all(
    docs.map(async ({ id, meta, version }) => {
      if (meta) return meta;
      const hit = summaryCache.get(id);
      if (hit?.version === version) return hit.summary;
      const report = await loadReport(id);
      if (!report) return null;
      const summary = summarize(report);
      summaryCache.set(id, { version, summary });
      return summary;
    }),
  );
  return summaries.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || (a.mode === "ai" ? -1 : b.mode === "ai" ? 1 : 0));
}

export async function latestReport() {
  const [first] = await listReports();
  return first ? loadReport(first.id) : null;
}
