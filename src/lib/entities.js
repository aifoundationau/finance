import { ALIASES, COMMON_WORDS } from "../data/aliases.js";
import { displayName } from "./text.js";

const LEGAL_ANYWHERE = new Set(["PTY", "PROPRIETARY", "LTD", "LIMITED", "INC", "INCORPORATED", "LLC", "PLC", "CORP", "CORPORATION"]);
const LEGAL_TRAILING = new Set(["NL", "CO", "COMPANY", "AG", "SA", "NV", "BV", "GMBH", "SE", "AB", "ASA", "KK", "BHD", "SDN", "SPA", "SRL", "OY", "LP", "LLP", "TRUST", "UNIT", "FAMILY", "AND"]);
const GENERIC_TRAILING = new Set(["AUSTRALIA", "AUST", "AUSTRALASIA", "AUSTRALASIAN", "ASIA", "PACIFIC", "APAC", "OCEANIA", "INTERNATIONAL", "INTL", "GLOBAL", "WORLDWIDE", "GROUP", "HOLDINGS", "HOLDING", "OPERATIONS"]);
const FUNDLIKE = /\b(?:ETF|ETFS|FUND|FUNDS|INDEX|ETP|PORTFOLIO|CERTIFICATES?|WARRANTS?|BETASHARES|VANGUARD|ISHARES|SPDR|VANECK)\b/;
// Three-letter company names that are also everyday acronyms in this kind of news.
const ACRONYM_STOP = new Set(["ASX", "GPT", "ACT", "NSW", "CEO", "CFO", "CTO", "ICT", "API", "IOT", "ESG", "GST", "ATO", "ADF", "ASD", "ABC", "SBS", "AFR", "AAP", "AFP", "USA", "UAE", "NZX", "RFT", "EOI", "LNG", "BESS"]);
// Words that can follow a company name in a headline. A one-word ASX name followed by any other
// capitalised word is probably the start of a different company's name ("Aspen Medical").
const HEADLINE_FOLLOWERS = new Set(
  `wins win won secures secure secured signs sign signed awarded awards lands land landed inks ink inked named selected bags
  scores extends extended receives gets shares stock to in on for with and as at by of from is was has have will says said
  eyes targets shortlisted chosen picked tapped appointed reveals posts raises jumps soars surges rallies climbs falls drops
  slumps sinks boosts expands launches unveils delivers completes reports announces partners joins takes books nets clinches
  snags strikes enters hits locks seals adds begins starts wraps finalises finalizes confirms executes limited ltd group
  holdings`.split(/\s+/),
);
const TICKER_ASX_RE = /\bASX(?:\s+code)?\s*:\s*([A-Z0-9]{3,4})\b/g;
const TICKER_INTL_RE = /\((NYSE|NASDAQ|Nasdaq|LSE|TSX|ETR|EPA|BIT|STO|OSE|KRX|TYO|SGX|HKEX|NSE)\s*:\s*([A-Z0-9][A-Z0-9.\-]{0,7})\)/g;

