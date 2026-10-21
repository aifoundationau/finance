import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { ROOT, aiConfigured, allowedHosts, config, publicDeployment } from "./src/config.js";
import { loadSettings, saveSettings } from "./src/settings.js";
import { isReportId, listReports, loadReport } from "./src/store.js";
import { getRun, startRun } from "./src/runs.js";
import { storage } from "./src/storage.js";
import { reportToCsv, reportToMarkdown } from "./src/lib/markdown.js";
import { nextRunAt, sydneyDate } from "./src/lib/dates.js";
import {
  adjustWallet, adminView, createItem, deleteItem, ensureWallet, getState, publicCommerce, redactReport, unlockItem,
  updateItem, updateSettings, viewerCountry,
} from "./src/commerce.js";
import {
  ADMIN_COOKIE, AuthError, WALLET_COOKIE, adminIdentity, authMode, clearOAuthCookie, cookie, googleCallback, googleStart, isAdmin,
  isHttps, login, logoutCookie, parseCookies,
} from "./src/admin.js";
import { idempotent } from "./src/idempotency.js";
import { assertValid } from "./shared/json-schema.js";
import {
  COMMERCE_SETTINGS_PATCH, EMPTY_REQUEST, ITEM_INPUT, ITEM_PATCH, LOGIN_REQUEST, REPORT, RUN_REQUEST, SETTINGS_PATCH,
  UNLOCK_REQUEST, WALLET_ADJUST_REQUEST,
} from "./shared/schemas.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
};
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
// Host names accepted in the Host header. Locally only loopback; deployed, the Vercel domains
// and ALLOWED_HOSTS. null (HOST set to a public interface with no list) accepts any host.
const permittedHosts = allowedHosts.size ? new Set([...LOOPBACK, ...allowedHosts]) : LOOPBACK.has(config.host) ? LOOPBACK : null;
const bareHost = (value) => String(value ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
const STATUS_CODES = { 400: "VALIDATION_FAILED", 401: "UNAUTHENTICATED", 402: "INSUFFICIENT_TOKENS", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 422: "UNPROCESSABLE", 428: "PRECONDITION_REQUIRED", 429: "RATE_LIMITED", 503: "UNAVAILABLE" };

/** Structured telemetry: one JSON line per notable event. */
function telemetry(level, event, fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

// ------------------------------------------------------------------ report runs and schedule

let scheduleTimer = null;
let nextScheduled = null;

/** Starts a run; on Vercel the function is kept alive until it finishes (up to its time limit). */
async function beginRun(mode, trigger) {
  const { started, done } = await startRun(mode, trigger, { log: telemetry });
  if (started) waitUntil(done);
  return { started, done };
}

// Local only: an in-process timer for the daily report. On Vercel, Vercel Cron calls
// /api/cron/daily instead (see vercel.json).
async function scheduleNext() {
  if (config.serverless) return;
  clearTimeout(scheduleTimer);
  const settings = await loadSettings();
  nextScheduled = settings.schedule.enabled ? nextRunAt(settings.schedule.time) : null;
  if (!nextScheduled) return;
  scheduleTimer = setTimeout(
    async () => {
      const current = await loadSettings();
      await beginRun(current.schedule.ai && aiConfigured() ? "ai" : "standard", "schedule");
      scheduleNext();
    },
    Math.min(nextScheduled.getTime() - Date.now(), 2 ** 31 - 1),
  );
}

// ------------------------------------------------------------------ request context

const ok = (body, extra = {}) => ({ status: 200, body, ...extra });
const httpError = (status, message, code = STATUS_CODES[status]) => Object.assign(new Error(message), { status, code });

// A short public label for a wallet, so its owner and the superadmin can refer to it without
// exposing the cookie value (which works like a password).
const walletLabel = (id) => crypto.createHash("sha256").update(id).digest("hex").slice(0, 6).toUpperCase();

/** Who is asking: superadmin flag and wallet (created, with a cookie, on first visit). */
async function viewer(ctx, { createWallet = false } = {}) {
  if (ctx.viewer && (ctx.viewer.wallet || !createWallet)) return ctx.viewer;
  const { wallet, created } = await ensureWallet(parseCookies(ctx.req.headers.cookie)[WALLET_COOKIE], { create: createWallet });
  if (created) ctx.cookies.push(cookie(WALLET_COOKIE, wallet.id, { maxAge: 400 * 86_400, sameSite: "Lax", secure: isHttps(ctx.req) }));
  ctx.viewer = { admin: isAdmin(ctx.req), wallet, country: viewerCountry(ctx.req) };
  return ctx.viewer;
}

/** Whether this request may change settings and start runs. */
const canManage = (req) => !publicDeployment || isAdmin(req);

async function readBody(req, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError(413, "Request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return { raw, json: raw ? JSON.parse(raw) : {} };
  } catch {
    throw httpError(400, "Body must be JSON", "INVALID_JSON");
  }
}

// ------------------------------------------------------------------ route handlers

async function status(ctx) {
  return {
    ...(await getRun()),
    aiConfigured: aiConfigured(),
    canManage: canManage(ctx.req),
    schedule: config.serverless
      ? { kind: "cron", note: "Daily report between 6 and 7 pm Sydney time (5 to 6 pm in winter), run by Vercel Cron." }
      : { kind: "local", note: null },
    nextScheduled: nextScheduled?.toISOString() ?? null,
    today: sydneyDate(),
    storage: storage().kind,
    // Vercel's file system is read-only: without Firestore nothing can be saved.
    storageWarning: config.serverless && storage().kind === "files"
      ? "Storage is not set up, so reports, settings and wallets cannot be saved. Add FIREBASE_SERVICE_ACCOUNT in the Vercel project's environment variables and redeploy (see README)."
      : null,
  };
}

async function getReport(ctx) {
  const reportId = ctx.params.id === "latest" ? (await listReports())[0]?.id : ctx.params.id;
  if (!reportId || !isReportId(reportId)) throw httpError(404, "No report yet");
  const full = await loadReport(reportId);
  if (!full) throw httpError(404, "Report not found");
  const who = await viewer(ctx);
  return who.admin ? full : redactReport(full, await getState(), who.wallet);
}

async function commerceForViewer(ctx) {
  const who = await viewer(ctx);
  const s = await getState();
  return {
    ...publicCommerce(s, who.wallet, who.country),
    ...(who.wallet && s.settings.isTokenSystemEnabled ? { walletLabel: walletLabel(who.wallet.id) } : {}),
    admin: who.admin,
    adminIdentity: who.admin ? adminIdentity(ctx.req) : null,
    adminAuth: authMode(),
  };
}

const withLabels = (view) => ({ ...view, wallets: view.wallets.map((w) => ({ ...w, label: walletLabel(w.id) })) });

// Every endpoint, declared once: method, path, request schema, access and summary. The router,
// the idempotency layer and /api/openapi.json all read from this table.
const ROUTES = [
  { method: "GET", path: "/api/status", summary: "Run status and schedule", handler: async (ctx) => ok(await status(ctx)) },
  { method: "GET", path: "/api/reports", summary: "Report summaries, newest first", handler: async () => ok(await listReports()) },
  { method: "GET", path: "/api/reports/:id", summary: "One report (redacted per wallet when tokens are on)", response: REPORT, handler: async (ctx) => ok(await getReport(ctx)) },
  {
    method: "GET", path: "/api/reports/:id/markdown", summary: "The brief as Markdown",
    handler: async (ctx) => ok(reportToMarkdown(await getReport(ctx)), { headers: { "content-type": "text/markdown; charset=utf-8" } }),
  },
  {
    method: "GET", path: "/api/reports/:id/csv", summary: "All lists as CSV",
    handler: async (ctx) => {
      const report = await getReport(ctx);
      return ok(reportToCsv(report), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gov-contracts-${report.id}.csv"` } });
    },
  },
  {
    method: "POST", path: "/api/run", manage: true, summary: "Start a report run", schema: RUN_REQUEST,
    handler: async (ctx) => {
      if (ctx.body.mode === "ai" && !aiConfigured()) throw httpError(400, "AI mode needs ANTHROPIC_API_KEY in .env. See README.", "AI_NOT_CONFIGURED");
      if (!(await beginRun(ctx.body.mode, "manual")).started) throw httpError(409, "A report is already running", "RUN_IN_PROGRESS");
      return { status: 202, body: await status(ctx) };
    },
  },
  { method: "GET", path: "/api/settings", summary: "App settings", handler: async () => ok(await loadSettings()) },
  {
    method: "PUT", path: "/api/settings", manage: true, summary: "Update app settings (partial)", schema: SETTINGS_PATCH,
    handler: async (ctx) => {
      const saved = await saveSettings(ctx.body);
      await scheduleNext();
      return ok(saved);
    },
  },
  { method: "GET", path: "/api/commerce", summary: "Token economy as seen by this visitor", handler: async (ctx) => ok(await commerceForViewer(ctx)) },
  {
    method: "POST", path: "/api/unlock", summary: "Spend tokens to unlock one contract's details", schema: UNLOCK_REQUEST,
    handler: async (ctx) => {
      const who = await viewer(ctx, { createWallet: true });
      const { wallet, spent } = await unlockItem(who.wallet.id, ctx.body.itemId);
      return ok({ balance: wallet.balance, spent });
    },
  },
  {
    method: "POST", path: "/api/admin/login", summary: "Superadmin password sign-in (only when Google sign-in is not configured)", schema: LOGIN_REQUEST,
    handler: async (ctx) => ok({ ok: true }, { headers: { "set-cookie": login(ctx.req, ctx.body.password) } }),
  },
  {
    method: "POST", path: "/api/admin/logout", summary: "Superadmin sign-out", schema: EMPTY_REQUEST,
    handler: async (ctx) => ok({ ok: true }, { headers: { "set-cookie": logoutCookie(ctx.req) } }),
  },
  { method: "GET", path: "/api/admin/state", admin: true, summary: "Commerce settings, items, wallets and ledger", handler: async () => ok(withLabels(adminView(await getState()))) },
  { method: "PUT", path: "/api/admin/settings", admin: true, schema: COMMERCE_SETTINGS_PATCH, summary: "Token system toggles and prices", handler: async (ctx) => ok(withLabels(await updateSettings(ctx.body))) },
  { method: "POST", path: "/api/admin/items", admin: true, schema: ITEM_INPUT, summary: "Create a saleable item", handler: async (ctx) => ({ status: 201, body: withLabels(await createItem(ctx.body)) }) },
  { method: "PUT", path: "/api/admin/items/:id", admin: true, schema: ITEM_PATCH, summary: "Edit a saleable item", handler: async (ctx) => ok(withLabels(await updateItem(ctx.params.id, ctx.body))) },
  { method: "DELETE", path: "/api/admin/items/:id", admin: true, schema: EMPTY_REQUEST, summary: "Delete a saleable item", handler: async (ctx) => ok(withLabels(await deleteItem(ctx.params.id))) },
  {
    method: "POST", path: "/api/admin/wallets/:id/adjust", admin: true, schema: WALLET_ADJUST_REQUEST, summary: "Add or remove tokens (id 'self' = this browser's wallet)",
    handler: async (ctx) => {
      const walletId = ctx.params.id === "self" ? (await viewer(ctx, { createWallet: true })).wallet.id : ctx.params.id;
      return ok(withLabels(await adjustWallet(walletId, ctx.body.amount, ctx.body.note)));
    },
  },
  {
    method: "GET", path: "/api/cron/daily", summary: "Daily report (Vercel Cron; needs Authorization: Bearer CRON_SECRET)",
    handler: async (ctx) => {
      const secret = process.env.CRON_SECRET;
      const given = Buffer.from(String(ctx.req.headers.authorization ?? ""));
      const expected = Buffer.from(`Bearer ${secret}`);
      if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw httpError(401, "Cron secret required.");
      const settings = await loadSettings();
      if (!settings.schedule.enabled) return ok({ skipped: "Daily schedule is off in Settings." });
      // Cron may deliver twice: a report already made today, or one in progress, ends it here.
      const [latest] = await listReports();
      if (latest?.date === sydneyDate()) return ok({ skipped: `Today's report already exists (${latest.id}).` });
      const { started, done } = await beginRun(settings.schedule.ai && aiConfigured() ? "ai" : "standard", "cron");
      if (!started) return ok({ skipped: "A report is already running." });
      const reports = await done;
      return ok({ reports: reports?.map((r) => r.id) ?? [], status: await getRun() });
    },
  },
  { method: "GET", path: "/api/openapi.json", summary: "This API as an OpenAPI 3.1 document", handler: async () => ok(openApi()) },
];

const compiled = ROUTES.map((r) => ({
  ...r,
  mutating: r.method !== "GET",
  regex: new RegExp(`^${r.path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`),
}));

function openApi() {
  const paths = {};
  for (const r of ROUTES) {
    const p = r.path.replace(/:(\w+)/g, "{$1}");
    paths[p] ??= {};
    paths[p][r.method.toLowerCase()] = {
      summary: r.summary,
      ...(r.admin || (r.manage && publicDeployment) ? { security: [{ superadminSession: [] }] } : {}),
      parameters: [
        ...[...r.path.matchAll(/:(\w+)/g)].map(([, name]) => ({ name, in: "path", required: true, schema: { type: "string" } })),
        ...(r.method !== "GET" ? [{ name: "x-idempotency-key", in: "header", required: true, schema: { type: "string", pattern: "^[A-Za-z0-9_-]{8,128}$" } }] : []),
      ],
      ...(r.schema ? { requestBody: { required: true, content: { "application/json": { schema: r.schema } } } } : {}),
      responses: { 200: { description: "OK", ...(r.response ? { content: { "application/json": { schema: r.response } } } : {}) }, default: { description: "Error: { error, code, fields? }" } },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "MY ASX Options API", version: "1.0.0" },
    components: { securitySchemes: { superadminSession: { type: "apiKey", in: "cookie", name: ADMIN_COOKIE } } },
    paths,
  };
}

async function handleApi(req, url) {
  const route = compiled.find((r) => r.method === req.method && r.regex.test(url.pathname));
  if (!route) {
    const known = compiled.some((r) => r.regex.test(url.pathname));
    throw httpError(known ? 405 : 404, known ? "Method not allowed" : "Unknown endpoint", known ? "METHOD_NOT_ALLOWED" : "NOT_FOUND");
  }
  const ctx = { req, url, params: { ...url.pathname.match(route.regex).groups }, cookies: [], viewer: null };
  for (const [k, v] of Object.entries(ctx.params)) ctx.params[k] = decodeURIComponent(v);
  if (route.admin && !isAdmin(req)) throw httpError(401, "Superadmin login required.");
  if (route.manage && !canManage(req)) throw httpError(401, "Sign in as superadmin to change settings or run reports.");

  if (!route.mutating) return { ...(await route.handler(ctx)), cookies: ctx.cookies };

  const { raw, json } = await readBody(req);
  ctx.body = assertValid(route.schema ?? EMPTY_REQUEST, json);
  const response = await idempotent(
    { key: req.headers["x-idempotency-key"], scope: req.headers.cookie ?? req.socket.remoteAddress, method: req.method, path: url.pathname, rawBody: raw },
    async () => ({ ...(await route.handler(ctx)), cookies: ctx.cookies }),
  );
  return response;
}

// ------------------------------------------------------------------ HTTP plumbing

function send(res, { status = 200, body, headers = {}, cookies = [] }) {
  const isText = typeof body === "string" || Buffer.isBuffer(body);
  const setCookie = [...cookies, ...[].concat(headers["set-cookie"] ?? [])];
  const { "set-cookie": _ignored, ...rest } = headers;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": isText ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(setCookie.length ? { "set-cookie": setCookie } : {}),
    ...rest,
  });
  res.end(isText ? body : JSON.stringify(body));
}

function redirect(res, location, cookies = []) {
  res.writeHead(302, { ...SECURITY_HEADERS, location, "cache-control": "no-store", ...(cookies.length ? { "set-cookie": cookies } : {}) });
  res.end();
}

// Google sign-in for the superadmin: browser navigations, so they answer with redirects
// (back to the Superadmin panel, with any problem in ?auth_error=) rather than JSON.
async function handleAuth(req, res, url) {
  try {
    if (url.pathname === "/auth/google") {
      const { location, cookies } = googleStart(req);
      return redirect(res, location, cookies);
    }
    const { email, cookies } = await googleCallback(req, url);
    telemetry("info", "admin.signed_in", { method: "google", email });
    return redirect(res, "/#admin", cookies);
  } catch (err) {
    if (!(err instanceof AuthError)) console.error(err);
    telemetry("warn", "admin.sign_in_failed", { code: err.code ?? "AUTH_FAILED", message: err.message });
    const message = err instanceof AuthError ? err.message : "Sign-in failed. Try again.";
    return redirect(res, `/?auth_error=${encodeURIComponent(message)}#admin`, [clearOAuthCookie(req)]);
  }
}

/** Blocks DNS rebinding (Host) and cross-site writes (Origin / content type). */
function guard(req) {
  if (permittedHosts && !permittedHosts.has(bareHost(req.headers.host))) return "Unexpected Host header";
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return "Writes must be application/json";
    const origin = req.headers.origin;
    if (origin) {
      let originHost = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        // "null" (sandboxed frames) or malformed: treat as cross-origin
      }
      // Behind a proxy the public host may arrive as x-forwarded-host.
      const ownHosts = [req.headers.host, req.headers["x-forwarded-host"]].filter(Boolean).map((v) => String(v).split(",")[0].trim().toLowerCase());
      if (!ownHosts.includes(originHost?.toLowerCase())) return "Cross-origin request refused";
    }
  }
  return null;
}

