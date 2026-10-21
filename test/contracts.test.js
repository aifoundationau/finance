import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SchemaError, assertValid, validate } from "../shared/json-schema.js";
import { ITEM_INPUT, REPORT, SETTINGS, SETTINGS_PATCH, UNLOCK_REQUEST, WALLET_ADJUST_REQUEST } from "../shared/schemas.js";
import { RETRY, backoffDelay } from "../shared/retry.js";
import { DEFAULT_SETTINGS } from "../src/settings.js";
import { _clearForTests, idempotent } from "../src/idempotency.js";

const paths = (errors) => errors.map((e) => e.path);

test("schemas: required fields, no extra properties, integer-only amounts", () => {
  assert.deepEqual(validate(UNLOCK_REQUEST, { itemId: "abc-1" }), []);
  assert.deepEqual(paths(validate(UNLOCK_REQUEST, {})), ["itemId"]);
  assert.deepEqual(paths(validate(UNLOCK_REQUEST, { itemId: "a", extra: 1 })), ["extra"]);
  assert.deepEqual(paths(validate(WALLET_ADJUST_REQUEST, { amount: 1.5 })), ["amount"]);
  assert.deepEqual(paths(validate(WALLET_ADJUST_REQUEST, { amount: "5" })), ["amount"]);
  assert.deepEqual(validate(WALLET_ADJUST_REQUEST, { amount: -3, note: "refund" }), []);
});

test("schemas: nullable prices accept null but not negatives", () => {
  assert.deepEqual(validate(ITEM_INPUT, { title: "Pack", tokenAmount: 5, priceAud: null }), []);
  assert.deepEqual(paths(validate(ITEM_INPUT, { title: "Pack", tokenAmount: 5, priceAud: -1 })), ["priceAud"]);
  assert.deepEqual(paths(validate(ITEM_INPUT, { title: "", tokenAmount: 5 })), ["title"]);
});

test("settings: defaults satisfy the schema and patches validate nested fields", () => {
  assert.deepEqual(validate(SETTINGS, DEFAULT_SETTINGS), []);
  assert.deepEqual(validate(SETTINGS_PATCH, { watchlist: ["DRO", "TNE"] }), []);
  assert.deepEqual(paths(validate(SETTINGS_PATCH, { watchlist: ["dro!"] })), ["watchlist[0]"]);
  assert.deepEqual(paths(validate(SETTINGS_PATCH, { schedule: { time: "25:00" } })), ["schedule.time"]);
  assert.deepEqual(paths(validate(SETTINGS_PATCH, { ai: { effort: "huge" } })), ["ai.effort"]);
  assert.deepEqual(paths(validate(SETTINGS_PATCH, { bogus: true })), ["bogus"]);
});

test("assertValid throws a structured 400 with field errors", () => {
  assert.throws(
    () => assertValid(UNLOCK_REQUEST, { itemId: 7 }),
    (err) => err instanceof SchemaError && err.status === 400 && err.code === "VALIDATION_FAILED" && err.fields[0].path === "itemId",
  );
});

test("report schema accepts a minimal report and rejects unknown item fields", () => {
  const report = {
    version: 1, id: "2026-10-22-standard", date: "2026-10-22", mode: "standard", generatedAt: "2026-10-22T08:00:00.000Z",
    window: { pastFrom: "2026-10-15", pastTo: "2026-10-22", forwardTo: "2026-10-29" },
    confirmed: [], upcoming: [], other: [], takeaways: [], market: {}, sources: [],
    stats: { confirmed: 0, upcoming: 0, other: 0, asxLinked: 0, asxTickers: [], disclosedValueAud: 0, bySector: {}, byJurisdiction: {}, bySource: {} },
  };
  assert.deepEqual(validate(REPORT, report), []);
  const item = {
    id: "x1", kind: "confirmed", date: "2026-10-21", title: "Win", companies: [], agency: null, jurisdiction: null, value: null,
    scope: null, sector: "Defence", status: "confirmed", stage: "awarded", sources: [], pos: 3,
  };
  assert.deepEqual(paths(validate(REPORT, { ...report, confirmed: [item] })), ["confirmed[0].pos"]);
});

test("retry policy: 500 ms base doubling, with bounded jitter", () => {
  assert.equal(RETRY.baseMs, 500);
  assert.equal(RETRY.maxRetries, 3);
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = backoffDelay(attempt);
    const base = RETRY.baseMs * RETRY.multiplier ** attempt;
    assert.ok(d >= base && d <= base + RETRY.jitterMs, `attempt ${attempt}: ${d}`);
  }
});

beforeEach(() => _clearForTests());

const call = (overrides = {}) => ({ key: "key-00000001", scope: "wallet=a", method: "POST", path: "/api/unlock", rawBody: '{"itemId":"a"}', ...overrides });

test("idempotency: a retried request runs once and replays the stored response", async () => {
  let runs = 0;
  const execute = async () => ({ status: 200, body: { n: ++runs }, headers: {} });
  const first = await idempotent(call(), execute);
  const second = await idempotent(call(), execute);
  assert.equal(runs, 1);
  assert.deepEqual(second.body, first.body);
  assert.equal(second.headers["idempotent-replayed"], "true");
  // The same key from another visitor is a separate request.
  await idempotent(call({ scope: "wallet=b" }), execute);
  assert.equal(runs, 2);
});

test("idempotency: concurrent duplicates share one execution", async () => {
  let runs = 0;
  const execute = () => new Promise((done) => setTimeout(() => done({ status: 200, body: { n: ++runs }, headers: {} }), 20));
  const [a, b] = await Promise.all([idempotent(call(), execute), idempotent(call(), execute)]);
  assert.equal(runs, 1);
  assert.deepEqual(a.body, b.body);
});

test("idempotency: missing, malformed and reused keys are refused", async () => {
  const execute = async () => ({ status: 200, body: {}, headers: {} });
  await assert.rejects(idempotent(call({ key: undefined }), execute), { status: 428, code: "IDEMPOTENCY_KEY_REQUIRED" });
  await assert.rejects(idempotent(call({ key: "short" }), execute), { status: 400, code: "IDEMPOTENCY_KEY_INVALID" });
  await idempotent(call(), execute);
  await assert.rejects(idempotent(call({ rawBody: '{"itemId":"b"}' }), execute), { status: 422, code: "IDEMPOTENCY_KEY_REUSED" });
});

test("idempotency: failures are not cached, so the same key can be retried", async () => {
  let runs = 0;
  await assert.rejects(idempotent(call(), async () => {
    runs++;
    throw new Error("upstream down");
  }));
  await idempotent(call(), async () => ({ status: 503, body: {}, headers: {} }));
  const ok = await idempotent(call(), async () => ({ status: 200, body: { done: true }, headers: {} }));
  assert.deepEqual(ok.body, { done: true });
  assert.equal(runs, 1);
});

test("undefined properties count as absent, as they are once saved as JSON", () => {
  assert.deepEqual(validate(WALLET_ADJUST_REQUEST, { amount: 1, note: undefined }), []);
  assert.deepEqual(paths(validate(WALLET_ADJUST_REQUEST, { amount: undefined })), ["amount"]);
});
