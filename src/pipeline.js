import { aiConfigured } from "./config.js";
import { loadAsxDirectory } from "./sources/asxDirectory.js";
import { fetchContractNotices } from "./sources/austender.js";
import { CONTRACT_NOUN_RE, contractCandidates, fetchAnnouncements, isCommercialWin } from "./sources/asxAnnouncements.js";
import { fetchNews } from "./sources/news.js";
import { fetchClosingTenders } from "./sources/atm.js";
import { fetchMarketData } from "./sources/market.js";
import { EntityResolver, coreName, entityKey } from "./lib/entities.js";
import {
  CONTRACT_RE, FINANCING_RE, STAGE_LABELS, contractStatus, detectGov, exclusionReason, extractVendorNames,
  forwardWindow, hasForeignContext, hostOf, isAustralianContext, mentionedAsCounterparty, sectorFor,
} from "./lib/classify.js";
import { dedupe } from "./lib/dedupe.js";
import { buildTakeaways } from "./lib/takeaways.js";
import { pdfText } from "./lib/pdf.js";
import { daysAgo, daysAhead, sydneyDate } from "./lib/dates.js";
import { fetchBytes, mapLimit } from "./lib/http.js";
import { displayName, firstMoney, formatMoney, moneyValue, shortHash, truncate } from "./lib/text.js";
import { runAiAnalyst } from "./ai/analyst.js";

// AusTender "suppliers" that are themselves public bodies (inter-agency arrangements).
const PUBLIC_SUPPLIER_RE =
  /\b(?:department|dept\.?|comcover|commonwealth of australia|university|council|tafe|state of|government|authority|police|commission|bureau|office of|ombudsman|tribunal|court|shire|city of|health service|local health district)\b/i;
const DEFENCE_AGENCY_RE = /defen[cs]e|navy|army|air force|signals directorate|submarine/i;
const IT_NOTICE_RE = /\b(?:ICT|IT)\b|\b(?:software|cloud|digital|cyber\w*|data|computer|network\w*|telecom\w*|licen[cs]es?|saas|erp)\b/i;
const LEASE_RE = /\b(?:lease|leasing|rent(?:al)?|office accommodation|car ?park(?:ing)?)\b/i;
const SCOPE_RE =
  /\b(?:for the|to)\s+((?:supply|provision|delivery|design|construction|development|implementation|installation|maintenance|operation|manufacture|support|build|provide|deliver|develop|implement|install|maintain|operate)\b[^.;]{8,170})/i;
const MAX_PDFS = 60;

function extractScope(text = "") {
  for (const m of text.matchAll(new RegExp(SCOPE_RE.source, "gi"))) {
    const s = m[1].trim();
    const letters = s.replace(/[^A-Za-z]/g, "");
    // Skip matches that run through an ALL-CAPS announcement title.
    if (/^(?:[A-Z]{2,}\s+){2,}/.test(s) || (letters.length && (s.match(/[A-Z]/g) ?? []).length / letters.length > 0.5)) continue;
    return truncate(s.charAt(0).toUpperCase() + s.slice(1), 170);
  }
  return null;
}

function progressTracker(onProgress) {
  const parts = new Map();
  let label = "Starting";
  const emit = (pct) => onProgress({ label, pct });
  return {
    stage(text, pct) {
      label = text;
      emit(pct);
    },
    part(id, fraction, text) {
      parts.set(id, Math.max(parts.get(id) ?? 0, Math.min(1, fraction)));
      if (text) label = text;
      const done = [...parts.values()];
      emit(Math.round(6 + (done.reduce((a, b) => a + b, 0) / Math.max(done.length, 4)) * 74));
    },
  };
}

async function runSource(sources, { id, label, enabled }, fn) {
  if (!enabled) {
    sources.push({ id, label, status: "off", count: 0 });
    return { items: [] };
  }
  const t0 = Date.now();
  try {
    const result = await fn();
    sources.push({
      id, label, status: result.warnings?.length ? "partial" : "ok", count: result.items.length, ms: Date.now() - t0,
      detail: result.detail, warnings: result.warnings?.slice(0, 10),
    });
    return result;
  } catch (err) {
    sources.push({ id, label, status: "error", count: 0, ms: Date.now() - t0, error: err.message });
    return { items: [] };
  }
}

// ---------------------------------------------------------------- AusTender contract notices

