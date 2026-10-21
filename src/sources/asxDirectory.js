import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { fetchText } from "../lib/http.js";
import { parseCsv } from "../lib/csv.js";

// The directory CSV behind asx.com.au's company search (includes market cap), with the older
// ASX research CSV as a fallback.
const MARKIT_URL = "https://asx.api.markitdigital.com/asx-research/1.0/companies/directory/file?access_token=83ff96335c2d45a094df02a206a39ff4";
const LEGACY_URL = "https://www.asx.com.au/asx/research/ASXListedCompanies.csv";
const MAX_AGE_MS = 20 * 3_600_000;
const CODE_RE = /^[A-Z0-9]{3,6}$/;

function parseMarkit(text) {
  const rows = parseCsv(text);
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  const col = (name) => header.findIndex((h) => h.startsWith(name));
  const [iCode, iName, iIndustry, iListed, iCap] = [col("asx code"), col("company name"), col("gics"), col("listing date"), col("market cap")];
  return rows
    .map((r) => ({
      code: r[iCode]?.trim(),
      name: r[iName]?.trim(),
      industry: r[iIndustry]?.trim() || null,
      listed: r[iListed]?.trim() || null,
      marketCap: Number(r[iCap]) || null,
    }))
    .filter((c) => CODE_RE.test(c.code ?? "") && c.name);
}

function parseLegacy(text) {
  const rows = parseCsv(text);
  const start = rows.findIndex((r) => r[0]?.trim().toLowerCase() === "company name");
  return rows
    .slice(start + 1)
    .map((r) => ({ name: r[0]?.trim(), code: r[1]?.trim(), industry: r[2]?.trim() || null, listed: null, marketCap: null }))
    .filter((c) => CODE_RE.test(c.code ?? "") && c.name);
}

/** Current ASX listed companies, cached for ~a day. Falls back to a stale cache if offline. */
export async function loadAsxDirectory({ force = false } = {}) {
  const file = path.join(config.cacheDir, "asx-directory.json");
  let cached = null;
  try {
    cached = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    // no cache yet
  }
  if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < MAX_AGE_MS) return { ...cached, fromCache: true };

  const errors = [];
  for (const [source, url, parse] of [["asx.com.au directory", MARKIT_URL, parseMarkit], ["ASX listed companies CSV", LEGACY_URL, parseLegacy]]) {
    try {
      const companies = parse(await fetchText(url, { timeout: 30_000 }));
      if (companies.length < 500) throw new Error(`only ${companies.length} rows`);
      const data = { fetchedAt: new Date().toISOString(), source, companies };
      await fs.mkdir(config.cacheDir, { recursive: true });
      await fs.writeFile(file, JSON.stringify(data));
      return { ...data, fromCache: false };
    } catch (err) {
      errors.push(`${source}: ${err.message}`);
    }
  }
  if (cached) return { ...cached, fromCache: true, stale: true, errors };
  throw new Error(`ASX company list unavailable (${errors.join("; ")})`);
}