// Static files: the front end from public/, plus the shared schema/validator modules.
const STATIC_ROOTS = [
  { prefix: "/shared/", dir: path.join(ROOT, "shared") },
  { prefix: "/", dir: config.publicDir },
];

async function serveStatic(res, urlPath) {
  const root = STATIC_ROOTS.find((r) => urlPath.startsWith(r.prefix));
  const rel = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath.slice(root.prefix.length)).replace(/^\/+/, "");
  const file = path.resolve(root.dir, rel);
  if (!file.startsWith(root.dir + path.sep)) return send(res, { status: 403, body: "Forbidden" });
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { ...SECURITY_HEADERS, "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch {
    if (root.prefix === "/" && !path.extname(rel)) return serveStatic(res, "/");
    send(res, { status: 404, body: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const blocked = guard(req);
    if (blocked) throw httpError(403, blocked);
    if (url.pathname.startsWith("/api/")) return send(res, await handleApi(req, url));
    if ((url.pathname === "/auth/google" || url.pathname === "/auth/google/callback") && req.method === "GET") return await handleAuth(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") throw httpError(405, "Method not allowed", "METHOD_NOT_ALLOWED");
    return await serveStatic(res, url.pathname);
  } catch (err) {
    const status = err.status ?? 500;
    const code = err.code ?? STATUS_CODES[status] ?? "INTERNAL_ERROR";
    telemetry(status >= 500 ? "error" : "warn", "http.error", { method: req.method, path: url.pathname, status, code, message: err.message });
    if (status >= 500 && !err.status) console.error(err);
    send(res, { status, body: { error: err.status ? err.message : "Internal error", code, ...(err.fields ? { fields: err.fields } : {}) } });
  }
});

server.listen(config.port, config.host, async () => {
  const shown = config.host === "0.0.0.0" ? "localhost" : config.host;
  console.log(`MY ASX Options running at http://${shown}:${config.port}`);
  console.log(`AI analyst: ${aiConfigured() ? "available (ANTHROPIC_API_KEY found)" : "off (no ANTHROPIC_API_KEY)"}`);
  console.log(`Storage: ${storage().kind}; superadmin sign-in: ${authMode() ?? "not configured"}`);
  // On Vercel, instances start on demand; the daily report comes from Vercel Cron instead.
  if (config.serverless) return;
  await scheduleNext();
  if (nextScheduled) console.log(`Next scheduled report: ${nextScheduled.toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} (Sydney)`);
  const settings = await loadSettings();
  const [latest] = await listReports();
  if (settings.schedule.runOnStartup && latest?.date !== sydneyDate()) {
    console.log("No report for today yet; starting one now.");
    beginRun("standard", "startup");
  }
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${config.port} is in use. Set PORT in .env to use another port.` : err);
  process.exit(1);
});
