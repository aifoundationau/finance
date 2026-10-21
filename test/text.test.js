import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, displayName, firstMoney, formatMoney, parseMoney, prettyName } from "../src/lib/text.js";
import { parseCsv, toCsv } from "../src/lib/csv.js";

test("parseMoney reads the formats used in headlines and announcements", () => {
  const cases = [
    ["Ventia secures AUD 110 million contract", 110e6, "AUD"],
    ["PME signs A$43M, 7-year contract", 43e6, "AUD"],
    ["$2.9M Contract with Federal Government Regulator", 2.9e6, "AUD"],
    ["valued at $1,548,800 excluding GST", 1_548_800, "AUD"],
    ["PLS prices US$700M Senior Unsecured Notes", 700e6, "USD"],
    ["approximately $12.3 million (NZ$15.1 million)", 12.3e6, "AUD"],
    ["a ~$4 billion contract", 4e9, "AUD"],
    ["$245m debt funding", 245e6, "AUD"],
  ];
  for (const [text, amount, currency] of cases) {
    const [first] = parseMoney(text);
    assert.equal(first.amount, amount, text);
    assert.equal(first.currency, currency, text);
  }
  assert.deepEqual(parseMoney("Rs 4,106 crore deal"), []);
});

test("firstMoney skips small amounts such as share prices", () => {
  assert.equal(firstMoney("shares rose to $0.45 after a $12 million order").amount, 12e6);
  assert.equal(firstMoney("no amount here"), null);
});

test("formatMoney compacts like the brief", () => {
  assert.equal(formatMoney(5_134_233.55), "$5.13M");
  assert.equal(formatMoney(245e6), "$245M");
  assert.equal(formatMoney(2.9e6), "$2.9M");
  assert.equal(formatMoney(1.2e9), "$1.2B");
  assert.equal(formatMoney(62_373), "$62.4k");
  assert.equal(formatMoney(700e6, "USD"), "US$700M");
});

test("company names display cleanly", () => {
  assert.equal(prettyName("TECHNOLOGY ONE LIMITED"), "Technology One Limited");
  assert.equal(prettyName("DATA#3 LIMITED"), "Data#3 Limited");
  assert.equal(displayName("SG FLEET AUSTRALIA PTY LIMITED"), "SG Fleet Australia");
  assert.equal(displayName("The Trustee for Docklands Melbourne Investment Trust"), "Docklands Melbourne Investment Trust");
  assert.equal(displayName("Leidos Australia Pty Ltd"), "Leidos Australia");
});

test("cleanText decodes entity-encoded HTML from feeds", () => {
  assert.equal(cleanText("&lt;p&gt;Defence &amp; industry&lt;/p&gt;"), "Defence & industry");
});

test("CSV round-trips quotes and neutralises formulas", () => {
  assert.deepEqual(parseCsv('"ASX code","Company name"\n"TNE","TECHNOLOGY ONE, LTD"\n'), [["ASX code", "Company name"], ["TNE", "TECHNOLOGY ONE, LTD"]]);
  assert.equal(toCsv([["=SUM(A1)", 'say "hi"']]), `'=SUM(A1),"say ""hi"""`);
});
