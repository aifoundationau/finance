import { assertValid } from "../public/shared/json-schema.js";
import { REPORT } from "../public/shared/schemas.js";
import { storage } from "./storage.js";
import { isNamed, isSpeculative } from "./lib/classify.js";

const ID_RE = /^\d{4}-\d{2}-\d{2}-(?:standard|ai)$/;
export const isReportId = (id) => ID_RE.test(String(id));

// id -> { version, summary }, so listing reports does not re-read unchanged ones.
const summaryCache = new Map();

const hasNamed = (i) => i.companies && i.companies.length > 0 && i.companies.some((c) => isNamed(c.name || c.display));
const notSpec = (i) => i.stage !== "speculation" && !isSpeculative(`${i.title || ""} ${i.scope || ""} ${i.context || ""}`);

const summarize = (r) => ({
  id: r.id,
  date: r.date,
  mode: r.mode,
  generatedAt: r.generatedAt,
  counts: {
    confirmed: (r.confirmed ?? []).filter((i) => hasNamed(i) && notSpec(i)).length,
    upcoming: (r.upcoming ?? []).filter((i) => hasNamed(i) && notSpec(i)).length,
    other: r.other?.length ?? 0,
  },
});

export async function saveReport(report) {
  if (!isReportId(report.id)) throw new Error(`Invalid report id: ${report.id}`);
  assertValid(REPORT, report); // never persist a report that breaks its contract
  await storage().put("reports", report.id, report, summarize(report));
}

export async function loadReport(id) {
  if (!isReportId(id)) return null;
  try {
    const r = await storage().get("reports", id);
    if (!r) return null;
    r.confirmed = (r.confirmed ?? []).filter((i) => hasNamed(i) && notSpec(i));
    r.upcoming = (r.upcoming ?? []).filter((i) => hasNamed(i) && notSpec(i));
    return r;
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
