import { test } from "node:test";
import assert from "node:assert/strict";
import { coreName, tickerLabel } from "../src/lib/entities.js";
import { resolver } from "./helpers.js";

const r = resolver();
const resolve = (name) => r.resolveName(name);

test("coreName strips legal forms and generic suffixes", () => {
  assert.equal(coreName("QBE Insurance (Australia) Limited"), "QBE INSURANCE");
  assert.equal(coreName("VENTIA SERVICES GROUP LIMITED"), "VENTIA SERVICES");
  assert.equal(coreName("The Trustee for the Smith Family Trust"), "SMITH");
  assert.equal(coreName("Johnson & Johnson Pty Ltd"), "JOHNSON AND JOHNSON");
});

test("AusTender supplier names resolve to ASX tickers", () => {
  assert.equal(resolve("Technology One Limited").code, "TNE");
  assert.equal(resolve("Austal Ships Pty Ltd").code, "ASB"); // alias
  assert.equal(resolve("Downer EDI Works Pty Ltd").code, "DOW"); // multi-word prefix
  assert.equal(resolve("Monadelphous Engineering Pty Ltd").code, "MND"); // distinctive word + descriptor
  assert.equal(resolve("Telstra Limited").code, "TLS"); // alias for the pre-2022 entity name
  assert.equal(resolve("Codan Limited").code, "CDA");
  assert.equal(resolve("CBIT Pty Ltd").code, "EXT"); // Excite's contracting subsidiary
});

test("look-alike names do not borrow a ticker", () => {
  assert.equal(resolve("Aspen Medical Pty Ltd").listing, "Private"); // not Aspen Group (APZ)
  assert.equal(resolve("Aspen Pty Ltd").listing, "Unverified");
  assert.equal(resolve("Zip Industries Pty Ltd").listing, "Unverified");
});

test("overseas, private and delisted suppliers are labelled", () => {
  const leidos = resolve("Leidos Australia Pty Ltd");
  assert.equal(tickerLabel(leidos), "NYSE: LDOS");
  assert.equal(tickerLabel(resolve("Boeing Defence Australia Ltd")), "NYSE: BA");
  assert.equal(resolve("Deloitte Touche Tohmatsu").listing, "Private");
  assert.equal(resolve("ASC Pty Ltd").listing, "Government-owned");
  assert.equal(resolve("SG FLEET AUSTRALIA PTY LIMITED").listing, "Private");
  assert.equal(tickerLabel(resolve("Some Unknown Supplier Pty Ltd")), "Unlisted / unverified");
});

test("findInText picks up explicit tickers and company names", () => {
  const found = r.findInText("Excite Technology Services (ASX: EXT) wins federal regulator deal; Telstra and Leidos also named");
  assert.deepEqual(found.map((c) => c.code), ["EXT", "TLS", "LDOS"]);
});

test("findInText avoids common words and acronyms", () => {
  assert.deepEqual(r.findInText("The ASX: EXT announcement").map((c) => c.code), ["EXT"]); // "ASX" is not ASX Ltd
  assert.equal(r.findInText("Aspen Medical wins Defence deal").find((c) => c.code === "APZ"), undefined);
  assert.equal(r.findInText("Codan's radios win Army order")[0].code, "CDA"); // possessive
  assert.equal(r.findInText("sap flows in spring").length, 0); // lowercase acronym-alias
});

test("an ASX alias that is no longer listed says so", () => {
  const delisted = r.resolveName("Lend Lease Building Pty Ltd"); // LLC not in this test list
  assert.equal(delisted.listing, "Unverified");
  assert.match(delisted.note, /not in the current ASX list/);
});
