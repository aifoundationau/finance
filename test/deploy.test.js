import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../src/config.js";
import { ADMIN_COOKIE, adminIdentity, authMode, googleCallback, googleStart, login, sign, verify } from "../src/admin.js";
import { MemoryBackend, _useBackendForTests, parseServiceAccount, storage } from "../src/storage.js";
import { IDLE_RUN, getRun, startRun } from "../src/runs.js";
import { _defaultState, _resetForTests, ensureWallet } from "../src/commerce.js";

const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SUPERADMIN_EMAILS", "SUPERADMIN_PASSWORD", "SESSION_SECRET"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function env(values) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, values);
}
const GOOGLE = { GOOGLE_CLIENT_ID: "client-1.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "secret", SUPERADMIN_EMAILS: "Boss@Example.com, ops@example.com", SESSION_SECRET: "s".repeat(40) };

const req = (cookies = {}, headers = {}) => ({
  headers: { host: "finance.example.com", "x-forwarded-proto": "https", cookie: Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "), ...headers },
  socket: { remoteAddress: "203.0.113.9" },
});
const cookieValue = (setCookie, name) => decodeURIComponent(setCookie.match(new RegExp(`${name}=([^;]*)`))[1]);

beforeEach(() => env({}));
test.after(() => env(Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined))));

// ------------------------------------------------------------------ sessions

test("signed tokens reject tampering and expiry", () => {
  env({ SESSION_SECRET: "k".repeat(40) });
  const token = sign({ sub: "a@example.com", exp: Date.now() + 60_000 });
  assert.equal(verify(token).sub, "a@example.com");
  const [payload, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "evil@example.com", exp: Date.now() + 60_000 })).toString("base64url");
  assert.equal(verify(`${forged}.${mac}`), null);
  assert.equal(verify(`${payload}.${mac}x`), null);
  assert.equal(verify(sign({ sub: "a", exp: Date.now() - 1 })), null);
  assert.equal(verify("garbage"), null);
});

test("Google sign-in takes precedence over the password once fully configured", () => {
  env({ SUPERADMIN_PASSWORD: "pw" });
  assert.equal(authMode(), "password");
  env({ ...GOOGLE, SUPERADMIN_PASSWORD: "pw" });
  assert.equal(authMode(), "google");
  assert.throws(() => login(req(), "pw"), { status: 400, code: "USE_GOOGLE_SIGN_IN" });
  env({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y" }); // no superadmin emails: not usable
  assert.equal(authMode(), null);
});

test("password sessions stop counting when Google sign-in is switched on", () => {
  env({ SUPERADMIN_PASSWORD: "pw", SESSION_SECRET: "k".repeat(40) });
  const session = cookieValue(login(req(), "pw"), ADMIN_COOKIE);
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), "password");
  env({ ...GOOGLE, SESSION_SECRET: "k".repeat(40) });
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), null);
});

// ------------------------------------------------------------------ Google OAuth

function startAttempt() {
  const { location, cookies } = googleStart(req());
  const url = new URL(location);
  return { url, attempt: cookieValue(cookies[0], "mao_oauth") };
}

const idToken = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const googleReplies = (claims, ok = true) => async (_url, init) => {
  googleReplies.lastBody = new URLSearchParams(init.body);
  return { ok, status: ok ? 200 : 400, json: async () => (ok ? { id_token: idToken(claims) } : { error: "invalid_grant" }) };
};
const goodClaims = (email = "boss@example.com") => ({ iss: "https://accounts.google.com", aud: GOOGLE.GOOGLE_CLIENT_ID, exp: Date.now() / 1000 + 300, email, email_verified: true });

test("googleStart sends PKCE, state and the callback on this host", () => {
  env(GOOGLE);
  const { url } = startAttempt();
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), GOOGLE.GOOGLE_CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), "https://finance.example.com/auth/google/callback");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "openid email");
  assert.ok(url.searchParams.get("state"));
});

