import { AGENCY_PATTERNS, AU_CONTEXT_RE, AU_HOSTS, FOREIGN_RE, STATE_HINTS } from "../data/agencies.js";
import { addDays, monthNumber, shortDate, sydneyDate } from "./dates.js";

export const SECTORS = ["Defence", "Cyber/IT", "Infrastructure", "Energy", "Health", "Transport", "Services", "Other"];

export const STAGE_LABELS = {
  awarded: "Contract awarded",
  extension: "Contract extension",
  "contract-notice": "AusTender contract notice",
  amendment: "Contract amendment",
  preferred: "Preferred tenderer named",
  shortlisted: "Shortlist announced",
  selected: "Selection announced, contract pending",
  tender: "Tender activity",
  expected: "Decision expected",
  speculation: "Market speculation",
  "tender-closing": "Tender closing",
};

export const CONTRACT_RE =
  /\b(?:contracts?|contracted|tender(?:s|ed|er|ers|ing)?|award(?:s|ed|ing)?|procure(?:s|d|ment)?|purchase orders?|orders?|supply|supplier|panel|deal|agreement|deed|framework|builder|build|construct(?:ion)?|deliver(?:y)?|acquisition|selected|preferred|shortlist(?:ed)?|short-listed|RFT|RFP|RFQ|EOI|expressions? of interest|request for (?:tender|proposal|quote)|standing offer|extension|renewal|partner(?:ship)?|chosen|signs?|signed|inks?|inked|secures?|secured|wins?|won|lands?|landed|clinch(?:es|ed)?|bags?|nabs?)\b/i;

const FORWARD_RE =
  /\b(?:preferred (?:tenderer|bidder|proponent|supplier|respondent|partner|contractor|builder)|shortlist(?:s|ed|ing)?|short-listed|front-?runner|in the running|expected to (?:be )?(?:award|sign|announce|finali[sz]e|select|name|decide|choose)|set to (?:award|sign|win|announce|be awarded|be signed)|poised to (?:win|award|sign)|in talks|negotiating|in negotiations|tenders? (?:open|opens|opened|close|closes|closing|released|launched|called)|requests? for (?:tender|proposal|quote)s?|RFT|RFP|EOI|expressions? of interest|market sounding|bids? (?:close|closes|due|lodged|submitted)|bidding|competing for|vying for|race for|decision (?:is )?(?:due|expected|imminent|looms)|could (?:win|land|secure)|plans? to (?:buy|acquire|procure|award|tender)|will go to (?:tender|market))\b/i;
const SELECTION_RE = /\b(?:selected|chosen|named|picked|tapped)\b/i;
const CONFIRMED_RE =
  /\b(?:award(?:s|ed)|wins?|won|secures?|secured|signs?|signed|inks?|inked|executes?|executed|lands?|landed|clinch(?:es|ed)|bags?|bagged|nabs?|nabbed|scores?|scored|receives? (?:an? |its )?(?:order|contract|purchase order)|purchase orders?|appointed to|has been appointed|contract (?:extension|renewal|variation)|extends?|extended|renews?|renewed|commissioned|contracted|engaged by|orders? (?:from|by|placed)|buys|purchases|procures|acquires|(?:contractor|supplier) panels?)\b/i;

