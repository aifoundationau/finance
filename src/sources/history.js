import { fetchJson } from "../lib/http.js";
import { viewerCountry } from "../commerce.js";
import { resolveExchange } from "../../public/shared/exchanges.js";

// Daily closes for ASX and overseas listings (Yahoo Finance chart feed, delayed), shown in the
// viewer's local currency at today's ECB reference rate (Frankfurter).
const FX_URL = (currency) => `https://api.frankfurter.dev/v1/latest?base=AUD&symbols=${currency}`;
const HISTORY_TTL_MS = 15 * 60_000;
const FX_TTL_MS = 6 * 3_600_000;

const EURO = "AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES".split(" ");
const CURRENCY_BY_COUNTRY = {
  US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD", JP: "JPY", SG: "SGD", HK: "HKD", IN: "INR", CN: "CNY", KR: "KRW",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", ZA: "ZAR", BR: "BRL", MX: "MXN",
  MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", IL: "ILS", TR: "TRY", IS: "ISK", RO: "RON",
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
};

export const currencyFor = (country) => CURRENCY_BY_COUNTRY[country] ?? "AUD";

export function displayCountry(req) {
  for (const name of [process.env.GEO_COUNTRY_HEADER, "x-vercel-ip-country", "cf-ipcountry"]) {
    const value = name ? String(req.headers[name.toLowerCase()] ?? "").trim() : "";
    if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  }
  return viewerCountry(req);
}

const historyCache = new Map();
const fxCache = new Map();

/** Maps an exchange + ticker or symbol into a Yahoo Finance symbol. */
export function yahooSymbol(code, exchange = null) {
  let c = code.trim().toUpperCase();
  if (exchange) {
    const resolved = resolveExchange(exchange);
    if (resolved && resolved.yahoo !== undefined) {
      if (resolved.yahoo === "") return c;
      const clean = c.endsWith(".") ? c.slice(0, -1) : c;
      return `${clean}${resolved.yahoo}`;
    }
    const ex = exchange.trim().toUpperCase();
    if (ex === "ASX") return `${c}.AX`;
    if (ex === "NYSE" || ex === "NASDAQ" || ex === "AMEX") return c;
    if (ex === "LSE" || ex === "LON") return `${c.endsWith(".") ? c.slice(0, -1) : c}.L`;
    if (ex === "TSX") return `${c}.TO`;
    if (ex === "EPA") return `${c}.PA`;
    if (ex === "ETR") return `${c}.DE`;
    if (ex === "STO") return `${c}.ST`;
    if (ex === "OSE" || ex === "OSL") return `${c}.OL`;
    if (ex === "BIT") return `${c}.MI`;
    if (ex === "KRX") return `${c}.KS`;
    if (ex === "NZX" || ex === "NZE") return `${c}.NZ`;
    if (ex === "SGX") return `${c}.SI`;
  }
  // If code contains colon like "NYSE:LMT" or "LSE:BA."
  if (c.includes(":")) {
    const [ex, sym] = c.split(":");
    return yahooSymbol(sym, ex);
  }
  // Default to ASX if 3-6 chars letters/digits
  if (/^[A-Z0-9]{3,6}$/.test(c)) return `${c}.AX`;
  return c;
}

const CHART_URL = (sym) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;

async function closes(sym) {
  const hit = historyCache.get(sym);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.value;
  const result = (await fetchJson(CHART_URL(sym), { retries: 1, timeout: 12_000 }))?.chart?.result?.[0];
  const stamps = result?.timestamp ?? [];
  const prices = result?.indicators?.quote?.[0]?.close ?? [];
  const meta = result?.meta ?? {};
  const nativeCurrency = meta.currency ?? "AUD";
  const toDate = (s) => new Date(s * 1000).toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const points = stamps.map((s, i) => ({ date: toDate(s), close: prices[i] })).filter((p) => Number.isFinite(p.close));
  const byDate = [...new Map(points.map((p) => [p.date, p])).values()];
  const value = { name: meta.longName ?? meta.shortName ?? sym, nativeCurrency, points: byDate };
  historyCache.set(sym, { at: Date.now(), value });
  return value;
}

async function getFxRate(from, to) {
  if (from === to) return { rate: 1, date: new Date().toISOString().slice(0, 10), source: "1:1" };
  const key = `${from}->${to}`;
  const hit = fxCache.get(key);
  if (hit && Date.now() - hit.at < FX_TTL_MS) return hit.value;
  const d = await fetchJson(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`, { retries: 1, timeout: 10_000 });
  const rate = d?.rates?.[to];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No ${from}/${to} rate`);
  const value = { rate, date: d.date, source: "European Central Bank via Frankfurter" };
  fxCache.set(key, { at: Date.now(), value });
  return value;
}

/** Daily closes for the past year for any ticker (ASX or overseas). */
export async function priceHistory(code, country, exchange = null) {
  const sym = yahooSymbol(code, exchange);
  const { name, nativeCurrency, points } = await closes(sym);
  if (!points.length) throw Object.assign(new Error(`No price history for ${code}.`), { status: 404, code: "NO_HISTORY" });
  
  let targetCurrency = currencyFor(country);
  let fx = null;
  let fxError = null;

  if (targetCurrency !== nativeCurrency) {
    try {
      fx = await getFxRate(nativeCurrency, targetCurrency);
    } catch (err) {
      fxError = `Shown in ${nativeCurrency}: no exchange rate for ${targetCurrency} (${err.message}).`;
      targetCurrency = nativeCurrency;
    }
  }

  const round = (v) => Math.round(v * 10_000) / 10_000;
  return {
    code,
    symbol: sym,
    exchange: exchange ?? (sym.endsWith(".AX") ? "ASX" : null),
    name,
    country: country ?? null,
    currency: targetCurrency,
    nativeCurrency,
    fx,
    ...(fxError ? { fxError } : {}),
    asOf: new Date().toISOString(),
    source: "Yahoo Finance (delayed daily closes)",
    points: points.map((p) => ({ date: p.date, close: round(fx ? p.close * fx.rate : p.close) })),
  };
}
