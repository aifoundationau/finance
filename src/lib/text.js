import crypto from "node:crypto";

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”",
  ldquo: "“", ndash: "–", mdash: "—", hellip: "…", raquo: "»", laquo: "«", copy: "©", reg: "®",
  trade: "™", middot: "·", bull: "•", eacute: "é", egrave: "è", aacute: "á", oacute: "ó", uuml: "ü",
};

export function decodeEntities(s = "") {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? match;
  });
}

export const squash = (s = "") => s.replace(/\s+/g, " ").trim();

/** HTML fragment (possibly entity-encoded, as in RSS descriptions) to plain text. */
export function cleanText(html = "") {
  const decoded = decodeEntities(html);
  const stripped = decoded
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return squash(decodeEntities(stripped));
}

export const shortHash = (s) => crypto.createHash("sha1").update(String(s)).digest("base64url").slice(0, 12);

export const truncate = (s = "", n = 200) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const KEEP_UPPER = new Set([
  "ASX", "NSW", "QLD", "WA", "SA", "NT", "ACT", "VIC", "TAS", "AU", "NZ", "UK", "US", "USA", "IT", "AI",
  "ICT", "CBA", "ANZ", "NAB", "AMP", "BHP", "CSL", "QBE", "IAG", "AGL", "APA", "NRW", "SRG", "GPT",
  "REIT", "NL", "EOS", "IBM", "NEC", "SAP", "BAE", "EY", "KPMG", "PWC", "AECOM", "WSP", "GHD", "SMEC",
  "DXC", "CGI", "TCS", "HCL", "AWS", "UGL", "CPB", "ASC", "CEA", "II", "III", "IV",
]);

/** "TECHNOLOGY ONE LIMITED" -> "Technology One Limited"; mixed-case input is left alone. */
export function prettyName(name = "") {
  const s = squash(name);
  if (!s || s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(/(\s+|-|\/|\(|\))/)
    .map((tok) => {
      const up = tok.toUpperCase();
      if (KEEP_UPPER.has(up)) return up;
      if (/^[a-z]$/.test(tok)) return up;
      if (/\d/.test(tok) && tok.length <= 4) return up;
      if (/^[a-z]{2,4}$/.test(tok) && !/[aeiouy]/.test(tok)) return up;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join("");
}

/** Strip trailing legal forms for display: "Leidos Australia Pty Ltd" -> "Leidos Australia". */
export const displayName = (name = "") =>
  prettyName(name)
    .replace(/^the trustee for (?:the )?/i, "")
    .replace(/[\s,]+(pty\.?\s*)?(ltd\.?|limited|inc\.?|plc|llc|corporation|corp\.?)$/i, "")
    .replace(/[\s,]+pty\.?$/i, "")
    .trim();

const MULTIPLIERS = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
const MONEY_RE =
  /(?<cur>A\$|AU\$|AUD\s?\$?|US\$|USD\s?\$?|NZ\$|NZD\s?\$?|\$)\s?(?<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(?<unit>thousand|million|billion|mil|mn|bn|m|b|k)?(?![a-z])/gi;

/** All currency amounts mentioned in `text`, in order of appearance. */
export function parseMoney(text = "") {
  const out = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const num = Number(m.groups.num.replace(/,/g, ""));
    if (!Number.isFinite(num)) continue;
    const amount = num * (MULTIPLIERS[(m.groups.unit || "").toLowerCase()] ?? 1);
    const cur = m.groups.cur.toUpperCase();
    const currency = cur.startsWith("US") ? "USD" : cur.startsWith("NZ") ? "NZD" : "AUD";
    out.push({ amount, currency, raw: m[0].trim() });
  }
  return out;
}

/** First amount at or above `min`; the first mention is usually the headline value. */
export const firstMoney = (text, min = 50_000) => parseMoney(text).find((v) => v.amount >= min) ?? null;

export function formatMoney(amount, currency = "AUD") {
  if (!Number.isFinite(amount)) return "";
  const prefix = currency === "AUD" ? "$" : currency === "USD" ? "US$" : currency === "NZD" ? "NZ$" : `${currency} `;
  const scaled = (v, suffix) => {
    const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "");
    return `${prefix}${s}${suffix}`;
  };
  const abs = Math.abs(amount);
  if (abs >= 1e9) return scaled(amount / 1e9, "B");
  if (abs >= 1e6) return scaled(amount / 1e6, "M");
  if (abs >= 1e3) return scaled(amount / 1e3, "k");
  return `${prefix}${amount.toFixed(0)}`;
}

export const moneyValue = (v, note) =>
  v ? { amount: v.amount, currency: v.currency, text: formatMoney(v.amount, v.currency), ...(note ? { note } : {}) } : null;
