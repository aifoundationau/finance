// Superadmin sessions: one password from SUPERADMIN_PASSWORD, HttpOnly session cookies, and a
// simple per-address login rate limit. Sessions live in memory (a restart logs everyone out).
import crypto from "node:crypto";

const SESSION_MS = 12 * 3_600_000;
const sessions = new Map(); // token -> expiry
const attempts = new Map(); // address -> { count, resetAt }

export const ADMIN_COOKIE = "mao_admin";
export const WALLET_COOKIE = "mao_wallet";

export const adminConfigured = () => Boolean(process.env.SUPERADMIN_PASSWORD);

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

export function cookie(name, value, { maxAge, sameSite = "Strict" } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${sameSite}${maxAge !== undefined ? `; Max-Age=${maxAge}` : ""}`;
}

const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();

export function isAdmin(req) {
  const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE];
  const expiry = token && sessions.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** Returns a session token, or throws with status 401/429. */
export function login(password, address) {
  const now = Date.now();
  const entry = attempts.get(address) ?? { count: 0, resetAt: now + 60_000 };
  if (entry.resetAt < now) Object.assign(entry, { count: 0, resetAt: now + 60_000 });
  if (entry.count >= 5) throw Object.assign(new Error("Too many attempts; wait a minute."), { status: 429 });
  entry.count += 1;
  attempts.set(address, entry);
  if (!adminConfigured()) throw Object.assign(new Error("Set SUPERADMIN_PASSWORD in .env and restart the app."), { status: 503 });
  if (!crypto.timingSafeEqual(digest(password), digest(process.env.SUPERADMIN_PASSWORD))) {
    throw Object.assign(new Error("Wrong password."), { status: 401 });
  }
  attempts.delete(address);
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, now + SESSION_MS);
  return { token, maxAge: SESSION_MS / 1000 };
}

export function logout(req) {
  const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE];
  if (token) sessions.delete(token);
}
