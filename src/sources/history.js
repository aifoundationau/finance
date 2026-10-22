import { fetchJson } from "../lib/http.js";
import { viewerCountry } from "../commerce.js";

// A year of daily closes for one ASX code (Yahoo Finance chart feed, delayed), shown in the
// viewer's local currency at today's ECB reference rate (Frankfurter). One rate for the whole
// series keeps each period's % move identical to the move on the ASX.
const CHART_URL = (code) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}.AX?range=1y&interval=1d`;
const FX_URL = (currency) => `https://api.frankfurter.dev/v1/latest?base=AUD&symbols=${currency}`;
const HISTORY_TTL_MS = 15 * 60_000;
const FX_TTL_MS = 6 * 3_600_000;

const EURO = "AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES".split(" ");
// Only currencies the ECB publishes; anywhere else stays in AUD.
const CURRENCY_BY_COUNTRY = {
  US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD", JP: "JPY", SG: "SGD", HK: "HKD", IN: "INR", CN: "CNY", KR: "KRW",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", ZA: "ZAR", BR: "BRL", MX: "MXN",
  MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", IL: "ILS", TR: "TRY", IS: "ISK", RO: "RON",
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
};

export const currencyFor = (country) => CURRENCY_BY_COUNTRY[country] ?? "AUD";

/**
 * Country for display currency. Prefers the host's IP geolocation (GEO_COUNTRY_HEADER, Vercel or
 * Cloudflare), then the browser's time zone and language. Only affects how prices are shown.
 */
export function displayCountry(req) {
  for (const name of [process.env.GEO_COUNTRY_HEADER, "x-vercel-ip-country", "cf-ipcountry"]) {
    const value = name ? String(req.headers[name.toLowerCase()] ?? "").trim() : "";
    if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  }
  return viewerCountry(req);
}

const historyCache = new Map();
const fxCache = new Map();

async function closes(code) {
  const hit = historyCache.get(code);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.value;
  const result = (await fetchJson(CHART_URL(code), { retries: 1, timeout: 12_000 }))?.chart?.result?.[0];
  const stamps = result?.timestamp ?? [];
  const prices = result?.indicators?.quote?.[0]?.close ?? [];
  const toDate = (s) => new Date(s * 1000).toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const points = stamps.map((s, i) => ({ date: toDate(s), close: prices[i] })).filter((p) => Number.isFinite(p.close));
  // The feed can repeat today's session; keep the latest close per day.
  const byDate = [...new Map(points.map((p) => [p.date, p])).values()];
  const value = { name: result?.meta?.longName ?? result?.meta?.shortName ?? null, points: byDate };
  historyCache.set(code, { at: Date.now(), value });
  return value;
}

async function audTo(currency) {
  const hit = fxCache.get(currency);
  if (hit && Date.now() - hit.at < FX_TTL_MS) return hit.value;
  const d = await fetchJson(FX_URL(currency), { retries: 1, timeout: 10_000 });
  const rate = d?.rates?.[currency];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No AUD/${currency} rate`);
  const value = { rate, date: d.date, source: "European Central Bank via Frankfurter" };
  fxCache.set(currency, { at: Date.now(), value });
  return value;
}

/** Daily closes for the past year, converted for this viewer. Throws when the price feed fails. */
export async function priceHistory(code, country) {
  const { name, points } = await closes(code);
  if (!points.length) throw Object.assign(new Error(`No price history for ${code}.`), { status: 404, code: "NO_HISTORY" });
  let currency = currencyFor(country);
  let fx = null;
  let fxError = null;
  if (currency !== "AUD") {
    try {
      fx = await audTo(currency);
    } catch (err) {
      fxError = `Shown in AUD: no exchange rate for ${currency} (${err.message}).`;
      currency = "AUD";
    }
  }
  const round = (v) => Math.round(v * 10_000) / 10_000;
  return {
    code,
    name,
    country: country ?? null,
    currency,
    fx,
    ...(fxError ? { fxError } : {}),
    asOf: new Date().toISOString(),
    source: "Yahoo Finance (delayed daily closes)",
    points: points.map((p) => ({ date: p.date, close: round(fx ? p.close * fx.rate : p.close) })),
  };
}
