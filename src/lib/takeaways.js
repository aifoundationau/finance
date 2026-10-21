import { tickerLabel } from "./entities.js";
import { formatMoney, truncate } from "./text.js";
import { shortDate } from "./dates.js";

const asxCompanies = (item) => item.companies.filter((c) => c.listing === "ASX");
const aud = (item) => (item.value?.currency === "AUD" ? item.value.amount : 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const who = (c) => `${c.display} (${tickerLabel(c)})`;

/** Three rule-based strategic takeaways (standard mode; AI mode writes its own). */
export function buildTakeaways({ confirmed, upcoming, market = {} }) {
  if (!confirmed.length && !upcoming.length) return [];

  const asxConfirmed = confirmed.filter((i) => asxCompanies(i).length);
  const asxCodes = [...new Set(asxConfirmed.flatMap((i) => asxCompanies(i).map((c) => c.code)))];
  const asxValue = asxConfirmed.reduce((sum, i) => sum + aud(i), 0);
  const biggestAsx = [...asxConfirmed].sort((a, b) => aud(b) - aud(a))[0];
  const biggest = [...confirmed].sort((a, b) => aud(b) - aud(a))[0];

  let first;
  if (biggestAsx && aud(biggestAsx) > 0) {
    first =
      `Largest ASX-linked award: ${who(asxCompanies(biggestAsx)[0])}, ${formatMoney(aud(biggestAsx))} with ${biggestAsx.agency ?? "government"} (${biggestAsx.date}). ` +
      `${plural(asxCodes.length, "ASX-listed company", "ASX-listed companies")} linked to ${plural(asxConfirmed.length, "confirmed government contract")} worth ${formatMoney(asxValue)} disclosed over the past 7 days.`;
  } else if (biggest) {
    const lead = biggest.companies[0];
    first = `No valued ASX-linked awards this week; the largest confirmed award went to ${lead ? who(lead) : "an unnamed supplier"} (${biggest.value?.text ?? "value undisclosed"}, ${biggest.agency ?? "government"}).`;
  } else {
    first = "No confirmed government contract awards were found in the past 7 days; activity this week is forward-looking only.";
  }

  const bySector = {};
  for (const i of confirmed) {
    const s = (bySector[i.sector] ??= { count: 0, value: 0 });
    s.count += 1;
    s.value += aud(i);
  }
  const ranked = Object.entries(bySector).sort((a, b) => b[1].count - a[1].count || b[1].value - a[1].value);
  const [top, second] = ranked;
  let sectors = top
    ? `${top[0]} saw the heaviest procurement activity (${plural(top[1].count, "confirmed item")}${top[1].value ? `, ${formatMoney(top[1].value)}` : ""})`
    : "Confirmed procurement activity was light";
  if (second) sectors += `, ahead of ${second[0]} (${second[1].count})`;
  sectors += ".";
  const pipeline = upcoming.filter((i) => i.stage !== "tender-closing");
  const closing = upcoming.filter((i) => i.stage === "tender-closing");
  if (pipeline.length) {
    const weight = (i) => (asxCompanies(i).length ? 100 : 0) + ["low", "medium", "high"].indexOf(i.confidence) * 10 + i.sources.length;
    const lead = [...pipeline].sort((a, b) => weight(b) - weight(a))[0];
    sectors += ` Pipeline: ${plural(pipeline.length, "forward-looking item")}, led by "${truncate(lead.title, 90)}"`;
    sectors += closing.length ? `, plus ${plural(closing.length, "AusTender tender")} closing by ${shortDate(closing.at(-1).window.to)}.` : ".";
  } else if (closing.length) {
    sectors += ` ${plural(closing.length, "AusTender tender")} close in the next 7 days.`;
  }

  const codes = [...new Set([...confirmed, ...upcoming].flatMap((i) => asxCompanies(i).map((c) => c.code)))];
  const quotes = codes.map((code) => market[code]).filter((m) => m && Number.isFinite(m.changePct));
  const moves = [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const fmt = (m) => `${m.code} ${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(1)}%`;
  let reaction;
  if (moves.length) {
    const notable = moves.filter((m) => Math.abs(m.changePct) >= 2).slice(0, 4);
    reaction = notable.length
      ? `Notable latest-session moves among contract-linked tickers: ${notable.map(fmt).join(", ")}`
      : `No outsized latest-session moves among contract-linked tickers (largest: ${moves.slice(0, 3).map(fmt).join(", ")})`;
    reaction += "; moves may reflect broader market factors, not only the contract news.";
  } else if (codes.some((code) => Number.isFinite(market[code]?.price))) {
    reaction = "No trades yet in the current ASX session for contract-linked tickers, so there is no price reaction to report.";
  } else {
    reaction = "No ASX price data was available for the tickers in this report.";
  }
  const withOptions = codes.filter((code) => market[code]?.options?.available);
  if (withOptions.length) {
    reaction += ` Exchange-traded options are listed on ${withOptions.slice(0, 6).join(", ")}${withOptions.length > 6 ? ` and ${withOptions.length - 6} more` : ""}.`;
  }

  return [first, sectors, reaction];
}
