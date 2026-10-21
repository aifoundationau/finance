import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { fetchJson, mapLimit } from "../lib/http.js";

const BASE = "https://asx.api.markitdigital.com/asx-research/1.0/companies";
const OPTIONS_TTL_MS = 3 * 86_400_000;
const cacheFile = () => path.join(config.cacheDir, "options-availability.json");

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(cacheFile(), "utf8"));
  } catch {
    return {};
  }
}

/**
 * Latest quote (delayed) and exchange-traded options availability for each ASX code.
 * Options availability changes rarely, so it is cached for a few days.
 */
export async function fetchMarketData(codes) {
  const unique = [...new Set(codes)].filter((c) => /^[A-Z0-9]{3,6}$/.test(c));
  const optionsCache = await readCache();
  const out = {};
  await mapLimit(unique, 4, async (code) => {
    const entry = { code, asOf: new Date().toISOString() };
    try {
      const d = (await fetchJson(`${BASE}/${code}/header`, { retries: 1, timeout: 12_000 }))?.data ?? {};
      Object.assign(entry, {
        name: d.displayName ?? null,
        price: d.priceLast ?? null,
        change: d.priceChange ?? null,
        // Before the open (no trades yet) the feed reports 0%; treat that as "no move yet".
        changePct: Number.isFinite(d.priceChangePercent) && d.volume > 0 ? d.priceChangePercent : null,
        volume: d.volume ?? null,
        marketCap: d.marketCap ?? null,
        sector: d.sector ?? null,
      });
    } catch (err) {
      entry.quoteError = err.message;
    }
    const cached = optionsCache[code];
    if (cached && Date.now() - Date.parse(cached.checkedAt) < OPTIONS_TTL_MS) {
      entry.options = cached;
    } else {
      try {
        const dates = (await fetchJson(`${BASE}/${code}/options`, { retries: 1, timeout: 15_000 }))?.data?.datesAvailable ?? {};
        const expiries = [...(dates.weekly ?? []), ...(dates.monthly ?? []), ...(dates.quarterly ?? [])].sort();
        entry.options = optionsCache[code] = {
          available: expiries.length > 0,
          monthly: dates.monthly?.length ?? 0,
          weekly: dates.weekly?.length ?? 0,
          quarterly: dates.quarterly?.length ?? 0,
          nextExpiry: expiries[0] ?? null,
          checkedAt: new Date().toISOString(),
        };
      } catch {
        entry.options = null;
      }
    }
    out[code] = entry;
  });
  await fs.mkdir(config.cacheDir, { recursive: true });
  await fs.writeFile(cacheFile(), JSON.stringify(optionsCache));
  return out;
}