function noticeGroupToItem({ entity, agency, notices }) {
  notices.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const sum = (list) => list.reduce((total, c) => total + (c.value ?? 0), 0);
  const original = sum(notices.filter((c) => !c.amendment));
  const amended = sum(notices.filter((c) => c.amendment));
  const total = original + amended;
  const top = notices[0];
  const descriptions = [...new Set(notices.map((c) => c.description).filter(Boolean))];
  const latest = notices.reduce((d, c) => (c.published > d ? c.published : d), top.published);
  const n = notices.length;
  const valueText = original
    ? `${formatMoney(original)}${amended ? ` + ${formatMoney(amended)} amendment` : ""}${n > 1 ? ` (${n} notices)` : ""}`
    : `+${formatMoney(amended)} amendment${n > 1 ? `s (${n})` : ""}`;
  return {
    id: `cn-${shortHash(`${entityKey(entity)}|${agency}|${notices.map((c) => c.cnId).join(",")}`)}`,
    kind: "confirmed",
    date: sydneyDate(new Date(latest)),
    title: n === 1 ? `${top.description || top.category} (${top.cnId})` : `${n} contract notices: ${truncate(descriptions.slice(0, 2).join("; "), 80)}`,
    companies: [{ ...entity, name: top.supplier.name }],
    agency,
    jurisdiction: "Federal",
    value: { amount: total, currency: "AUD", text: valueText },
    scope: `${truncate(descriptions.slice(0, 3).join("; ") + (descriptions.length > 3 ? ` +${descriptions.length - 3} more` : ""), 160)} · ${top.category}`,
    sector: DEFENCE_AGENCY_RE.test(agency) ? "Defence" : IT_NOTICE_RE.test(`${top.description} ${top.category}`) ? "Cyber/IT" : top.sector,
    status: "confirmed",
    stage: notices.every((c) => c.amendment) ? "amendment" : "contract-notice",
    sources: notices.slice(0, 6).map((c) => ({
      type: "austender",
      title: `AusTender ${c.cnId}: ${truncate(c.description || c.category, 70)} (${formatMoney(c.value ?? 0)})`,
      url: c.url,
      publisher: "AusTender",
      date: sydneyDate(new Date(c.published)),
    })),
    confidence: "high",
    details: {
      notices: notices.map((c) => ({
        cnId: c.cnId, url: c.url, value: c.value, description: c.description, category: c.category,
        start: c.start?.slice(0, 10) ?? null, end: c.end?.slice(0, 10) ?? null, method: c.method, amendment: c.amendment,
        supplier: c.supplier.name, abn: c.supplier.abn,
      })),
    },
  };
}

async function austenderItems({ since, now, resolver, settings, track }) {
  const notices = await fetchContractNotices({
    from: since, to: now,
    onPage: (page, count) => track.part("austender", Math.min(0.95, page / 14), `AusTender: ${count} contract notices`),
  });
  const t = settings.thresholds;
  const groups = new Map();
  for (const cn of notices) {
    for (const supplier of cn.suppliers) {
      if (!supplier.name || PUBLIC_SUPPLIER_RE.test(supplier.name)) continue;
      const entity = resolver.resolveName(supplier.name);
      const value = cn.value ?? 0;
      // Property leases are agreements, but only worth showing when the landlord is ASX-listed.
      if (entity.listing !== "ASX" && (LEASE_RE.test(cn.description) || String(cn.unspsc).startsWith("8013"))) continue;
      const keep =
        (entity.listing === "ASX" && value >= t.austenderAsxMin) ||
        (entity.listing === "Overseas" && value >= t.austenderOverseasMin) ||
        value >= t.austenderMajorMin;
      if (!keep) continue;
      const key = `${entityKey(entity)}|${cn.agency}`;
      const group = groups.get(key) ?? { entity, agency: cn.agency, notices: [] };
      group.notices.push({ ...cn, supplier });
      groups.set(key, group);
    }
  }
  track.part("austender", 1);
  const items = [...groups.values()].map(noticeGroupToItem);
  return { items, detail: `${notices.length} notices published in 7 days; ${items.length} supplier/agency groups kept` };
}

// ---------------------------------------------------------------- ASX announcements

