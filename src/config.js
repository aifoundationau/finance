import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn(`[config] Could not load .env: ${err.message}`);
  }
}

// On Vercel the app runs as a serverless function: no long-lived process, a read-only file
// system apart from /tmp, and scheduling through Vercel Cron instead of an in-process timer.
const serverless = Boolean(process.env.VERCEL);

export const config = {
  serverless,
  port: Number.parseInt(process.env.PORT ?? "3000", 10) || 3000,
  host: process.env.HOST || "127.0.0.1",
  timezone: "Australia/Sydney",
  dataDir: path.join(ROOT, "data"),
  reportsDir: path.join(ROOT, "data", "reports"),
  // Source caches (ASX company list, options availability) are disposable, so /tmp will do.
  cacheDir: serverless ? path.join(os.tmpdir(), "my-asx-options-cache") : path.join(ROOT, "data", "cache"),
  publicDir: path.join(ROOT, "public"),
  userAgent: "MYASXOptions/1.0 (personal market research; Node.js)",
  // Only sent to sources that refuse non-browser clients, and only after the user opts in.
  browserUserAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

/**
 * Public host names the server answers to besides localhost: ALLOWED_HOSTS (comma-separated,
 * for custom domains) plus the deployment domains Vercel provides in its system variables.
 */
export const allowedHosts = new Set(
  [process.env.ALLOWED_HOSTS, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .flatMap((v) => (v ?? "").split(","))
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[:/].*$/, ""))
    .filter(Boolean),
);

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * True when people other than this computer's user can reach the app. Settings and report runs
 * then need the superadmin, since runs cost money (AI mode) and settings are shared.
 */
export const publicDeployment = serverless || allowedHosts.size > 0 || !LOOPBACK.has(config.host);

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