test("a listed, verified Google account becomes superadmin", async () => {
  env(GOOGLE);
  const { url, attempt } = startAttempt();
  const callback = new URL(`https://finance.example.com/auth/google/callback?code=abc&state=${url.searchParams.get("state")}`);
  const { email, cookies } = await googleCallback(req({ mao_oauth: attempt }), callback, { fetchImpl: googleReplies(goodClaims("Boss@Example.com")) });
  assert.equal(email, "boss@example.com");
  assert.equal(googleReplies.lastBody.get("code_verifier"), verify(attempt).verifier);
  assert.equal(googleReplies.lastBody.get("redirect_uri"), "https://finance.example.com/auth/google/callback");
  const session = cookieValue(cookies.find((c) => c.startsWith(ADMIN_COOKIE)), ADMIN_COOKIE);
  assert.match(cookies.find((c) => c.startsWith(ADMIN_COOKIE)), /HttpOnly; SameSite=Strict; Secure/);
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), "boss@example.com");
  // Removing the address from SUPERADMIN_EMAILS ends the session.
  env({ ...GOOGLE, SUPERADMIN_EMAILS: "ops@example.com" });
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), null);
});

test("Google sign-in refuses unlisted accounts, wrong audience, unverified email and bad state", async () => {
  env(GOOGLE);
  const { url, attempt } = startAttempt();
  const state = url.searchParams.get("state");
  const cb = (s = state) => new URL(`https://finance.example.com/auth/google/callback?code=abc&state=${s}`);
  const cookies = req({ mao_oauth: attempt });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies(goodClaims("stranger@example.com")) }), { status: 403, code: "NOT_SUPERADMIN" });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies({ ...goodClaims(), aud: "other-app" }) }), { code: "OAUTH_BAD_TOKEN" });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies({ ...goodClaims(), email_verified: false }) }), { code: "EMAIL_NOT_VERIFIED" });
  await assert.rejects(googleCallback(cookies, cb("forged"), { fetchImpl: googleReplies(goodClaims()) }), { code: "OAUTH_STATE_MISMATCH" });
  await assert.rejects(googleCallback(req(), cb(), { fetchImpl: googleReplies(goodClaims()) }), { code: "OAUTH_STATE_MISMATCH" });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies(goodClaims(), false) }), { code: "OAUTH_TOKEN_FAILED" });
});

// ------------------------------------------------------------------ runs and storage

test("a fresh run holds the lock; a stale one does not", async () => {
  _useBackendForTests(new MemoryBackend());
  const startedAt = new Date().toISOString();
  await storage().put("runtime", "run", { ...IDLE_RUN, running: true, mode: "standard", startedAt, label: "Working" });
  assert.equal((await startRun("standard", "manual")).started, false);
  assert.equal((await getRun()).running, true);

  await storage().put("runtime", "run", { ...IDLE_RUN, running: true, startedAt: new Date(Date.now() - 10 * 60_000).toISOString() });
  const stale = await getRun();
  assert.equal(stale.running, false);
  assert.match(stale.error, /timed out/);
});

test("file storage keeps the original data/ layout and serialises transactions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mao-storage-"));
  Object.assign(config, { dataDir: dir, reportsDir: path.join(dir, "reports") });
  _useBackendForTests(null);
  const files = storage();
  assert.equal(files.kind, "files");
  await Promise.all(Array.from({ length: 20 }, () => files.transact("app", "counter", async (n) => ({ value: (n ?? 0) + 1, result: null }))));
  assert.equal(await files.get("app", "counter"), 20);
  assert.ok(fs.existsSync(path.join(dir, "counter.json")));
  await files.put("reports", "2026-10-22-standard", { id: "x" });
  assert.deepEqual((await files.list("reports")).map((d) => d.id), ["2026-10-22-standard"]);
  // A throwing transaction writes nothing.
  await assert.rejects(files.transact("app", "counter", async () => { throw new Error("no"); }));
  assert.equal(await files.get("app", "counter"), 20);
});

test("service-account keys are accepted as JSON or base64", () => {
  const key = { project_id: "ai-foundation-firebase", client_email: "x@y.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\n" };
  assert.equal(parseServiceAccount(JSON.stringify(key)).project_id, "ai-foundation-firebase");
  assert.equal(parseServiceAccount(Buffer.from(JSON.stringify(key)).toString("base64")).client_email, key.client_email);
  assert.throws(() => parseServiceAccount(JSON.stringify({ project_id: "p" })), /service-account key/);
});

test("no wallet is created while the token system is off", async () => {
  const off = _defaultState();
  off.settings.isTokenSystemEnabled = false;
  _resetForTests(off);
  assert.deepEqual(await ensureWallet(undefined), { wallet: null, created: false });
  const forced = await ensureWallet(undefined, { create: true });
  assert.equal(forced.created, true);
  assert.equal((await ensureWallet(forced.wallet.id)).wallet.id, forced.wallet.id);
});
