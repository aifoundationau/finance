// Runs one report from the command line (for Windows Task Scheduler, cron, or a quick check).
//   node scripts/run-report.js            standard report
//   node scripts/run-report.js --ai       standard + AI analyst report (needs ANTHROPIC_API_KEY)
//   add --print to echo the Markdown version of the newest report
import { runPipeline } from "../src/pipeline.js";
import { loadSettings } from "../src/settings.js";
import { saveReport } from "../src/store.js";
import { reportToMarkdown } from "../src/lib/markdown.js";

const mode = process.argv.includes("--ai") ? "ai" : "standard";
let lastLabel = "";

try {
  const reports = await runPipeline({
    mode,
    settings: await loadSettings(),
    onProgress: ({ label, pct }) => {
      if (label === lastLabel) return;
      lastLabel = label;
      console.log(`[${String(pct).padStart(3)}%] ${label}`);
    },
  });
  for (const r of reports) {
    await saveReport(r);
    console.log(`Saved ${r.id}: ${r.confirmed.length} confirmed, ${r.upcoming.length} upcoming (${(r.durationMs / 1000).toFixed(1)}s)`);
    for (const s of r.sources.filter((x) => x.status === "error" || x.status === "partial")) {
      console.log(`  ! ${s.label}: ${s.status}${s.error ? ` (${s.error})` : ""}`);
    }
  }
  if (process.argv.includes("--print")) console.log(`\n${reportToMarkdown(reports.at(-1))}`);
} catch (err) {
  console.error(`Report failed: ${err.message}`);
  process.exitCode = 1;
}
