// API client: idempotency keys on every state change, shared backoff-with-jitter retries,
// structured errors, telemetry, and readiness markers for automation (data-ready / aria-busy).
import { RETRY, RETRYABLE_STATUS, backoffDelay, sleep } from "/shared/retry.js";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "UNKNOWN", fields = [] } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

// ------------------------------------------------------------------ status and readiness

let pending = 0;
const statusEl = () => document.getElementById("agent-status");

/** Mirrors state into the live status region that people and agents both read. */
export function setAgentStatus(state, message) {
  const el = statusEl();
  if (!el) return;
  el.dataset.agentStatus = state;
  el.textContent = message;
}

function updateReady() {
  document.body.dataset.ready = String(pending === 0);
  document.getElementById("main")?.setAttribute("aria-busy", String(pending > 0));
}

/** Marks the page busy until `promise` settles. */
export async function track(promise) {
  pending += 1;
  updateReady();
  try {
    return await promise;
  } finally {
    pending -= 1;
    updateReady();
  }
}

function telemetry(event, fields) {
  console.warn(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

// ------------------------------------------------------------------ requests

/**
 * JSON request with retries for network failures and transient statuses. State-changing calls
 * carry one idempotency key for all their attempts, so a retry can never apply twice.
 */
export function api(method, url, body, { idempotencyKey } = {}) {
  const mutating = method !== "GET";
  const key = mutating ? idempotencyKey ?? newIdempotencyKey() : null;
  return track(
    (async () => {
      for (let attempt = 0; ; attempt++) {
        let res;
        try {
          res = await fetch(url, {
            method,
            headers: {
              accept: "application/json",
              // Lets the server decide whether AUD pricing applies (Australian visitors only).
              "x-client-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
              ...(mutating ? { "content-type": "application/json", "x-idempotency-key": key } : {}),
            },
            body: mutating ? JSON.stringify(body ?? {}) : undefined,
          });
        } catch {
          if (attempt < RETRY.maxRetries) {
            await sleep(backoffDelay(attempt));
            continue;
          }
          const err = new ApiError("The app server can't be reached. Check that it is running.", { code: "NETWORK_UNAVAILABLE" });
          telemetry("api.error", { method, url, code: err.code, attempts: attempt + 1 });
          setAgentStatus("error", err.message);
          throw err;
        }
        if (RETRYABLE_STATUS.has(res.status) && attempt < RETRY.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        const type = res.headers.get("content-type") ?? "";
        const data = type.includes("json") ? await res.json().catch(() => null) : await res.text();
        if (!res.ok) {
          const err = new ApiError(data?.error ?? `Request failed (${res.status})`, { status: res.status, code: data?.code ?? `HTTP_${res.status}`, fields: data?.fields ?? [] });
          telemetry("api.error", { method, url, status: res.status, code: err.code, attempts: attempt + 1 });
          setAgentStatus("error", err.message);
          throw err;
        }
        return data;
      }
    })(),
  );
}