const GRANT_RE = /\b(?:grants?|co-?funding|funding rounds?|subsid(?:y|ies|ised|ized)|rebates?|incentive scheme|EIS)\b/i;
const HAS_PROCUREMENT = /\b(?:contract|tender|procure|purchase order|supply agreement)\b/i;
const WAGES_RE = /\b(?:pay rise|pay deal|wages?|enterprise (?:bargaining )?agreement|EBA|industrial action|bargaining|strike action|union members)\b/i;
const PERMIT_RE = /\b(?:tenements?|exploration (?:permit|licen[cs]e|block|acreage)|petroleum (?:permit|lease|block)|acreage release|mining lease|drill(?:ing)? (?:program|results)|assays?|ore reserve|resource estimate|(?:ATP|PLR|EPM|EPP|PEL|PPL)\s?\d+|trough block)\b/i;
const PRIZE_RE = /\b(?:(?:industry|excellence|innovation|design|business|benchmark) awards?|awards? (?:night|ceremony|winners?|finalists?|program)|prize|accolade|medal|honou?red|finalist|award-winning)\b/i;
const DEAL_WORDS = /\b(?:contract|tender|order|agreement|deal|procure)\b/i;
const POLICY_RE = /\b(?:senate estimates|inquiry|royal commission|opinion|editorial|analysis|explainer|white paper|policy|reform|audit office|ANAO|review finds|scandal|criticis(?:e|ed|m)|bungle|probe|corruption)\b/i;
const JOBS_RE = /\b(?:job ad|vacanc(?:y|ies)|careers? fair|we'?re hiring|apply now)\b/i;
export const FINANCING_RE = /\b(?:funding|facility|loan|debt|financ(?:e|ing)|placement|investment|raise|raising|notes)\b/i;

const SECTOR_RULES = [
  ["Defence", /\b(?:defen[cs]e|military|army|navy|naval|air force|RAAF|ADF|AUKUS|submarines?|frigates?|warships?|destroyers?|munitions?|missiles?|weapons?|ordnance|combat|soldiers?|Ghost Shark|Bushmaster|Boxer|Redback|Hunter class|landing craft|counter-?drones?|counter-?UAS|uncrewed|drone swarms?|GWEO|ASDEFCON|patrol boats?|shipbuilding)\b/i],
  ["Cyber/IT", /\b(?:software|cloud|cyber(?:security)?|IT services|ICT|digital|data cent(?:re|er)s?|SaaS|ERP|platforms?|artificial intelligence|analytics|network(?:s|ing)?|telecom(?:munication)?s?|systems integrat\w*|licen[cs]ing|computing|forensics|technology services|managed services|IT contract|tech contract|apps?|websites?|portal|databases?)\b/i],
  ["Infrastructure", /\b(?:construction|construct|infrastructure|roads?|rail(?:way)?|bridges?|tunnels?|stadium|building works|civil works|airport|ports?|wharf|pier|precinct|water (?:infrastructure|treatment|mains?|pipelines?)|wastewater|pipelines?|motorway|freeway|highway|level crossings?|metro|hospital (?:build|redevelopment|expansion|construction)|housing)\b/i],
  ["Energy", /\b(?:energy|power stations?|gas|LNG|renewables?|wind farms?|offshore wind|solar|batter(?:y|ies)|BESS|transmission|grid|hydrogen|electricity|pumped hydro|fuel)\b/i],
  ["Health", /\b(?:health|hospitals?|medical|pathology|pharma(?:ceutical)?s?|vaccines?|NDIS|aged care|clinical|Medicare|PBS|disability)\b/i],
  ["Transport", /\b(?:vehicles?|fleet|buses|bus|trains?|rolling stock|ferr(?:y|ies)|aviation|aircraft|airline|shipping|logistics|freight|light rail|trams?)\b/i],
  ["Services", /\b(?:consult(?:ing|ancy|ants?)|advisory|facilities management|cleaning|security services|labour hire|recruitment|maintenance services|outsourc\w*|call cent(?:re|er)|professional services|training|catering)\b/i],
];

export function exclusionReason(text) {
  if (GRANT_RE.test(text) && !HAS_PROCUREMENT.test(text)) return "grant";
  if (WAGES_RE.test(text)) return "wages";
  if (PERMIT_RE.test(text)) return "resource-permit";
  if (PRIZE_RE.test(text) && !DEAL_WORDS.test(text)) return "prize";
  if (JOBS_RE.test(text)) return "jobs";
  if (POLICY_RE.test(text) && !CONFIRMED_RE.test(text) && !FORWARD_RE.test(text)) return "policy";
  return null;
}

export function inferState(text) {
  let best = null;
  let bestCount = 0;
  for (const [state, re] of STATE_HINTS) {
    const count = (text.match(new RegExp(re.source, "g")) ?? []).length;
    if (count > bestCount) {
      best = state;
      bestCount = count;
    }
  }
  return best;
}

const STATE_GOVERNMENTS = {
  NSW: "NSW Government", VIC: "Victorian Government", QLD: "Queensland Government", WA: "WA Government",
  SA: "SA Government", TAS: "Tasmanian Government", ACT: "ACT Government", NT: "NT Government",
};
// Signals that a headline is about public procurement even when no agency is named.
const PUBLIC_PROCUREMENT_RE =
  /\b(?:tenders?|shortlist\w*|short-listed|preferred (?:tenderer|bidder|proponent)|government|govt|minister|premier|treasurer|LNP|Labor|Coalition|taxpayers?|public|stadium|hospital|school|rail|metro|motorway|highway|police|courts?|prisons?|justice|Commonwealth|federal|election commitment)\b|\b(?:NSW|Victoria|Queensland|Tasmania|Territory|WA|SA|ACT|NT|Western Australia|South Australia|New South Wales)['’]s\b/i;

/**
 * Most specific Australian government counterparty mentioned in `text`, or null.
 * With `infer`, a headline about public procurement that names only a state (or "state")
 * is attributed to that government; such matches are weak.
 */
export function detectGov(text = "", { infer = false, skipRegulators = false } = {}) {
  for (let i = 0; i < AGENCY_PATTERNS.length; i++) {
    const p = AGENCY_PATTERNS[i];
    if (skipRegulators && p.regulator) continue;
    const m = text.match(p.re);
    if (m) {
      return { agency: p.name ?? m[0].trim(), jurisdiction: p.jur ?? inferState(text) ?? "Unknown", level: p.level, weak: p.weak, specificity: i, matched: m[0] };
    }
  }
  if (!infer || !PUBLIC_PROCUREMENT_RE.test(text)) return null;
  const inferred = { level: "state", weak: true, inferred: true, specificity: AGENCY_PATTERNS.length };
  const state = inferState(text);
  if (state) return { ...inferred, agency: STATE_GOVERNMENTS[state], jurisdiction: state };
  if (/\bstate\b/i.test(text)) return { ...inferred, agency: "State Government", jurisdiction: "Unknown" };
  return null;
}

const DEAL_SENTENCE_RE = /\b(?:award(?:ed|s)?|contracts?|agreements?|orders?|selected|engaged|appointed|panel|deed|supply|funding|loan|facility|tender)\b/i;

/** True when the sentence that mentions a (weak) government match is about the deal itself. */
export function mentionedAsCounterparty(text, matched) {
  const sentence = text.split(/(?<=[.!?])\s+/).find((s) => s.includes(matched));
  return Boolean(sentence) && DEAL_SENTENCE_RE.test(sentence);
}

export function contractStatus(text = "") {
  if (FORWARD_RE.test(text)) return { status: "forward", stage: forwardStage(text) };
  if (CONFIRMED_RE.test(text)) {
    return { status: "confirmed", stage: /\b(?:extend|extension|renew|variation)/i.test(text) ? "extension" : "awarded" };
  }
  if (SELECTION_RE.test(text)) return { status: "forward", stage: "selected" };
  return { status: null, stage: null };
}

function forwardStage(text) {
  if (/\bpreferred\b/i.test(text)) return "preferred";
  if (/\bshort-?list/i.test(text)) return "shortlisted";
  if (/\b(?:tenders?|RFT|RFP|EOI|expressions? of interest|requests? for|market sounding|bids?|bidding)\b/i.test(text)) return "tender";
  if (/\b(?:expected|set to|poised|decision|imminent)\b/i.test(text)) return "expected";
  return "speculation";
}

export function sectorFor(text = "", gov = null) {
  if (gov?.level === "defence" && !gov.weak) return "Defence";
  for (const [sector, re] of SECTOR_RULES) {
    if (re.test(text) || (sector === "Cyber/IT" && /\bAI\b/.test(text))) return sector;
  }
  return gov?.level === "defence" ? "Defence" : "Other";
}

export const hostOf = (url = "") => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const isAustralianContext = (text, host = "") => AU_CONTEXT_RE.test(text) || host.endsWith(".au") || AU_HOSTS.has(host);
export const hasForeignContext = (text) => FOREIGN_RE.test(text);

const GENERIC_SUBJECT = new Set(
  `builder builders contractor contractors company companies firm firms supplier suppliers startup start-up government defence
  council department australia australian aussie federal state major new local asx tech consortium group partner partners vendor
  vendors operator developer team bidder bidders one two three four five six several exclusive breaking update watch why how what
  queensland nsw victoria victorian wa sa tasmania tasmanian hobart sydney melbourne brisbane perth adelaide darwin canberra
  minister premier treasurer labor liberal liberals lnp nationals greens coalition opposition army navy raaf adf the a an this
  that swiss us american chinese japanese korean indian israeli german french british uk european canadian spanish italian
  singaporean global international overseas foreign`.split(/\s+/),
);

const VENDOR_VERB_RE =
  /\b(?:secures?|secured|wins?|won|awarded|lands?|landed|signs?|signed|inks?|inked|named|selected|chosen|picked|tapped|bags?|nabs?|scores?|clinch(?:es|ed)?|receives?|gets?|books?|extends?|extended|shortlisted|short-listed|appointed|to (?:build|supply|deliver|provide|operate|design))\b/i;
const BUYER_OBJECT_RE =
  /\b(?:awards?|selects?|picks?|taps?|chooses?|hires?|engages?|appoints?|names?|orders? from|buys? from|signs? with|contracts? with|awarded to|contract to|deal with|agreement with)\s+((?:the\s+)?[A-Z0-9][\w&'’.\-]*(?:\s+(?:&\s+)?[A-Z0-9][\w&'’.\-]*){0,4})/;

const isGeneric = (seq) => !seq || seq.split(/\s+/).every((w) => GENERIC_SUBJECT.has(w.toLowerCase().replace(/[^a-z-]/g, ""))) || Boolean(detectGov(seq));

function trailingCapitalised(s) {
  const toks = s.trim().split(/\s+/);
  const out = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    if (/^[A-Z0-9][\w&'’.\-]*$/.test(toks[i]) || (toks[i] === "&" && out.length)) out.unshift(toks[i]);
    else break;
  }
  while (out.length && /^(?:&|and|the|as|after|with|for)$/i.test(out[0])) out.shift();
  return out.join(" ").replace(/[:,;.]+$/, "");
}

/** Vendor names a headline puts next to an award/selection verb ("BESIX Watpac named builder"). */
export function extractVendorNames(title = "") {
  const t = title.replace(/^(?:EXCLUSIVE|BREAKING|UPDATE|WATCH|VIDEO|OPINION|ANALYSIS)\s*[:\-–]\s*/i, "");
  const names = [];
  const vm = VENDOR_VERB_RE.exec(t);
  if (vm) {
    // "Australia's Cobalt Blue secures ..." -> "Cobalt Blue"
    const seq = trailingCapitalised(t.slice(0, vm.index)).replace(/^(?:[A-Z][\w-]*['’]s\s+)+/, "");
    if (seq && !isGeneric(seq)) names.push(seq);
  }
  const bm = BUYER_OBJECT_RE.exec(t);
  if (bm) {
    const seq = bm[1].replace(/^the\s+/i, "").replace(/[:,;.]+$/, "").trim();
    const cut = seq.split(/\s+/);
    while (cut.length && GENERIC_SUBJECT.has(cut.at(-1).toLowerCase())) cut.pop();
    const cleaned = cut.join(" ");
    if (cleaned && !isGeneric(cleaned)) names.push(cleaned);
  }
  return [...new Set(names)];
}

const DATE_DM_RE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b(?:\s+(\d{4}))?/gi;
const DATE_MD_RE = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/gi;

/** Best guess at when a forward-looking item is due, from dates or phrases in the text. */
export function forwardWindow(text = "", now = new Date(), horizonDays = 7) {
  const today = sydneyDate(now);
  const horizon = addDays(today, horizonDays);
  const year = Number(today.slice(0, 4));
  const candidates = [];
  for (const m of text.matchAll(DATE_DM_RE)) candidates.push([Number(m[1]), monthNumber(m[2]), m[3] ? Number(m[3]) : null]);
  for (const m of text.matchAll(DATE_MD_RE)) candidates.push([Number(m[2]), monthNumber(m[1]), m[3] ? Number(m[3]) : null]);
  for (const [d, mo, y] of candidates) {
    if (!mo || d < 1 || d > 31) continue;
    const iso = `${y ?? year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso >= today && iso <= addDays(today, 21)) return { label: `By ${shortDate(iso)}`, from: today, to: iso };
  }
  if (/\bthis week\b/i.test(text)) return { label: "This week", from: today, to: horizon };
  if (/\bnext week\b/i.test(text)) return { label: "Next week", from: addDays(today, 1), to: addDays(today, 10) };
  if (/\b(?:within days|imminent(?:ly)?|days away|this weekend)\b/i.test(text)) return { label: "Imminent", from: today, to: addDays(today, 3) };
  if (/\b(?:this month|end of (?:the )?month|by month'?s end)\b/i.test(text)) return { label: "By end of month", from: today, to: horizon };
  return { label: "Next 7 days (indicative)", from: today, to: horizon };
}
