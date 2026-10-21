// Superadmin sign-in and sessions.
//   Google  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + SUPERADMIN_EMAILS: OAuth 2.0 authorization
//           code flow with PKCE; only the listed, Google-verified addresses become superadmin.
//   Password  SUPERADMIN_PASSWORD, used only when Google sign-in is not configured (local use).
// Sessions are signed, HttpOnly cookies (HMAC-SHA256) rather than server memory, so every server
// instance accepts them; they expire after 12 hours.
import crypto from "node:crypto";

const SESSION_MS = 12 * 3_600_000;
const OAUTH_STATE_MS = 10 * 60_000;
const attempts = new Map(); // address -> { count, resetAt }

export const ADMIN_COOKIE = "mao_admin";
export const WALLET_COOKIE = "mao_wallet";
const OAUTH_COOKIE = "mao_oauth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export class AuthError extends Error {
  constructor(message, status = 401, code) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

const superadminEmails = () =>
  new Set(
    String(process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

/** "google", "password" or null (no superadmin access configured). */
export function authMode() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && superadminEmails().size) return "google";
  if (process.env.SUPERADMIN_PASSWORD) return "password";
  return null;
}
export const adminConfigured = () => authMode() !== null;

// ------------------------------------------------------------------ cookies

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

export function cookie(name, value, { maxAge, sameSite = "Strict", secure = false, path = "/" } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}${maxAge !== undefined ? `; Max-Age=${maxAge}` : ""}`;
}

/** True when the request reached us over HTTPS (directly or via the host's proxy). */
export const isHttps = (req) => String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https" || Boolean(req.socket?.encrypted);

// ------------------------------------------------------------------ signed tokens

// SESSION_SECRET signs cookies. Without it, a key is derived from GOOGLE_CLIENT_SECRET (random
// and private, so safe to derive from); failing both, a per-process key is used, which means a
// restart signs everyone out. The password is never used as a key: it may be guessable.
let processKey = null;
function signingKey() {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
  if (process.env.GOOGLE_CLIENT_SECRET) return Buffer.from(crypto.hkdfSync("sha256", process.env.GOOGLE_CLIENT_SECRET, "my-asx-options", "session-signing", 32));
  processKey ??= crypto.randomBytes(32);
  return processKey;
}

const mac = (payload) => crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");

export function sign(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

/** The signed data, or null when the token is malformed, tampered with or expired. */
export function verify(token) {
  const [payload, signature, extra] = String(token ?? "").split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(data.exp) && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function sessionCookie(req, subject) {
  return cookie(ADMIN_COOKIE, sign({ sub: subject, exp: Date.now() + SESSION_MS }), { maxAge: SESSION_MS / 1000, secure: isHttps(req) });
}

/** The signed-in superadmin ("password" or a Google email), or null. */
export function adminIdentity(req) {
  const session = verify(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
  if (!session) return null;
  // A session only counts under the sign-in method that issued it, and a Google session only
  // while its address is still listed.
  const mode = authMode();
  if (mode === "password" && session.sub === "password") return session.sub;
  if (mode === "google" && superadminEmails().has(session.sub)) return session.sub;
  return null;
}
export const isAdmin = (req) => adminIdentity(req) !== null;

export const logoutCookie = (req) => cookie(ADMIN_COOKIE, "", { maxAge: 0, secure: isHttps(req) });

// ------------------------------------------------------------------ password (local use)

/** Returns the Set-Cookie header for a new session, or throws 401/429/400. */
export function login(req, password) {
  const address = req.socket?.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = attempts.get(address) ?? { count: 0, resetAt: now + 60_000 };
  if (entry.resetAt < now) Object.assign(entry, { count: 0, resetAt: now + 60_000 });
  if (entry.count >= 5) throw new AuthError("Too many attempts; wait a minute.", 429);
  entry.count += 1;
  attempts.set(address, entry);
  const mode = authMode();
  if (mode === "google") throw new AuthError("This app uses Google sign-in for the superadmin.", 400, "USE_GOOGLE_SIGN_IN");
  if (!mode) throw new AuthError("Superadmin access is not configured. See README.", 503);
  const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();
  if (!crypto.timingSafeEqual(digest(password), digest(process.env.SUPERADMIN_PASSWORD))) throw new AuthError("Wrong password.");
  attempts.delete(address);
  return sessionCookie(req, "password");
}

// ------------------------------------------------------------------ Google (OAuth 2.0 + PKCE)

const origin = (req) => `${isHttps(req) ? "https" : "http"}://${String(req.headers.host)}`;
export const googleRedirectUri = (req) => `${origin(req)}/auth/google/callback`;

