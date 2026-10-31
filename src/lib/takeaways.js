import { tickerLabel } from "./entities.js";
import { formatMoney, truncate } from "./text.js";
import { shortDate } from "./dates.js";

const asxCompanies = (item) => item.companies.filter((c) => c.listing === "ASX");
const allListedCompanies = (item) => item.companies.filter((c) => c.listing === "ASX" || c.listing === "Overseas");
const aud = (item) => (item.value?.currency === "AUD" ? item.value.amount : 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const who = (c) => `${c.display} (${tickerLabel(c)})`;

/** Comprehensive rule-based strategic takeaways across 6 intelligence dimensions. */
export function buildTakeaways({ confirmed, upcoming, market = {} }) {
  if (!confirmed.length && !upcoming.length) return [];

  const asxConfirmed = confirmed.filter((i) => asxCompanies(i).length);
  const asxCodes = [...new Set(asxConfirmed.flatMap((i) => asxCompanies(i).map((c) => c.code)))];
  const asxValue = asxConfirmed.reduce((sum, i) => sum + aud(i), 0);
  const biggestAsx = [...asxConfirmed].sort((a, b) => aud(b) - aud(a))[0];
  const biggest = [...confirmed].sort((a, b) => aud(b) - aud(a))[0];

  // 1. Capital Allocation & Top Awards
  let first;
  if (biggestAsx && aud(biggestAsx) > 0) {
    first =
      `Capital Allocation: Largest ASX-linked award went to ${who(asxCompanies(biggestAsx)[0])}, ${formatMoney(aud(biggestAsx))} with ${biggestAsx.agency ?? "government"} (${biggestAsx.date}). ` +
      `${plural(asxCodes.length, "ASX-listed company", "ASX-listed companies")} linked to ${plural(asxConfirmed.length, "confirmed government contract")} worth ${formatMoney(asxValue)} disclosed over the past 7 days.`;
  } else if (biggest) {
    const lead = biggest.companies[0];
    first = `Capital Allocation: No valued ASX-linked awards this week; the largest confirmed award went to ${lead ? who(lead) : "an unnamed supplier"} (${biggest.value?.text ?? "value undisclosed"}, ${biggest.agency ?? "government"}).`;
  } else {
    first = "Capital Allocation: No confirmed government contract awards were found in the past 7 days; activity this week is forward-looking only.";
  }

  // 2. All-Government Jurisdiction Analysis
  const byJur = {};
  for (const i of [...confirmed, ...upcoming]) {
    const j = i.jurisdiction || "Federal";
    byJur[j] = (byJur[j] || 0) + 1;
  }
  const jurList = Object.entries(byJur).sort((a, b) => b[1] - a[1]);
  let jurisdictions;
  if (jurList.length) {
    const stateItems = jurList.filter(([j]) => j !== "Federal");
    const fedCount = byJur["Federal"] || 0;
    const topStates = stateItems.slice(0, 3).map(([j, c]) => `${j} (${plural(c, "item")})`).join(", ");
    jurisdictions = `All Governments: Federal Commonwealth agencies accounted for ${plural(fedCount, "procurement item")}`;
    if (stateItems.length) {
      jurisdictions += `, alongside active State & Territory procurement across ${stateItems.length} jurisdictions: ${topStates}.`;
    } else {
      jurisdictions += "; no state-level procurement activity was detected in this cycle.";
    }
  } else {
    jurisdictions = "All Governments: Procurement spans Federal and State government sources.";
  }

  // 3. Sector Dominance & Capabilities
  const bySector = {};
  for (const i of confirmed) {
    const s = (bySector[i.sector] ??= { count: 0, value: 0 });
    s.count += 1;
    s.value += aud(i);
  }
  const ranked = Object.entries(bySector).sort((a, b) => b[1].count - a[1].count || b[1].value - a[1].value);
  const [top, second] = ranked;
  let sectors = top
    ? `Sector Dynamics: ${top[0]} saw the heaviest procurement activity (${plural(top[1].count, "confirmed item")}${top[1].value ? `, ${formatMoney(top[1].value)}` : ""})`
    : "Sector Dynamics: Confirmed procurement activity was light across all major sectors";
  if (second) sectors += `, followed by ${second[0]} (${second[1].count})`;
  sectors += ".";

  // 4. Forward Pipeline & AusTender Horizons
  const pipeline = upcoming.filter((i) => i.stage !== "tender-closing");
  const closing = upcoming.filter((i) => i.stage === "tender-closing");
  let pipelineTakeaway;
  if (pipeline.length) {
    const weight = (i) => (asxCompanies(i).length ? 100 : 0) + ["low", "medium", "high"].indexOf(i.confidence) * 10 + i.sources.length;
    const lead = [...pipeline].sort((a, b) => weight(b) - weight(a))[0];
    pipelineTakeaway = `Forward Pipeline: ${plural(pipeline.length, "forward-looking opportunity or decision pending")}, led by "${truncate(lead.title, 85)}"`;
    pipelineTakeaway += closing.length ? `, with ${plural(closing.length, "AusTender & State tender")} closing by ${shortDate(closing.at(-1).window.to)}.` : ".";
  } else if (closing.length) {
    pipelineTakeaway = `Forward Pipeline: ${plural(closing.length, "AusTender & State tender")} closing in the next 7 days, representing near-term bidding catalysts.`;
  } else {
    pipelineTakeaway = "Forward Pipeline: No forward decisions or pending tenders are flagged for the upcoming 7-day window.";
  }

  // 5. Market Reaction & Price Momentum
  const codes = [...new Set([...confirmed, ...upcoming].flatMap((i) => asxCompanies(i).map((c) => c.code)))];
  const quotes = codes.map((code) => market[code]).filter((m) => m && Number.isFinite(m.changePct));
  const moves = [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const fmt = (m) => `${m.code} (${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(1)}%)`;
  let reaction;
  if (moves.length) {
    const notable = moves.filter((m) => Math.abs(m.changePct) >= 2).slice(0, 4);
    reaction = notable.length
      ? `Market Reaction: Notable latest-session moves among contract-linked tickers: ${notable.map(fmt).join(", ")}`
      : `Market Reaction: Moderate latest-session movement among contract-linked tickers (largest: ${moves.slice(0, 3).map(fmt).join(", ")})`;
    reaction += "; price fluctuations reflect both government contract awards and broader market trading.";
  } else if (codes.some((code) => Number.isFinite(market[code]?.price))) {
    reaction = "Market Reaction: Contract-linked tickers are awaiting market open or have not recorded trades in the current session.";
  } else {
    reaction = "Market Reaction: No live ASX price feed was recorded for the contract-linked tickers in this report.";
  }

  // 6. Options & Derivatives Intelligence
  const withOptions = codes.filter((code) => market[code]?.options?.available);
  let optionsTakeaway;
  if (withOptions.length) {
    optionsTakeaway = `Options Intelligence: Exchange-traded options are actively listed on ${withOptions.slice(0, 6).join(", ")}${withOptions.length > 6 ? ` and ${withOptions.length - 6} more` : ""}. These liquid derivative chains provide opportunities for volatility positioning ahead of upcoming government announcements.`;
  } else {
    optionsTakeaway = "Options Intelligence: None of the contract-linked companies in this report currently host active exchange-traded options chains on ASX.";
  }

  return [first, jurisdictions, sectors, pipelineTakeaway, reaction, optionsTakeaway];
}
