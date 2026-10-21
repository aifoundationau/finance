// AntigravityDOMDriver: deterministic, verifiable UI automation for this app. Every action
// resolves its target by data-agent-id (never by styling classes), runs the three-stage check
// (visible and stable, interactive, then a post-action assertion) and returns an
// ExecutionResult { success, data?, error?, diagnostics?, timestamp }. Exposed on window for
// browser agents and end-to-end tests.
import { validate } from "/shared/json-schema.js";
import { RETRY, RETRYABLE_STATUS, backoffDelay, sleep } from "/shared/retry.js";

const RESOLVE_TIMEOUT_MS = 3_000;
const result = (success, extra = {}) => ({ success, ...extra, timestamp: new Date().toISOString() });
const selectorFor = (agentId) => `[data-agent-id="${CSS.escape(agentId)}"]`;

/** Why an element cannot be acted on, or null when it can. */
function blockedReason(el) {
  if (!el.isConnected) return "detached from the document";
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none") return "hidden (display: none)";
    if (style.visibility === "hidden") return "hidden (visibility: hidden)";
    if (Number(style.opacity) === 0) return "transparent (opacity: 0)";
    if (node.inert) return "inside an inert region";
    if (node.getAttribute("aria-busy") === "true" && node !== document.body) return "busy (aria-busy)";
  }
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return "has no size";
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return "disabled";
  const modal = document.querySelector("dialog[open]");
  if (modal && !modal.contains(el)) return "covered by an open dialog";
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (hit && hit !== el && !el.contains(hit) && !(el.labels && [...el.labels].some((l) => l.contains(hit)))) {
    return `obscured by ${hit.tagName.toLowerCase()}${hit.dataset?.agentId ? `[data-agent-id="${hit.dataset.agentId}"]` : ""}`;
  }
  return null;
}

function diagnostics(agentId) {
  const errors = [...document.querySelectorAll("[data-agent-error]")]
    .filter((n) => n.textContent.trim())
    .map((n) => ({ field: n.dataset.agentError, message: n.textContent.trim() }));
  const similar = [...document.querySelectorAll("[data-agent-id]")]
    .map((n) => n.dataset.agentId)
    .filter((id) => id.includes(String(agentId ?? "").split("_")[0]))
    .slice(0, 10);
  return {
    ready: document.body.dataset.ready ?? "unknown",
    status: document.getElementById("agent-status")?.textContent ?? null,
    view: document.getElementById("main")?.dataset.view ?? null,
    fieldErrors: errors,
    similarAgentIds: similar,
  };
}

/** Waits up to 3 s for the element (MutationObserver plus polling), then re-queries once. */
async function resolve(agentId, timeout = RESOLVE_TIMEOUT_MS) {
  const find = () => document.querySelector(selectorFor(agentId));
  let el = find();
  if (el) return el;
  el = await new Promise((done) => {
    const observer = new MutationObserver(() => {
      const found = find();
      if (found) finish(found);
    });
    const poll = setInterval(() => {
      const found = find();
      if (found) finish(found);
    }, 100);
    const timer = setTimeout(() => finish(null), timeout);
    function finish(value) {
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(timer);
      done(value);
    }
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-agent-id"] });
  });
  return el ?? find(); // final re-query before giving up
}

/** Resolves for any DOM change within `timeout`, else null. */
function nextMutation(timeout) {
  return new Promise((done) => {
    const observer = new MutationObserver((records) => {
      observer.disconnect();
      clearTimeout(timer);
      done(records.length);
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      done(null);
    }, timeout);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  });
}

async function prepare(agentId) {
  if (typeof agentId !== "string" || !agentId) return { error: result(false, { error: "An agent id (string) is required.", diagnostics: diagnostics("") }) };
  const el = await resolve(agentId);
  if (!el) return { error: result(false, { error: `No element with data-agent-id="${agentId}" after ${RESOLVE_TIMEOUT_MS} ms.`, diagnostics: diagnostics(agentId) }) };
  const blocked = blockedReason(el);
  if (blocked) return { error: result(false, { error: `"${agentId}" is not interactable: ${blocked}.`, diagnostics: diagnostics(agentId) }) };
  return { el };
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
}

export const AntigravityDOMDriver = {
  /** Resolves when the app reports data-ready="true" (no requests or renders in flight). */
  async waitForReady(timeout = 10_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (document.body.dataset.ready === "true") return result(true);
      await sleep(50);
    }
    return result(false, { error: "The app did not become ready in time.", diagnostics: diagnostics("") });
  },

  /** Types a value into an input/textarea and reads it back. */
  async executeSafeInput(agentId, value) {
    const { el, error } = await prepare(agentId);
    if (error) return error;
    el.focus();
    setNativeValue(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    if (el.value !== String(value)) return result(false, { error: `"${agentId}" did not accept the value (it reads "${el.value}").` });
    const fieldError = el.getAttribute("aria-invalid") === "true" ? document.querySelector(`[data-agent-error="${CSS.escape(el.dataset.schemaPath ?? "")}"]`)?.textContent : null;
    return result(true, { data: el.value, ...(fieldError ? { validation: fieldError } : {}) });
  },

  /** Chooses an option in a select and reads it back. */
  async executeSafeSelect(agentId, value) {
    const { el, error } = await prepare(agentId);
    if (error) return error;
    if (![...el.options].some((o) => o.value === value)) return result(false, { error: `"${agentId}" has no option "${value}".` });
    setNativeValue(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value === value ? result(true, { data: value }) : result(false, { error: `"${agentId}" reads "${el.value}" after selecting "${value}".` });
  },

  /** Sets a checkbox/switch and reads it back. */
  async executeSafeToggle(agentId, checked) {
    const { el, error } = await prepare(agentId);
    if (error) return error;
    if (el.checked !== checked) el.click();
    return el.checked === checked ? result(true, { data: checked }) : result(false, { error: `"${agentId}" did not change to ${checked}.` });
  },

  /** Clicks, then asserts the DOM responded (any mutation or live-region update) within `timeout`. */
  async executeSafeClick(agentId, { timeout = RESOLVE_TIMEOUT_MS } = {}) {
    const { el, error } = await prepare(agentId);
    if (error) return error;
    const mutated = nextMutation(timeout);
    el.click();
    const records = await mutated;
    if (!records) return result(false, { error: `Clicked "${agentId}" but the page did not respond within ${timeout} ms.`, diagnostics: diagnostics(agentId) });
    return result(true, { data: { mutations: records } });
  },

  /** Validates `payload` against `schema`, then sends it with one idempotency key across retries. */
  async validateAndDispatch(url, payload, schema, { method = "POST", idempotencyKey = crypto.randomUUID() } = {}) {
    const errors = schema ? validate(schema, payload) : [];
    if (errors.length) return result(false, { error: "Payload failed schema validation.", data: errors });
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers: { "content-type": "application/json", accept: "application/json", "x-idempotency-key": idempotencyKey },
          body: JSON.stringify(payload),
        });
        if (RETRYABLE_STATUS.has(res.status) && attempt < RETRY.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        const body = await res.json().catch(() => null);
        return res.ok ? result(true, { data: body }) : result(false, { error: body?.error ?? `HTTP ${res.status}`, data: body });
      } catch (err) {
        if (attempt < RETRY.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        return result(false, { error: err.message || "Network error" });
      }
    }
  },
};

window.AntigravityDOMDriver = AntigravityDOMDriver;
