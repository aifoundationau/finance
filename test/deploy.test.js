import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../src/config.js";
import {
  ADMIN_COOKIE, USER_COOKIE, adminIdentity, authMode, currentUser, googleCallback, googleConfigured, googleStart, login, oauthReturnTo, sign,
  signInCookies, signOutCookies, verify,
} from "../src/admin.js";
import { MemoryBackend, _useBackendForTests, parseServiceAccount, storage } from "../src/storage.js";
import { firebaseDirectory, registerUser } from "../src/users.js";
import { IDLE_RUN, getRun, startRun } from "../src/runs.js";
import { _defaultState, _resetForTests, ensureWallet } from "../src/commerce.js";

// FIREBASE_SERVICE_ACCOUNT too, so a .env pointing at Firestore never sends test writes there.
const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SUPERADMIN_EMAILS", "SUPERADMIN_PASSWORD", "SESSION_SECRET", "FIREBASE_SERVICE_ACCOUNT"];
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
  env({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y" }); // no superadmin emails: people can sign in, nobody is superadmin
  assert.equal(authMode(), null);
  assert.equal(googleConfigured(), true);
});

test("password sessions stop counting when Google sign-in is switched on", () => {
  env({ SUPERADMIN_PASSWORD: "pw", SESSION_SECRET: "k".repeat(40) });
  const session = cookieValue(login(req(), "pw"), ADMIN_COOKIE);
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), "password");
  env({ ...GOOGLE, SESSION_SECRET: "k".repeat(40) });
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), null);
});

// ------------------------------------------------------------------ Google OAuth

function startAttempt(returnTo) {
  const { location, cookies } = googleStart(req(), { returnTo });
  const url = new URL(location);
  return { url, attempt: cookieValue(cookies[0], "mao_oauth") };
}

const idToken = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const googleReplies = (claims, ok = true) => async (_url, init) => {
  googleReplies.lastBody = new URLSearchParams(init.body);
  return { ok, status: ok ? 200 : 400, json: async () => (ok ? { id_token: idToken(claims) } : { error: "invalid_grant" }) };
};
const goodClaims = (email = "boss@example.com") => ({
  iss: "https://accounts.google.com", aud: GOOGLE.GOOGLE_CLIENT_ID, exp: Date.now() / 1000 + 300, sub: "1087", email, email_verified: true,
  name: "Pat Lee", picture: "https://lh3.googleusercontent.com/a/pat",
});

test("googleStart sends PKCE, state and the callback on this host", () => {
  env(GOOGLE);
  const { url, attempt } = startAttempt("confirmed");
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), GOOGLE.GOOGLE_CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), "https://finance.example.com/auth/google/callback");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.ok(url.searchParams.get("state"));
  assert.equal(oauthReturnTo(req({ mao_oauth: attempt })), "confirmed");
  assert.equal(oauthReturnTo(req({ mao_oauth: startAttempt("https://evil.example").attempt })), "");
});

test("Google sign-in needs only the client ID and secret", () => {
  env({ GOOGLE_CLIENT_ID: GOOGLE.GOOGLE_CLIENT_ID, SESSION_SECRET: GOOGLE.SESSION_SECRET });
  assert.throws(() => googleStart(req()), { status: 503, code: "GOOGLE_NOT_CONFIGURED" });
  env({ GOOGLE_CLIENT_ID: GOOGLE.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: "secret", SESSION_SECRET: GOOGLE.SESSION_SECRET });
  assert.ok(startAttempt().url);
});

/** Runs the callback for `claims` and signs the person in as `role`. */
async function signInAs(claims, role = "supporter", returnTo) {
  const { url, attempt } = startAttempt(returnTo);
  const callback = new URL(`https://finance.example.com/auth/google/callback?code=abc&state=${url.searchParams.get("state")}`);
  const { profile, returnTo: back } = await googleCallback(req({ mao_oauth: attempt }), callback, { fetchImpl: googleReplies(claims) });
  return { profile, returnTo: back, attempt, ...signInCookies(req(), { uid: `u-${profile.sub}`, email: profile.email, name: profile.name, role }) };
}

