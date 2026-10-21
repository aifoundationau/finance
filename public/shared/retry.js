// Retry policy for every network dispatch (server fetches and browser API calls):
// exponential backoff from 500ms, doubling each attempt, with random jitter; at most 3 retries.
export const RETRY = { baseMs: 500, multiplier: 2, maxRetries: 3, jitterMs: 250 };

export const backoffDelay = (attempt, random = Math.random) =>
  Math.round(RETRY.baseMs * RETRY.multiplier ** attempt + random() * RETRY.jitterMs);

/** Transient HTTP statuses that are safe to retry. */
export const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
