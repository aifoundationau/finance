import { coreName, entityKey } from "./entities.js";

const STOP = new Set(
  "the a an of for to in on and with as at by from its after over new says say australia australian contract contracts deal deals million billion asx govt government secures secured wins awarded signs signed amid into".split(" "),
);
const SOURCE_RANK = { asx: 1, austender: 2, atm: 2, news: 3, ai: 3 };
const TOP_PUBLISHERS = /financial review|\bafr\b|the australian|\babc\b|morning herald|the age|innovationaus|itnews|defence connect|defence reporter|government news|reuters|bloomberg/i;
const CONFIDENCE = ["low", "medium", "high"];

function rank(item) {
  const s = item.sources[0];
  const base = SOURCE_RANK[s?.type] ?? 4;
  return s?.type === "news" && !TOP_PUBLISHERS.test(s.publisher ?? "") ? base + 0.5 : base;
}

export function titleTokens(s = "") {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9$ ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
      .map((t) => (t.length > 5 ? t.replace(/(?:ing|ed|es|s)$/, "") : t)),
  );
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / Math.min(a.size, b.size);
}

const audValue = (item) => (item.value?.currency === "AUD" ? item.value.amount : null);
const closeValues = (a, b, tolerance) => Math.abs(a - b) / Math.max(a, b) < tolerance;

function sameStory(a, b) {
  const sim = overlap(a._tokens, b._tokens);
  if (a.kind !== b.kind && sim < 0.85) return false;
  if (Math.abs(Date.parse(a.date) - Date.parse(b.date)) > 4 * 86_400_000) return false;
  const bKeys = new Set(b.companies.map(entityKey));
  const shared = a.companies.some((c) => bKeys.has(entityKey(c)) || b.companies.some((d) => sameCompanyName(c, d)));
  const av = audValue(a);
  const bv = audValue(b);
  // AusTender notices are distinct contracts; only fold in a story that matches company and value.
  if (a.sources[0]?.type === "austender" || b.sources[0]?.type === "austender") return shared && av && bv && closeValues(av, bv, 0.05);
  if (av && bv) {
    if (!closeValues(av, bv, 0.12)) return sim >= 0.85;
    if (shared) return true;
  }
  if (shared && sim >= 0.4) return true;
  // Stories that name no company (e.g. "Builder chosen for Hobart stadium") match on place and wording;
  // a story that names no state is compatible with one that does.
  const known = (j) => (j && j !== "Unknown" ? j : null);
  const [ja, jb] = [known(a.jurisdiction), known(b.jurisdiction)];
  const sameJurisdiction = ja && jb ? ja === jb : Boolean(ja || jb);
  if (sameJurisdiction && (!a.companies.length || !b.companies.length) && sim >= 0.4) return true;
  return sim >= 0.6;
}

const sameCompanyName = (a, b) => {
  const x = coreName(a.display);
  const y = coreName(b.display);
  return Boolean(x && y) && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `));
};

function merge(target, src) {
  const urls = new Set(target.sources.map((s) => s.url));
  for (const s of src.sources) {
    if (!urls.has(s.url)) {
      target.sources.push(s);
      urls.add(s.url);
    }
  }
  const keys = new Set(target.companies.map(entityKey));
  for (const c of src.companies) {
    // "Excite" (unresolved, from a headline) is redundant next to "Excite Technology Services".
    const redundant = c.listing === "Unverified" && target.companies.some((t) => sameCompanyName(t, c));
    if (!redundant && !keys.has(entityKey(c))) {
      target.companies.push(c);
      keys.add(entityKey(c));
    }
  }
  for (const t of src._tokens) target._tokens.add(t);
  target.value ??= src.value;
  if (src.agency && (!target.agency || (target.agencyWeak && !src.agencyWeak))) {
    target.agency = src.agency;
    target.agencyWeak = src.agencyWeak;
    target.jurisdiction = src.jurisdiction ?? target.jurisdiction;
  }
  const types = new Set(target.sources.map((s) => s.type));
  const best = Math.max(CONFIDENCE.indexOf(target.confidence), CONFIDENCE.indexOf(src.confidence));
  const corroborated = target.sources.length >= 2 && (types.has("asx") || types.has("austender")) ? 2 : target.sources.length >= 3 ? 1 : 0;
  target.confidence = CONFIDENCE[Math.max(best, corroborated)];
}

/** Collapse syndicated or cross-source duplicates; the highest-ranked source leads. */
export function dedupe(items) {
  const out = [];
  const sorted = items
    .map((i) => ({ ...i, sources: [...i.sources], companies: [...i.companies], _tokens: titleTokens(`${i.title} ${i.companies.map((c) => c.display).join(" ")}`) }))
    .sort((a, b) => rank(a) - rank(b));
  for (const item of sorted) {
    const target = out.find((o) => sameStory(o, item));
    if (target) merge(target, item);
    else out.push(item);
  }
  // Merging widens an item's wording, so earlier non-matches may now match: repeat until stable.
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (sameStory(out[i], out[j])) {
          merge(out[i], out[j]);
          out.splice(j, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return out.map(({ _tokens, ...rest }) => rest);
}