/** Normalised identity tokens: legal forms, "Australia", "Group" etc. removed. */
export function nameTokens(raw = "") {
  let t = String(raw)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[’'`´]/g, "")
    .replace(/[^A-Z0-9#+]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (t[0] === "THE") t = t.slice(1);
  if (t[0] === "TRUSTEE" && t[1] === "FOR") t = t.slice(t[2] === "THE" ? 3 : 2);
  t = t.filter((x) => !LEGAL_ANYWHERE.has(x));
  while (t.length > 1 && (LEGAL_TRAILING.has(t.at(-1)) || GENERIC_TRAILING.has(t.at(-1)))) t.pop();
  return t;
}

export const coreName = (raw) => nameTokens(raw).join(" ");

// Name with only legal forms removed ("ASPEN GROUP LIMITED" -> "ASPEN GROUP"). One-word cores
// such as "ASPEN" must match on this fuller name, so "Aspen Medical" is not read as Aspen Group.
const fullName = (raw) =>
  String(raw)
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[’'`´]/g, "")
    .replace(/[^A-Z0-9#+]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t && !LEGAL_ANYWHERE.has(t) && t !== "THE")
    .join(" ");

const eligibleSingle = (tok) => tok.length >= 3 && !COMMON_WORDS.has(tok) && !ACRONYM_STOP.has(tok) && !/^\d+$/.test(tok);
// A one-word ASX name this distinctive is unlikely to be shared by an unrelated company.
const distinctive = (tok) => tok.length >= 6 && eligibleSingle(tok);
// Words that describe a subsidiary's line of business ("MONADELPHOUS ENGINEERING").
const DESCRIPTORS = new Set(
  `ENGINEERING SERVICES SERVICE CONTRACTING CONTRACTORS CONSTRUCTION CONSTRUCTIONS TECHNOLOGY TECHNOLOGIES SYSTEMS SOLUTIONS
  DEFENCE COMMUNICATIONS INFRASTRUCTURE MAINTENANCE CIVIL OPERATIONS PROJECTS CONSULTING BUILDING INDUSTRIAL ELECTRICAL
  FACILITIES LOGISTICS SOFTWARE NETWORKS DIGITAL DATA CLOUD SECURITY TRAINING MANAGEMENT ENTERPRISE ENTERPRISES INDUSTRIES
  MANUFACTURING AEROSPACE MARINE SHIPBUILDING RAIL ENERGY POWER WATER TELECOM TELECOMMUNICATIONS EQUIPMENT SUPPLY SUPPLIES
  PRODUCTS FLEET LEASING RENTALS HIRE PERSONNEL RECRUITMENT STAFFING WORKFORCE PROPERTY PROPERTIES`.split(/\s+/),
);

const unverified = (raw) => ({ display: displayName(raw), listing: "Unverified", exchange: null, code: null, match: "none" });

export function tickerLabel(c) {
  if (!c) return "—";
  if (c.listing === "ASX") return `ASX: ${c.code}`;
  if (c.listing === "Overseas") return `${c.exchange}: ${c.code}`;
  if (c.listing === "Private" || c.listing === "Government-owned") return c.listing;
  return "Unlisted / unverified";
}

export const entityKey = (c) => (c.code ? `${c.exchange ?? c.listing}:${c.code}` : `name:${coreName(c.display || c.name)}`);

export class EntityResolver {
  constructor(companies = [], aliases = ALIASES) {
    this.byCode = new Map();
    this.cores = new Map();
    for (const c of companies) {
      if (!c?.code || !c?.name) continue;
      this.byCode.set(c.code, c);
      if (FUNDLIKE.test(c.name.toUpperCase())) continue;
      const core = coreName(c.name);
      if (!core) continue;
      const prev = this.cores.get(core);
      if (!prev || (c.marketCap ?? 0) > (prev.marketCap ?? 0)) this.cores.set(core, c);
    }

    this.aliases = aliases
      .flatMap((alias) =>
        alias.names.map((n) => ({
          alias,
          tokens: nameTokens(n),
          strict: alias.strict?.find((s) => s.toUpperCase() === n.toUpperCase()) ?? null,
        })),
      )
      .filter((a) => a.tokens.length)
      .map((a) => ({ ...a, core: a.tokens.join(" ") }))
      .sort((x, y) => y.core.length - x.core.length);

    // Headline scanning index: first token -> candidate names, longest first.
    this.textIndex = new Map();
    const add = (tokens, target) => {
      const list = this.textIndex.get(tokens[0]) ?? [];
      list.push({ tokens, ...target });
      this.textIndex.set(tokens[0], list);
    };
    for (const [core, company] of this.cores) {
      const tokens = core.split(" ");
      if (tokens.length === 1 && !eligibleSingle(tokens[0])) continue;
      add(tokens, { company });
    }
    for (const a of this.aliases) {
      if (!a.strict && a.tokens.length === 1 && (a.tokens[0].length < 4 || !eligibleSingle(a.tokens[0]))) continue;
      add(a.tokens, { alias: a.alias, strict: a.strict });
    }
    for (const list of this.textIndex.values()) list.sort((x, y) => y.tokens.length - x.tokens.length);
  }

  fromCompany(c, match) {
    return { display: displayName(c.name), listing: "ASX", exchange: "ASX", code: c.code, match, industry: c.industry ?? null };
  }

  fromAlias(alias, raw, match) {
    const display = alias.display ?? displayName(raw);
    if (alias.asx) {
      const c = this.byCode.get(alias.asx);
      if (c) return { ...this.fromCompany(c, match), ...(alias.note ? { note: alias.note } : {}) };
      return { display, listing: "Unverified", exchange: null, code: null, match, note: `ASX:${alias.asx} is not in the current ASX list` };
    }
    if (alias.exchange) return { display, listing: "Overseas", exchange: alias.exchange, code: alias.ticker, match, ...(alias.note ? { note: alias.note } : {}) };
    return { display, listing: alias.listing ?? "Private", exchange: null, code: null, match, ...(alias.note ? { note: alias.note } : {}) };
  }

  /** Resolve a contracting-entity name, e.g. an AusTender supplier. */
  resolveName(raw) {
    const name = String(raw ?? "").trim();
    const variants = name.split(/\s+(?:T\/A|TRADING AS|ATF|AS TRUSTEE FOR)\s+/i).filter(Boolean);
    let fallback = null;
    for (const v of variants.length ? variants : [name]) {
      const r = this.#resolveOne(v);
      if (r.listing !== "Unverified" || r.note) return { ...r, name };
      fallback ??= r;
    }
    return { ...(fallback ?? unverified(name)), name };
  }

  #resolveOne(raw) {
    const tokens = nameTokens(raw);
    const core = tokens.join(" ");
    if (!core) return unverified(raw);
    for (const a of this.aliases) {
      if (core === a.core || core.startsWith(`${a.core} `)) return this.fromAlias(a.alias, raw, "alias");
    }
    const exact = this.cores.get(core);
    if (exact && (tokens.length > 1 || distinctive(core) || fullName(exact.name) === fullName(raw))) return this.fromCompany(exact, "exact");
    // Token prefix of a multi-word ASX name, e.g. "DOWNER EDI WORKS" -> "DOWNER EDI".
    for (let n = tokens.length - 1; n >= 2; n--) {
      const c = this.cores.get(tokens.slice(0, n).join(" "));
      if (c) return this.fromCompany(c, "prefix");
    }
    const single = this.cores.get(tokens[0]);
    if (single && tokens.length > 1 && distinctive(tokens[0]) && tokens.slice(1).every((t) => DESCRIPTORS.has(t))) {
      return this.fromCompany(single, "prefix");
    }
    return unverified(raw);
  }

  /** Companies named in free text (headlines, summaries), in order of first mention. */
  findInText(text = "") {
    const found = new Map();
    const add = (entity) => {
      const key = entityKey(entity);
      if (!found.has(key)) found.set(key, entity);
    };

    for (const m of text.matchAll(TICKER_ASX_RE)) {
      const c = this.byCode.get(m[1]);
      if (c) add({ ...this.fromCompany(c, "explicit"), name: c.name, pos: m.index });
    }
    for (const m of text.matchAll(TICKER_INTL_RE)) {
      const exchange = m[1].toUpperCase();
      add({ name: m[2], display: m[2], listing: "Overseas", exchange, code: m[2], match: "explicit", pos: m.index });
    }

    const words = [...text.matchAll(/&|[A-Za-z0-9][A-Za-z0-9#+'’]*/g)];
    const norm = words.map((w) => (w[0] === "&" ? "AND" : w[0].toUpperCase().replace(/['’]S$/, "").replace(/['’]/g, "")));
    for (let i = 0; i < words.length; i++) {
      const candidates = this.textIndex.get(norm[i]);
      if (!candidates) continue;
      for (const cand of candidates) {
        const n = cand.tokens.length;
        if (i + n > words.length || cand.tokens.some((t, k) => norm[i + k] !== t)) continue;
        const original = words.slice(i, i + n).map((w) => w[0]);
        const phrase = original.join(" ");
        if (cand.strict) {
          if (phrase !== cand.strict) continue;
        } else if (!/^[A-Z0-9]/.test(original[0])) continue;
        else if (n === 1 && cand.tokens[0].length <= 3 && original[0] !== original[0].toUpperCase()) continue;
        if (n === 1 && cand.company) {
          const next = words[i + 1]?.[0];
          const adjacent = next && /^\s+$/.test(text.slice(words[i].index + words[i][0].length, words[i + 1].index));
          if (adjacent && /^[A-Z]/.test(next) && !HEADLINE_FOLLOWERS.has(next.toLowerCase())) continue;
        }
        const entity = cand.company ? this.fromCompany(cand.company, "name") : this.fromAlias(cand.alias, phrase, "alias");
        add({ ...entity, name: phrase, pos: words[i].index });
        i += n - 1;
        break;
      }
    }
    // Order by first mention; the position itself is not part of the company contract.
    return [...found.values()].sort((a, b) => a.pos - b.pos).map(({ pos, ...company }) => company);
  }
}