export function announcementToItem(a, { resolver, settings, now }) {
  const lead = `${a.headline}. ${(a.text ?? "").slice(0, 1800)}`;
  if (exclusionReason(a.headline)) return null;
  const fromHeadline = contractStatus(a.headline);
  let { status, stage } = fromHeadline.status ? fromHeadline : contractStatus(lead);
  // A listed company announcing "Contract with X" is reporting a done deal.
  if (!status && CONTRACT_NOUN_RE.test(a.headline)) [status, stage] = ["confirmed", "awarded"];
  if (!status) return null;

  // Financing announcements only count when a government body is the counterparty up front.
  // Regulators (ASIC, TGA...) appear in filings as regulators, so they never make a customer here,
  // and a generic mention ("the Commonwealth") must sit in the sentence describing the deal.
  const financing = FINANCING_RE.test(a.headline);
  const gov = detectGov(financing ? lead.slice(0, 700) : lead, { skipRegulators: true });
  const foreign = hasForeignContext(lead);
  const local = gov?.level === "local" && !foreign;
  let govOk = false;
  if (gov && gov.level !== "local") govOk = !gov.weak || (!foreign && mentionedAsCounterparty(lead, gov.matched));
  else if (local) govOk = settings.includeLocalGovernment;
  if (!govOk && (financing || !isCommercialWin(a.headline))) return null;

  const company = resolver.byCode.get(a.code);
  const entity = company
    ? { ...resolver.fromCompany(company, "code"), name: company.name }
    : { name: a.company, display: displayName(a.company), listing: "ASX", exchange: "ASX", code: a.code, match: "code" };
  const kind = govOk ? (status === "forward" ? "upcoming" : "confirmed") : "other";
  const date = sydneyDate(new Date(a.date));
  const sectorGov = govOk ? gov : null;
  const headlineSector = sectorFor(a.headline, sectorGov);
  return {
    id: `asx-${shortHash(a.key)}`,
    kind,
    date,
    title: a.headline,
    companies: [entity],
    agency: govOk ? gov.agency : local ? "Local council" : null,
    agencyWeak: Boolean(gov?.weak),
    jurisdiction: govOk || local ? gov.jurisdiction : null,
    value: moneyValue(firstMoney(a.headline) ?? firstMoney((a.text ?? "").slice(0, 1500))),
    scope: extractScope(a.text) ?? a.headline,
    sector: headlineSector !== "Other" ? headlineSector : sectorFor(lead.slice(0, 800), sectorGov),
    status,
    stage,
    ...(kind === "upcoming"
      ? { window: forwardWindow(lead, now), context: `${STAGE_LABELS[stage]}, disclosed to the ASX${a.priceSensitive ? " (price-sensitive)" : ""}` }
      : {}),
    sources: [{ type: "asx", title: a.headline, url: a.url, publisher: `ASX announcement (${a.code})`, date }],
    confidence: !a.text ? "medium" : govOk && !gov.weak ? "high" : "medium",
    flags: a.priceSensitive ? ["price-sensitive"] : [],
    ...(kind === "other" ? { note: local ? "Local government counterparty" : "Counterparty not identified as an Australian government body" } : {}),
  };
}

async function asxItems({ since, now, resolver, settings, track }) {
  const list = await fetchAnnouncements({
    since,
    onPage: (page, count) => track.part("asx", Math.min(0.4, page / 15), `ASX: scanned ${count} announcements`),
  });
  const candidates = contractCandidates(list);
  const warnings = [];
  if (settings.sources.readAnnouncementPdfs) {
    let done = 0;
    const toRead = candidates.slice(0, MAX_PDFS);
    await mapLimit(toRead, 4, async (a) => {
      try {
        a.text = await pdfText(await fetchBytes(a.url, { timeout: 30_000, retries: 1 }));
      } catch (err) {
        warnings.push(`${a.code} "${truncate(a.headline, 50)}": PDF unreadable (${err.message})`);
      }
      track.part("asx", 0.4 + (0.6 * ++done) / toRead.length, `ASX: reading announcement ${done}/${toRead.length}`);
    });
    if (candidates.length > MAX_PDFS) warnings.push(`Read the first ${MAX_PDFS} of ${candidates.length} candidate announcements`);
  }
  track.part("asx", 1);
  const items = candidates.map((a) => announcementToItem(a, { resolver, settings, now })).filter(Boolean);
  return { items, warnings, detail: `${list.length} announcements in 7 days; ${candidates.length} contract-like; ${items.length} kept` };
}

