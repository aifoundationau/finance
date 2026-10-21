import { fetchText } from "../lib/http.js";
import { cleanText } from "../lib/text.js";
import { monthNumber, zonedToUtc } from "../lib/dates.js";

// AusTender approaches to market (open tenders), listed soonest-closing first.
// tenders.gov.au rejects non-browser clients, so this opt-in source sends a browser User-Agent.
const BASE = "https://www.tenders.gov.au";

function parseCanberraTime(s) {
  const m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  const hour = (Number(m[4]) % 12) + (m[6].toLowerCase() === "pm" ? 12 : 0);
  return zonedToUtc(Number(m[3]), monthNumber(m[2]), Number(m[1]), hour, Number(m[5])).toISOString();
}

export function parseAtmList(html) {
  return html
    .split(/<div class="row">\s*<div class="col-sm-4">/)
    .slice(1)
    .map((block) => {
      const field = (label) =>
        cleanText(block.match(new RegExp(`<span>${label}:?</span>\\s*<div class="list-desc-inner">([\\s\\S]*?)</div>`, "i"))?.[1] ?? "");
      const link = block.match(/href="(\/Atm\/Show\/[0-9a-f-]{36})"[^>]*>([^<]+)<\/a>/i);
      const closesText = field("Close Date &amp; Time").replace(/\(ACT Local Time\)/i, "").trim();
      return {
        title: cleanText(block.match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""),
        atmId: link ? cleanText(link[2]) : "",
        url: link ? `${BASE}${link[1]}` : `${BASE}/atm`,
        agency: field("Agency"),
        category: field("Category"),
        description: field("Description"),
        closes: parseCanberraTime(closesText),
        closesText,
      };
    })
    .filter((e) => e.title && e.atmId);
}

/** Open Commonwealth tenders closing between now and `until`. */
export async function fetchClosingTenders({ until, maxPages = 4 } = {}) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const html = await fetchText(page === 1 ? `${BASE}/atm` : `${BASE}/atm?page=${page}`, { browser: true, timeout: 25_000 });
    const entries = parseAtmList(html);
    if (!entries.length) break;
    out.push(...entries);
    if (Date.parse(entries.at(-1).closes ?? 0) > until.getTime()) break;
  }
  const now = Date.now();
  return out.filter((e) => e.closes && Date.parse(e.closes) >= now && Date.parse(e.closes) <= until.getTime());
}
