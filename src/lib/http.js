import { config } from "../config.js";
import { RETRY, RETRYABLE_STATUS, backoffDelay, sleep } from "../../public/shared/retry.js";

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} from ${new URL(url).host}`);
    this.status = status;
    this.url = url;
    this.code = "UPSTREAM_HTTP_ERROR";
  }
}

/**
 * fetch() with a timeout, an honest User-Agent and the shared retry policy (backoff with jitter).
 * `browser: true` swaps in a browser User-Agent; callers only set it for opt-in sources.
 */
export async function request(url, { timeout = 20_000, retries = RETRY.maxRetries, headers = {}, browser = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": browser ? config.browserUserAgent : config.userAgent,
          "accept-language": "en-AU,en;q=0.9",
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
        redirect: "follow",
      });
      if (res.ok) return res;
      if (!RETRYABLE_STATUS.has(res.status) || attempt >= retries) throw new HttpError(res.status, url);
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 8_000) : backoffDelay(attempt));
    } catch (err) {
      if (err instanceof HttpError || attempt >= retries) throw err;
      await sleep(backoffDelay(attempt));
    }
  }
}

export const fetchText = async (url, opts) => (await request(url, opts)).text();

export const fetchJson = async (url, opts = {}) =>
  (await request(url, { ...opts, headers: { accept: "application/json", ...opts.headers } })).json();

export const fetchBytes = async (url, opts) => new Uint8Array(await (await request(url, opts)).arrayBuffer());

/** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