test("any verified Google account signs in as a user; only listed ones also become superadmin", async () => {
  env(GOOGLE);
  const visitor = await signInAs(goodClaims("Stranger@Example.com"), "supporter", "upcoming");
  assert.deepEqual(visitor.profile, { sub: "1087", email: "stranger@example.com", name: "Pat Lee", picture: "https://lh3.googleusercontent.com/a/pat" });
  assert.equal(visitor.returnTo, "upcoming");
  assert.equal(visitor.superadmin, false);
  assert.equal(visitor.cookies.some((c) => c.startsWith(`${ADMIN_COOKIE}=`)), false);
  const userCookie = visitor.cookies.find((c) => c.startsWith(`${USER_COOKIE}=`));
  assert.match(userCookie, /HttpOnly; SameSite=Lax; Secure/);
  assert.deepEqual(currentUser(req({ [USER_COOKIE]: cookieValue(userCookie, USER_COOKIE) })), { uid: "u-1087", email: "stranger@example.com", name: "Pat Lee", role: "supporter" });
  assert.equal(currentUser(req({ [USER_COOKIE]: "forged.value" })), null);
  // Signing out clears both sessions.
  assert.deepEqual(signOutCookies(req()).map((c) => [c.split("=")[0], /Max-Age=0/.test(c)]), [[USER_COOKIE, true], [ADMIN_COOKIE, true]]);
  // A picture that isn't https is dropped.
  assert.equal((await signInAs({ ...goodClaims(), picture: "javascript:alert(1)" })).profile.picture, "");
});

test("a listed, verified Google account becomes superadmin", async () => {
  env(GOOGLE);
  const { cookies, superadmin, attempt } = await signInAs(goodClaims("Boss@Example.com"));
  assert.equal(superadmin, true);
  assert.equal(googleReplies.lastBody.get("code_verifier"), verify(attempt).verifier);
  assert.equal(googleReplies.lastBody.get("redirect_uri"), "https://finance.example.com/auth/google/callback");
  const session = cookieValue(cookies.find((c) => c.startsWith(ADMIN_COOKIE)), ADMIN_COOKIE);
  assert.match(cookies.find((c) => c.startsWith(ADMIN_COOKIE)), /HttpOnly; SameSite=Lax; Secure/);
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), "boss@example.com");
  // Single sign-on: Even without ADMIN_COOKIE, a verified user cookie recognizes listed superadmins
  const userCookie = cookieValue(cookies.find((c) => c.startsWith(USER_COOKIE)), USER_COOKIE);
  assert.equal(adminIdentity(req({ [USER_COOKIE]: userCookie })), "boss@example.com");
  // Removing the address from SUPERADMIN_EMAILS ends the session.
  env({ ...GOOGLE, SUPERADMIN_EMAILS: "ops@example.com" });
  assert.equal(adminIdentity(req({ [ADMIN_COOKIE]: session })), null);
  assert.equal(adminIdentity(req({ [USER_COOKIE]: userCookie })), null);
});

test("Google sign-in refuses wrong audience, unverified email, missing account ID and bad state", async () => {
  env(GOOGLE);
  const { url, attempt } = startAttempt();
  const state = url.searchParams.get("state");
  const cb = (s = state) => new URL(`https://finance.example.com/auth/google/callback?code=abc&state=${s}`);
  const cookies = req({ mao_oauth: attempt });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies({ ...goodClaims(), aud: "other-app" }) }), { code: "OAUTH_BAD_TOKEN" });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies({ ...goodClaims(), sub: undefined }) }), { code: "OAUTH_BAD_TOKEN" });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies({ ...goodClaims(), email_verified: false }) }), { code: "EMAIL_NOT_VERIFIED" });
  await assert.rejects(googleCallback(cookies, cb("forged"), { fetchImpl: googleReplies(goodClaims()) }), { code: "OAUTH_STATE_MISMATCH" });
  await assert.rejects(googleCallback(req(), cb(), { fetchImpl: googleReplies(goodClaims()) }), { code: "OAUTH_STATE_MISMATCH" });
  await assert.rejects(googleCallback(cookies, cb(), { fetchImpl: googleReplies(goodClaims(), false) }), { code: "OAUTH_TOKEN_FAILED" });
});

// ------------------------------------------------------------------ registration

const PAT = { sub: "1087", email: "pat@example.com", name: "Pat Lee", picture: "https://lh3.googleusercontent.com/a/pat" };