// ---------------------------------------------------------------- News

function newsCompanies(n, text, resolver) {
  const found = resolver.findInText(text);
  const foundCores = found.map((f) => coreName(f.display));
  const subjects = extractVendorNames(n.title)
    .filter((s) => {
      const core = coreName(s);
      return core && !foundCores.some((fc) => fc === core || fc.startsWith(`${core} `) || core.startsWith(`${fc} `));
    })
    .map((s) => ({ ...resolver.resolveName(s), name: s }));
  const byKey = new Map();
  for (const c of [...found, ...subjects]) if (!byKey.has(entityKey(c))) byKey.set(entityKey(c), c);
  const companies = [...byKey.values()].filter((c) => !detectGov(c.display));
  return companies.some((c) => c.listing !== "Government-owned") ? companies.filter((c) => c.listing !== "Government-owned") : companies;
}

export function newsToItem(n, { resolver, now }) {
  const text = `${n.title}. ${n.summary}`;
  const host = hostOf(n.publisherUrl || n.link);
  if (host.startsWith("jobs.") || exclusionReason(text)) return null;
  const fromTitle = contractStatus(n.title);
  const { status, stage } = fromTitle.status ? fromTitle : contractStatus(text);
  if (!status || !CONTRACT_RE.test(text)) return null;
  const australian = isAustralianContext(text, host);
  const foreign = hasForeignContext(text);
  const gov = detectGov(text, { infer: true });
  const date = sydneyDate(new Date(n.date));

  if (!gov || gov.level === "local") {
    // An ASX company's contract news with no government counterparty still matters to holders,
    // when the headline itself reports a done deal.
    const eligible = fromTitle.status === "confirmed" && CONTRACT_NOUN_RE.test(n.title);
    const companies = eligible ? newsCompanies(n, text, resolver) : [];
    if (!companies.some((c) => c.listing === "ASX")) return null;
    return {
      id: `news-${shortHash(n.link || n.title)}`, kind: "other", date, title: n.title, companies, agency: null, jurisdiction: null,
      value: moneyValue(firstMoney(n.title, 10_000) ?? firstMoney(n.summary, 10_000)), scope: truncate(n.summary || n.title, 200),
      sector: sectorFor(text), status, stage, confidence: "low", flags: [],
      sources: [{ type: "news", title: n.title, url: n.link, publisher: n.publisher, date }],
      note: "Counterparty not identified as an Australian government body",
    };
  }
  if (!australian && gov.jurisdiction === "Unknown") return null;
  // A generic match ("Defence", "federal government") only counts in an Australian story; a
  // government inferred from a named state ("WA's ... project") is itself that context.
  if (gov.weak && (foreign || !(australian || (gov.inferred && gov.jurisdiction !== "Unknown")))) return null;

  const companies = newsCompanies(n, text, resolver);
  const value = firstMoney(n.title, 10_000) ?? firstMoney(n.summary, 10_000);
  const kind = status === "forward" ? "upcoming" : "confirmed";
  if (kind === "confirmed" && !companies.length && !(value && value.amount >= 10e6)) return null;
  return {
    id: `news-${shortHash(n.link || n.title)}`,
    kind,
    date,
    title: n.title,
    companies,
    agency: gov.agency,
    agencyWeak: Boolean(gov.weak),
    jurisdiction: gov.jurisdiction,
    value: moneyValue(value),
    scope: truncate(n.summary || n.title, 200),
    sector: sectorFor(text, gov),
    status,
    stage,
    ...(kind === "upcoming" ? { window: forwardWindow(text, now), context: `${STAGE_LABELS[stage]}, reported by ${n.publisher}` } : {}),
    sources: [{ type: "news", title: n.title, url: n.link, publisher: n.publisher, date }],
    confidence: !gov.weak && companies.length ? "medium" : "low",
    flags: [],
  };
}

async function newsItems({ since, now, resolver, track }) {
  const { items: articles, errors, queries, feeds } = await fetchNews({
    since,
    onProgress: (done, total) => track.part("news", done / total, `News: ${done}/${total} searches and feeds`),
  });
  const items = articles.map((n) => newsToItem(n, { resolver, now })).filter(Boolean);
  return { items, warnings: errors, detail: `${articles.length} articles from ${queries} searches and ${feeds} feeds; ${items.length} relevant` };
}

