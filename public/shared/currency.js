// AUD to USD Currency Converter and exchange rate utilities.
// All business amounts default to AUD whole numbers (Math.ceil, no decimals).
// Currency conversions (USD) display a maximum of 2 decimal places.
// All invoices and transactions are processed strictly in Australian Dollars (AUD).

export const DEFAULT_AUD_TO_USD_RATE = 0.65;

let cachedRate = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch the latest AUD to USD exchange rate from public FX APIs.
 * Falls back gracefully to cached rate or DEFAULT_AUD_TO_USD_RATE on network error or timeout.
 */
export async function fetchAudToUsdRate() {
  const now = Date.now();
  if (cachedRate && now - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("aud_to_usd_rate_cache") : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.rate > 0 && now - parsed.time < CACHE_TTL_MS) {
        cachedRate = parsed.rate;
        cachedAt = parsed.time;
        return cachedRate;
      }
    }
  } catch (_) {}

  // 1. Primary: open.er-api.com
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/AUD", {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.rates?.USD === "number" && data.rates.USD > 0) {
        const rate = Math.round(data.rates.USD * 10000) / 10000;
        cachedRate = rate;
        cachedAt = now;
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("aud_to_usd_rate_cache", JSON.stringify({ rate, time: now }));
          }
        } catch (_) {}
        return rate;
      }
    }
  } catch (_) {}

  // 2. Secondary fallback: api.frankfurter.dev
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=AUD&symbols=USD", {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.rates?.USD === "number" && data.rates.USD > 0) {
        const rate = Math.round(data.rates.USD * 10000) / 10000;
        cachedRate = rate;
        cachedAt = now;
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("aud_to_usd_rate_cache", JSON.stringify({ rate, time: now }));
          }
        } catch (_) {}
        return rate;
      }
    }
  } catch (_) {}

  return cachedRate || DEFAULT_AUD_TO_USD_RATE;
}

/**
 * Converts AUD into USD.
 * - exactUsd: formatted to at most 2 decimal places.
 * - wholeUsd: rounded up (Math.ceil) to enforce the whole numbers rule for catalog pricing.
 */
export function convertAudToUsd(audAmount, rate = cachedRate || DEFAULT_AUD_TO_USD_RATE) {
  const aud = Math.max(0, Number(audAmount) || 0);
  const rawUsd = aud * rate;
  const exactUsd = Math.round(rawUsd * 100) / 100;
  const wholeUsd = Math.max(1, Math.ceil(rawUsd));
  return {
    aud,
    rate,
    exactUsd,
    exactUsdFormatted: exactUsd.toFixed(2),
    wholeUsd,
  };
}

/**
 * Converts USD into AUD.
 * - exactAud: formatted to at most 2 decimal places.
 * - wholeAud: rounded up (Math.ceil) to enforce the whole numbers rule.
 */
export function convertUsdToAud(usdAmount, rate = cachedRate || DEFAULT_AUD_TO_USD_RATE) {
  const usd = Math.max(0, Number(usdAmount) || 0);
  const rawAud = rate > 0 ? usd / rate : 0;
  const exactAud = Math.round(rawAud * 100) / 100;
  const wholeAud = Math.max(1, Math.ceil(rawAud));
  return {
    usd,
    rate,
    exactAud,
    exactAudFormatted: exactAud.toFixed(2),
    wholeAud,
  };
}

/** Formats an AUD amount as strict whole dollars rounded up (Math.ceil). */
export function formatAud(amount) {
  const n = Math.ceil(Math.max(0, Number(amount) || 0));
  return `$${n} AUD`;
}

/** Formats a USD amount with a maximum of 2 decimal places. */
export function formatUsd(amount) {
  const n = Math.max(0, Number(amount) || 0);
  const rounded = (Math.round(n * 100) / 100).toFixed(2);
  return `$${rounded} USD`;
}
