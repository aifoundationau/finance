import { tickerLabel } from "./entities.js";
import { STAGE_LABELS } from "./classify.js";
import { toCsv } from "./csv.js";

const LOCKED = "Locked (unlock with a token in the app)";

export const NO_FINDINGS ="No major government commercial agreements or credible forward speculation reported within the 14-day window.";

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim() || "—";
const link = (s) => (s?.url ? `[${cell(s.title).replace(/[[\]]/g, "")}](${s.url.replace(/\)/g, "%29")})` : cell(s?.title));
const companyNames = (item, empty = "Not named") => (item.companies.length ? item.companies.map((c) => c.display).join("; ") : empty);
const tickers = (item) => (item.companies.length ? [...new Set(item.companies.map(tickerLabel))].join("; ") : "—");

/** The report in the exact three-section Markdown layout of the analyst brief. */
export function reportToMarkdown(report) {
  const generated = new Date(report.generatedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
  const lines = [
    `# Government Contract Intelligence: ${report.date}`,
    "",
    `_Confirmed window ${report.window.pastFrom} to ${report.window.pastTo}; forward window to ${report.window.forwardTo}. Generated ${generated} (Sydney time). Mode: ${report.mode === "ai" ? "AI analyst" : "Standard"}._`,
    "",
  ];
  if (!report.confirmed.length && !report.upcoming.length) {
    lines.push(NO_FINDINGS);
    return lines.join("\n");
  }

  lines.push(
    "#### Section 1: Confirmed Contracts (Past 7 Days)",
    "| Date Signed / Reported | Company Name | ASX / Ticker Code | Government Agency / Department | Contract Value / Scope | Source Headline & Link |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
  );
  for (const i of report.confirmed) {
    const valueScope = i.locked ? LOCKED : [i.value?.text, i.scope].filter(Boolean).join(": ");
    const source = i.locked ? LOCKED : i.sources.slice(0, 2).map(link).join("<br>");
    lines.push(`| ${i.date} | ${cell(companyNames(i))} | ${cell(tickers(i))} | ${cell(i.agency)} | ${cell(valueScope)} | ${source} |`);
  }
  if (!report.confirmed.length) lines.push("| — | No confirmed contracts in the window | — | — | — | — |");

  lines.push(
    "",
    "#### Section 2: Upcoming Contracts & Speculation (Next 7 Days Ahead)",
    "| Target Decision Date / Window | Prospective Vendor(s) | ASX / Ticker Code | Procuring Body | Project / Opportunity Details | Speculation / Pipeline Context |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
  );
  for (const i of report.upcoming) {
    const vendors = companyNames(i, i.stage === "tender-closing" ? "Open tender (no vendor named)" : "Not named");
    const details = i.locked ? LOCKED : i.title + (i.value ? ` (${i.value.text})` : "");
    const context = i.locked ? `${STAGE_LABELS[i.stage] ?? ""}; source ${LOCKED.toLowerCase()}` : `${i.context ?? STAGE_LABELS[i.stage] ?? ""} ${i.sources[0] ? link(i.sources[0]) : ""}`;
    lines.push(`| ${cell(i.window?.label)} | ${cell(vendors)} | ${cell(tickers(i))} | ${cell(i.agency)} | ${cell(details)} | ${cell(context)} |`);
  }
  if (!report.upcoming.length) lines.push("| — | No forward-looking items in the window | — | — | — | — |");

  lines.push("", "#### Section 3: Strategic Key Takeaways");
  for (const t of report.takeaways) lines.push(`- ${t}`);
  return lines.join("\n");
}

export function reportToCsv(report) {
  const rows = [["Section", "Date / Window", "Company", "Ticker", "Agency", "Jurisdiction", "Value (AUD)", "Value", "Scope / Details", "Sector", "Stage", "Confidence", "Primary source", "Source URL"]];
  for (const [section, list] of [["Confirmed", report.confirmed], ["Upcoming", report.upcoming]]) {
    for (const i of list) {
      rows.push([
        section,
        section === "Upcoming" ? i.window?.label : i.date,
        companyNames(i, ""),
        tickers(i),
        i.agency ?? "",
        i.jurisdiction ?? "",
        i.value?.currency === "AUD" ? i.value.amount : "",
        i.locked ? "Locked" : i.value?.text ?? "",
        i.locked ? "Locked" : i.scope ?? i.title,
        i.sector,
        STAGE_LABELS[i.stage] ?? i.stage ?? "",
        i.confidence ?? "",
        i.sources[0]?.title ?? "",
        i.sources[0]?.url ?? "",
      ]);
    }
  }
  return toCsv(rows);
}