// ---------------------------------------------------------------- AusTender open tenders (opt-in)

async function tenderItems({ now, until, track }) {
  const tenders = await fetchClosingTenders({ until });
  track.part("atm", 1);
  const today = sydneyDate(now);
  const items = tenders.map((e) => {
    const closes = new Date(e.closes);
    const closeLabel = closes.toLocaleString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    return {
      id: `atm-${shortHash(e.atmId)}`,
      kind: "upcoming",
      date: today,
      title: e.title,
      companies: [],
      agency: e.agency,
      jurisdiction: "Federal",
      value: null,
      scope: truncate(e.description || e.title, 200),
      sector: sectorFor(`${e.title} ${e.category} ${e.description}`, detectGov(e.agency)),
      status: "forward",
      stage: "tender-closing",
      window: { label: `Closes ${closeLabel}`, from: today, to: sydneyDate(closes) },
      context: `AusTender approach to market ${e.atmId} closes ${e.closesText} (Canberra time). Open market; category: ${e.category}.`,
      sources: [{ type: "atm", title: `AusTender ${e.atmId}: ${e.title}`, url: e.url, publisher: "AusTender", date: today }],
      confidence: "high",
      flags: [],
    };
  });
  return { items, detail: `${items.length} tenders closing by ${sydneyDate(until)}` };
}

// ---------------------------------------------------------------- Report assembly

const asxCodesOf = (items) => items.flatMap((i) => i.companies.filter((c) => c.listing === "ASX").map((c) => c.code));
const audOf = (i) => (i.value?.currency === "AUD" ? i.value.amount : 0);

export function computeStats({ confirmed, upcoming, other }) {
  const bySector = {};
  const byJurisdiction = {};
  const bySource = {};
  for (const i of confirmed) {
    const s = (bySector[i.sector] ??= { count: 0, value: 0 });
    s.count += 1;
    s.value += audOf(i);
    const j = i.jurisdiction ?? "Unknown";
    byJurisdiction[j] = (byJurisdiction[j] ?? 0) + 1;
  }
  for (const i of [...confirmed, ...upcoming, ...other]) {
    for (const t of new Set(i.sources.map((s) => s.type))) bySource[t] = (bySource[t] ?? 0) + 1;
  }
  return {
    confirmed: confirmed.length,
    upcoming: upcoming.length,
    other: other.length,
    asxLinked: [...confirmed, ...upcoming].filter((i) => i.companies.some((c) => c.listing === "ASX")).length,
    asxTickers: [...new Set(asxCodesOf([...confirmed, ...upcoming]))],
    disclosedValueAud: confirmed.reduce((sum, i) => sum + audOf(i), 0),
    bySector,
    byJurisdiction,
    bySource,
  };
}

export function sortSections(report) {
  report.confirmed.sort((a, b) => b.date.localeCompare(a.date) || audOf(b) - audOf(a));
  report.upcoming.sort((a, b) => (a.window?.to ?? "9").localeCompare(b.window?.to ?? "9") || b.date.localeCompare(a.date));
  report.other.sort((a, b) => b.date.localeCompare(a.date));
}

export function flagWatchlist(items, watchlist) {
  const watch = new Set(watchlist);
  for (const item of items) {
    item.flags = (item.flags ?? []).filter((f) => f !== "watchlist");
    if (item.companies.some((c) => c.listing === "ASX" && watch.has(c.code))) item.flags.push("watchlist");
  }
}

export async function marketFor(items, existing = {}) {
  const ranked = [...new Set(asxCodesOf(items))].filter((code) => !existing[code]);
  return ranked.length ? { ...existing, ...(await fetchMarketData(ranked.slice(0, 45))) } : existing;
}

