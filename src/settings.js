import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export const DEFAULT_SETTINGS = {
  watchlist: [],
  // 6pm Sydney: after the ASX close, so the day's announcements and price reactions are in.
  schedule: { enabled: true, time: "18:00", runOnStartup: true, ai: false },
  thresholds: { austenderAsxMin: 100_000, austenderOverseasMin: 1_000_000, austenderMajorMin: 20_000_000 },
  sources: { austender: true, asxAnnouncements: true, readAnnouncementPdfs: true, news: true, market: true, austenderTenders: false },
  includeLocalGovernment: false,
  ai: { maxSearches: 12, effort: "high" },
};

const settingsFile = () => path.join(config.dataDir, "settings.json");

function merge(base, patch) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!(key in base)) continue;
    const nested = value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key]);
    out[key] = nested ? merge(base[key], value) : value;
  }
  return out;
}

function sanitize(s) {
  const D = DEFAULT_SETTINGS;
  const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
  const num = (v, fallback, min, max) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Math.min(max, Math.max(min, Number(v))) : fallback);
  const codes = (Array.isArray(s.watchlist) ? s.watchlist : []).map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z0-9]{3,6}$/.test(c));
  return {
    watchlist: [...new Set(codes)].slice(0, 100),
    schedule: {
      enabled: bool(s.schedule?.enabled, D.schedule.enabled),
      time: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.schedule?.time ?? "") ? s.schedule.time : D.schedule.time,
      runOnStartup: bool(s.schedule?.runOnStartup, D.schedule.runOnStartup),
      ai: bool(s.schedule?.ai, D.schedule.ai),
    },
    thresholds: {
      austenderAsxMin: num(s.thresholds?.austenderAsxMin, D.thresholds.austenderAsxMin, 0, 1e10),
      austenderOverseasMin: num(s.thresholds?.austenderOverseasMin, D.thresholds.austenderOverseasMin, 0, 1e10),
      austenderMajorMin: num(s.thresholds?.austenderMajorMin, D.thresholds.austenderMajorMin, 0, 1e11),
    },
    sources: Object.fromEntries(Object.keys(D.sources).map((k) => [k, bool(s.sources?.[k], D.sources[k])])),
    includeLocalGovernment: bool(s.includeLocalGovernment, D.includeLocalGovernment),
    ai: {
      maxSearches: Math.round(num(s.ai?.maxSearches, D.ai.maxSearches, 1, 30)),
      effort: ["low", "medium", "high", "xhigh", "max"].includes(s.ai?.effort) ? s.ai.effort : D.ai.effort,
    },
  };
}

export async function loadSettings() {
  try {
    return sanitize(merge(DEFAULT_SETTINGS, JSON.parse(await fs.readFile(settingsFile(), "utf8"))));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function saveSettings(patch) {
  const next = sanitize(merge(await loadSettings(), patch));
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}
