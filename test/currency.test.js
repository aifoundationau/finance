import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AUD_TO_USD_RATE,
  convertAudToUsd,
  convertUsdToAud,
  formatAud,
  formatUsd,
} from "../public/shared/currency.js";

test("currency: DEFAULT_AUD_TO_USD_RATE is defined and reasonable", () => {
  assert.equal(typeof DEFAULT_AUD_TO_USD_RATE, "number");
  assert.ok(DEFAULT_AUD_TO_USD_RATE > 0.5 && DEFAULT_AUD_TO_USD_RATE < 1.0);
});

test("currency: convertAudToUsd calculates exact 2 decimals and rounded up whole USD", () => {
  // AUD $1 with 0.65 rate
  const res1 = convertAudToUsd(1, 0.65);
  assert.equal(res1.aud, 1);
  assert.equal(res1.rate, 0.65);
  assert.equal(res1.exactUsd, 0.65);
  assert.equal(res1.exactUsdFormatted, "0.65");
  assert.equal(res1.wholeUsd, 1); // Math.ceil(0.65) => 1

  // AUD $3 with 0.65 rate => 1.95 USD exact, whole => 2
  const res3 = convertAudToUsd(3, 0.65);
  assert.equal(res3.exactUsd, 1.95);
  assert.equal(res3.exactUsdFormatted, "1.95");
  assert.equal(res3.wholeUsd, 2);

  // AUD $10 with 0.65 rate => 6.50 USD exact, whole => 7
  const res10 = convertAudToUsd(10, 0.65);
  assert.equal(res10.exactUsd, 6.5);
  assert.equal(res10.exactUsdFormatted, "6.50");
  assert.equal(res10.wholeUsd, 7);
});

test("currency: convertUsdToAud calculates exact 2 decimals and rounded up whole AUD", () => {
  // USD $1 with 0.65 rate => 1 / 0.65 = 1.5384... => 1.54 exact, whole => 2
  const res = convertUsdToAud(1, 0.65);
  assert.equal(res.exactAud, 1.54);
  assert.equal(res.exactAudFormatted, "1.54");
  assert.equal(res.wholeAud, 2);
});

test("currency: formatAud enforces whole numbers only rounded up", () => {
  assert.equal(formatAud(1), "$1 AUD");
  assert.equal(formatAud(1.2), "$2 AUD");
  assert.equal(formatAud(2.01), "$3 AUD");
});

test("currency: formatUsd enforces maximum 2 decimal places", () => {
  assert.equal(formatUsd(0.65), "$0.65 USD");
  assert.equal(formatUsd(1), "$1.00 USD");
  assert.equal(formatUsd(2.3456), "$2.35 USD");
});
