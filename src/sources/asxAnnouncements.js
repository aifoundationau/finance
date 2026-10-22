import { fetchJson } from "../lib/http.js";
import { squash } from "../lib/text.js";

// The market-wide announcements feed and document endpoint used by asx.com.au.
const LIST_URL = "https://asx.api.markitdigital.com/asx-research/1.0/markets/announcements";
const FILE_URL = "https://cdn-api.markitdigital.com/apiman-gateway/ASX/asx-research/1.0/file";
const TOKEN = "83ff96335c2d45a094df02a206a39ff4";

export const announcementPdfUrl = (documentKey) => `${FILE_URL}/${encodeURIComponent(documentKey)}?access_token=${TOKEN}`;

/** All announcements released since `since`, newest first. */
export async function fetchAnnouncements({ since, maxPages = 12, pageSize = 500, onPage } = {}) {
  const byKey = new Map();
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchJson(`${LIST_URL}?itemsPerPage=${pageSize}&page=${page}`, { timeout: 30_000 });
    const items = data?.data?.items ?? [];
    for (const a of items) {
      if (a.documentKey && Date.parse(a.date) >= since.getTime()) byKey.set(a.documentKey, a);
    }
    onPage?.(page + 1, byKey.size);
    if (!items.length || Date.parse(items.at(-1).date) < since.getTime()) break;
  }
  return [...byKey.values()].map((a) => ({
    key: a.documentKey,
    code: a.symbol,
    company: a.companyInfo?.[0]?.displayName ?? a.symbol,
    date: a.date,
    headline: squash(a.headline ?? ""),
    priceSensitive: Boolean(a.isPriceSensitive),
    types: a.announcementTypes ?? [],
    url: announcementPdfUrl(a.documentKey),
  }));
}

export const CONTRACT_NOUN_RE =
  /\b(?:contracts?|orders?|purchase orders?|tenders?|agreements?|panel|framework|deed|supply|award(?:s|ed)?|deals?|engagement|mandate|standing offer|extension|renewal|partnership)\b/i;
const WIN_VERB_RE = /\b(?:secures?|secured|wins?|won|awarded|lands?|signs?|signed|executes?|executed|selected|preferred|appointed)\b/i;
const MONEY_RE = /\$\s?\d/;
const HEADLINE_EXCLUDE_RE =
  /\b(?:appendix|proxy|(?:annual )?general meeting|AGM|buy-?back|director'?s? interest|substantial (?:holder|holding)|cleansing|placement|entitlement offer|share purchase plan|SPP|capital raising|notes offering|unsecured notes|convertible notes|quotation of securities|issue of (?:shares|securities|options)|trading halt|suspension|reinstatement|dividend|distribution|net tangible|top 20|results of meeting|annual report|quarterly|half[- ]year|investor presentation|webinar|letter to shareholders|chair'?s address|exclusivity|takeovers? panel|takeover|scheme implementation|scheme booklet|bidder'?s statement|target'?s statement|offer period|merger|demerger|board succession|succession|termination|terminates?|update on)\b/i;

const ROUTINE_TYPE_RE =
  /^(?:Proxy Form|Notice of (?:Annual General )?Meeting|Daily Share Buy-Back Notice|(?:Change of|Initial|Final) Director's Interest Notice|Appendix|(?:Change in|Becoming a|Ceasing to be a) substantial hold|Cleansing Notice|Results of Meeting|Top 20 shareholders|Dividend|Net Tangible Asset Backing|Annual Report|Full Year|Half Year|(?:First|Second|Third|Fourth) Quarter|Letter to Shareholders|Chair's Address|Web Cast|Issued Capital|Corporate Governance|Commitments Test Entity|Director Appointment)/i;

/** Announcements whose headline looks like a contract event (worth opening the PDF). */
export function contractCandidates(list) {
  return list.filter(
    (a) =>
      (CONTRACT_NOUN_RE.test(a.headline) || (WIN_VERB_RE.test(a.headline) && MONEY_RE.test(a.headline))) &&
      !HEADLINE_EXCLUDE_RE.test(a.headline) &&
      !(a.types.length && a.types.every((t) => ROUTINE_TYPE_RE.test(t))),
  );
}