export async function buildStandardReport({ settings, onProgress = () => {}, now = new Date() }) {
  const t0 = Date.now();
  const since = daysAgo(7, now);
  const until = daysAhead(7, now);
  const track = progressTracker(onProgress);
  const sources = [];

  track.stage("Loading the ASX company list", 2);
  const directory = await loadAsxDirectory();
  const resolver = new EntityResolver(directory.companies);
  sources.push({
    id: "asx-directory", label: "ASX company list", status: directory.stale ? "partial" : "ok", count: directory.companies.length,
    detail: `${directory.source}${directory.fromCache ? " (cached)" : ""}`, warnings: directory.errors,
  });

  const ctx = { now, since, until, resolver, settings, track };
  const results = await Promise.all([
    runSource(sources, { id: "austender", label: "AusTender contract notices", enabled: settings.sources.austender }, () => austenderItems(ctx)),
    runSource(sources, { id: "asx", label: "ASX announcements", enabled: settings.sources.asxAnnouncements }, () => asxItems(ctx)),
    runSource(sources, { id: "news", label: "News: Google News + publisher feeds", enabled: settings.sources.news }, () => newsItems(ctx)),
    runSource(sources, { id: "atm", label: "AusTender open tenders (opt-in)", enabled: settings.sources.austenderTenders }, () => tenderItems(ctx)),
  ]);

  track.stage("Merging duplicate stories", 82);
  const merged = dedupe(results.flatMap((r) => r.items));
  const report = {
    version: 1,
    app: "MY ASX Options",
    id: `${sydneyDate(now)}-standard`,
    date: sydneyDate(now),
    mode: "standard",
    generatedAt: new Date().toISOString(),
    window: { pastFrom: sydneyDate(since), pastTo: sydneyDate(now), forwardTo: sydneyDate(until) },
    confirmed: merged.filter((i) => i.kind === "confirmed"),
    upcoming: merged.filter((i) => i.kind === "upcoming"),
    other: merged.filter((i) => i.kind === "other"),
    takeaways: [],
    market: {},
    sources,
  };

  if (settings.sources.market) {
    track.stage("Fetching ASX prices and options availability", 88);
    try {
      report.market = await marketFor([...report.confirmed, ...report.upcoming, ...report.other]);
      sources.push({ id: "market", label: "ASX prices and options availability", status: "ok", count: Object.keys(report.market).length });
    } catch (err) {
      sources.push({ id: "market", label: "ASX prices and options availability", status: "error", count: 0, error: err.message });
    }
  } else {
    sources.push({ id: "market", label: "ASX prices and options availability", status: "off", count: 0 });
  }

  sortSections(report);
  flagWatchlist([...report.confirmed, ...report.upcoming, ...report.other], settings.watchlist);
  report.takeaways = buildTakeaways(report);
  report.stats = computeStats(report);
  report.durationMs = Date.now() - t0;
  track.stage("Standard report ready", 90);
  return { report, resolver };
}

/** Returns the reports produced by this run: always the standard report, plus the AI report in AI mode. */
export async function runPipeline({ mode = "standard", settings, onProgress = () => {} }) {
  const now = new Date();
  if (mode === "ai" && !aiConfigured()) throw new Error("AI mode needs an Anthropic API key: set ANTHROPIC_API_KEY in .env (see README).");
  const { report: standard, resolver } = await buildStandardReport({ settings, onProgress, now });
  if (mode !== "ai") return [standard];

  const t0 = Date.now();
  onProgress({ label: "AI analyst: researching with web search (this can take a few minutes)", pct: 91 });
  const ai = await runAiAnalyst({ standard, resolver, settings, now, onProgress });
  const report = {
    ...standard,
    id: `${standard.date}-ai`,
    mode: "ai",
    generatedAt: new Date().toISOString(),
    confirmed: ai.confirmed,
    upcoming: ai.upcoming,
    takeaways: ai.takeaways,
    ai: { model: ai.model, usage: ai.usage, costUsd: ai.costUsd, markdown: ai.markdown, citations: ai.citations },
    sources: [
      ...standard.sources,
      { id: "ai", label: `AI analyst (${ai.model}, web search)`, status: "ok", count: ai.confirmed.length + ai.upcoming.length, ms: Date.now() - t0, detail: `${ai.usage.searches} web searches; est. US$${ai.costUsd.toFixed(2)}` },
    ],
  };
  onProgress({ label: "Fetching prices for AI-identified tickers", pct: 97 });
  report.market = await marketFor([...report.confirmed, ...report.upcoming], standard.market).catch(() => standard.market);
  sortSections(report);
  flagWatchlist([...report.confirmed, ...report.upcoming, ...report.other], settings.watchlist);
  report.stats = computeStats(report);
  report.durationMs = standard.durationMs + (Date.now() - t0);
  return [standard, report];
}