/** Where to send the browser to start Google sign-in, plus the cookie that remembers the attempt. */
export function googleStart(req) {
  if (authMode() !== "google") throw new AuthError("Google sign-in is not configured.", 503, "GOOGLE_NOT_CONFIGURED");
  const state = crypto.randomBytes(16).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(req),
    response_type: "code",
    scope: "openid email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  // Lax, so the cookie comes back on Google's top-level redirect to the callback.
  const attempt = cookie(OAUTH_COOKIE, sign({ state, verifier, exp: Date.now() + OAUTH_STATE_MS }), {
    maxAge: OAUTH_STATE_MS / 1000, sameSite: "Lax", secure: isHttps(req), path: "/auth/google",
  });
  return { location: url.toString(), cookies: [attempt] };
}

/** Completes sign-in from Google's redirect. Returns { email, cookies } or throws AuthError. */
export async function googleCallback(req, url, { fetchImpl = fetch } = {}) {
  const clearAttempt = cookie(OAUTH_COOKIE, "", { maxAge: 0, sameSite: "Lax", secure: isHttps(req), path: "/auth/google" });
  if (url.searchParams.get("error")) throw new AuthError(`Google sign-in was cancelled (${url.searchParams.get("error")}).`, 401, "GOOGLE_CANCELLED");
  const attempt = verify(parseCookies(req.headers.cookie)[OAUTH_COOKIE]);
  const state = url.searchParams.get("state");
  if (!attempt || !state || attempt.state !== state) throw new AuthError("Sign-in expired or came from another browser. Try again.", 400, "OAUTH_STATE_MISMATCH");
  const code = url.searchParams.get("code");
  if (!code) throw new AuthError("Google did not return a sign-in code.", 400, "OAUTH_NO_CODE");

  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(req),
      grant_type: "authorization_code",
      code_verifier: attempt.verifier,
    }),
  });
  const tokens = await res.json().catch(() => ({}));
  if (!res.ok || !tokens.id_token) throw new AuthError(`Google rejected the sign-in (${tokens.error ?? res.status}).`, 401, "OAUTH_TOKEN_FAILED");

  // The ID token came straight from Google's token endpoint over TLS, so its claims can be read
  // without re-checking the signature; the audience, issuer and expiry are still checked.
  let claims;
  try {
    claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    throw new AuthError("Google returned an unreadable ID token.", 401, "OAUTH_BAD_TOKEN");
  }
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID || !GOOGLE_ISSUERS.has(claims.iss) || !(claims.exp * 1000 > Date.now())) {
    throw new AuthError("Google's ID token is not for this app.", 401, "OAUTH_BAD_TOKEN");
  }
  const email = String(claims.email ?? "").toLowerCase();
  if (!email || claims.email_verified !== true) throw new AuthError("Your Google address is not verified.", 403, "EMAIL_NOT_VERIFIED");
  if (!superadminEmails().has(email)) throw new AuthError(`${email} is not a superadmin of this app.`, 403, "NOT_SUPERADMIN");
  return { email, cookies: [clearAttempt, sessionCookie(req, email)] };
}

export const clearOAuthCookie = (req) => cookie(OAUTH_COOKIE, "", { maxAge: 0, sameSite: "Lax", secure: isHttps(req), path: "/auth/google" });
