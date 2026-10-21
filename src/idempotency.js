// Idempotency for state-mutating requests: the first response for an x-idempotency-key is stored
// and replayed for retries, so a retried unlock, credit or run never executes twice. A key reused
// with a different request is refused. Entries live in memory for 24 hours.
import crypto from "node:crypto";

const TTL_MS = 24 * 3_600_000;
const MAX_ENTRIES = 10_000;
const store = new Map(); // scopedKey -> { fingerprint, promise, expires }

export const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export class IdempotencyError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

function purge(now) {
  for (const [k, v] of store) if (v.expires < now) store.delete(k);
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}

/**
 * Runs `execute` once per (key, caller scope). `execute` resolves to { status, body, headers }.
 * Responses that failed with a server error are not kept, so a genuine retry can succeed.
 */
export async function idempotent({ key, scope, method, path, rawBody }, execute) {
  if (!key) throw new IdempotencyError("State-changing requests need an x-idempotency-key header.", 428, "IDEMPOTENCY_KEY_REQUIRED");
  if (!KEY_PATTERN.test(key)) throw new IdempotencyError("x-idempotency-key must be 8-128 letters, digits, '-' or '_'.", 400, "IDEMPOTENCY_KEY_INVALID");
  const now = Date.now();
  purge(now);
  const scopedKey = `${hash(scope ?? "")}:${key}`;
  const fingerprint = hash(`${method} ${path}\n${rawBody ?? ""}`);
  const existing = store.get(scopedKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new IdempotencyError("This idempotency key was already used for a different request.", 422, "IDEMPOTENCY_KEY_REUSED");
    }
    const response = await existing.promise;
    return { ...response, headers: { ...response.headers, "idempotent-replayed": "true" } };
  }
  const promise = execute();
  store.set(scopedKey, { fingerprint, promise, expires: now + TTL_MS });
  try {
    const response = await promise;
    if (response.status >= 500) store.delete(scopedKey);
    return response;
  } catch (err) {
    store.delete(scopedKey); // errors are thrown, not cached: the client may retry the same key
    throw err;
  }
}

export const _clearForTests = () => store.clear();
