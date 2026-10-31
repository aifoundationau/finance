import test from "node:test";
import assert from "node:assert/strict";
import { GLOBAL_COUNTRIES, COUNTRY_NAME_MAP, getCountryName, fetchWorldBankPpp } from "../public/shared/countries.js";

test("GLOBAL_COUNTRIES contains all standard countries and territories sorted by name", () => {
  assert.ok(Array.isArray(GLOBAL_COUNTRIES));
  assert.ok(GLOBAL_COUNTRIES.length >= 240, `Expected at least 240 countries, got ${GLOBAL_COUNTRIES.length}`);

  // Checks key countries
  const codes = new Set(GLOBAL_COUNTRIES.map((c) => c.code));
  for (const expected of ["AU", "NZ", "KH", "TH", "VN", "US", "GB", "JP", "IN", "SG"]) {
    assert.ok(codes.has(expected), `Missing expected country code: ${expected}`);
  }

  // Sorted by name
  for (let i = 1; i < GLOBAL_COUNTRIES.length; i++) {
    assert.ok(
      GLOBAL_COUNTRIES[i - 1].name.localeCompare(GLOBAL_COUNTRIES[i].name) <= 0,
      `Unsorted: ${GLOBAL_COUNTRIES[i - 1].name} vs ${GLOBAL_COUNTRIES[i].name}`
    );
  }
});

test("getCountryName resolves ISO-2 codes and falls back cleanly", () => {
  assert.equal(getCountryName("KH"), "Cambodia");
  assert.equal(getCountryName("TH"), "Thailand");
  assert.equal(getCountryName("AU"), "Australia");
  assert.equal(getCountryName("NZ"), "New Zealand");
  assert.equal(getCountryName("US"), "United States");
  assert.equal(getCountryName(""), "");
  assert.equal(getCountryName("ZZ"), "ZZ");
});

test("fetchWorldBankPpp validates country codes and handles invalid inputs gracefully", async () => {
  assert.equal(await fetchWorldBankPpp(""), null);
  assert.equal(await fetchWorldBankPpp("INVALID"), null);
  assert.equal(await fetchWorldBankPpp("123"), null);
});