test("the first sign-in registers a supporter; later sign-ins keep the role", async () => {
  _useBackendForTests(new MemoryBackend());
  assert.deepEqual(await registerUser(PAT), { uid: "google_1087", email: "pat@example.com", name: "Pat Lee", role: "supporter", created: true });
  await storage().transact("app", "users", (doc) => ({ value: { ...doc, google_1087: { ...doc.google_1087, role: "admin" } } }));
  const again = await registerUser(PAT);
  assert.equal(again.role, "admin");
  assert.equal(again.created, false);
});

/** firebase-admin Auth and Firestore, faked: accounts [{ uid, email, google }], profiles { "users/<uid>": data }. */
function fakeFirebase({ accounts = [], profiles = {} } = {}) {
  const calls = [];
  const notFound = () => Object.assign(new Error("no user"), { code: "auth/user-not-found" });
  const find = (match) => {
    const account = accounts.find(match);
    if (!account) throw notFound();
    return { uid: account.uid };
  };
  const auth = {
    getUserByProviderUid: async (provider, uid) => find((a) => provider === "google.com" && a.google === uid),
    getUserByEmail: async (email) => find((a) => a.email === email),
    async createUser(props) {
      calls.push(["createUser", props]);
      accounts.push({ uid: `fb${accounts.length + 1}`, email: props.email });
      return { uid: accounts.at(-1).uid };
    },
    async updateUser(uid, props) {
      calls.push(["updateUser", uid, props]);
      accounts.find((a) => a.uid === uid).google = props.providerToLink.uid;
    },
  };
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    runTransaction: (fn) =>
      fn({
        get: async (ref) => ({ exists: Boolean(profiles[ref.path]), get: (key) => profiles[ref.path]?.[key] }),
        create: (ref, data) => {
          assert.equal(profiles[ref.path], undefined, "create must not overwrite a profile");
          profiles[ref.path] = data;
        },
        update: (ref, data) => (profiles[ref.path] = { ...profiles[ref.path], ...data }),
      }),
  };
  return { directory: firebaseDirectory({ auth, db }), profiles, calls };
}

test("shared directory: a newcomer gets a Firebase account linked to Google and a supporter profile", async () => {
  const fb = fakeFirebase();
  assert.deepEqual(await registerUser(PAT, { directory: fb.directory }), { uid: "fb1", email: "pat@example.com", name: "Pat Lee", role: "supporter", created: true });
  assert.deepEqual(fb.calls[0], ["createUser", { email: "pat@example.com", emailVerified: true, displayName: "Pat Lee", photoURL: PAT.picture }]);
  assert.deepEqual(fb.calls[1].slice(0, 2), ["updateUser", "fb1"]);
  assert.deepEqual(fb.calls[1][2].providerToLink, { providerId: "google.com", uid: "1087", email: "pat@example.com", displayName: "Pat Lee", photoURL: PAT.picture });
  const profile = fb.profiles["users/fb1"];
  assert.equal(profile.role, "supporter");
  assert.equal(profile.status, "supporter");
  assert.equal(profile.isSuperAdmin, false);
  assert.equal(profile.tag, "aifoundation");
  assert.equal(profile.registeredVia, "my-asx-options");
  assert.equal(profile.registeredAt, profile.lastLoginAt);
  // The next sign-in finds the same account through the Google link and creates nothing.
  const again = await registerUser(PAT, { directory: fb.directory });
  assert.equal(again.uid, "fb1");
  assert.equal(again.created, false);
  assert.equal(fb.calls.length, 2);
});

test("shared directory: existing AI Foundation members keep their account and role", async () => {
  const fb = fakeFirebase({
    accounts: [{ uid: "abc", email: "lee@example.com" }], // registered in another app, not linked to this Google ID
    profiles: { "users/abc": { uid: "abc", role: "admin", lastLoginAt: "2026-01-01T00:00:00.000Z" } },
  });
  const lee = { sub: "55", email: "lee@example.com", name: "", picture: "" };
  const user = await registerUser(lee, { directory: fb.directory });
  assert.deepEqual([user.uid, user.role, user.created], ["abc", "admin", false]);
  assert.deepEqual(fb.calls, []);
  assert.equal(fb.profiles["users/abc"].role, "admin");
  assert.notEqual(fb.profiles["users/abc"].lastLoginAt, "2026-01-01T00:00:00.000Z");
  // A profile another app made without a role gets the default one.
  fb.profiles["users/abc"] = { uid: "abc" };
  assert.equal((await registerUser(lee, { directory: fb.directory })).role, "supporter");
  assert.equal(fb.profiles["users/abc"].role, "supporter");
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
