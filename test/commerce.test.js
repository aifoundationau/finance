import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../src/config.js";
import {
  CommerceError, DETAILS_ITEM_ID, _defaultState, _resetForTests, adjustWallet, createItem, deleteItem, getState,
  publicCommerce, redactReport, unlockItem, updateItem, updateSettings, viewerCountry, wholeNumber,
} from "../src/commerce.js";
import { reportToMarkdown } from "../src/lib/markdown.js";

// Never touch the real data/commerce.json.
config.dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mao-commerce-"));

const wallet = (balance, unlocks = []) => ({ id: "w1", balance, unlocks, createdAt: "2026-10-22T00:00:00Z" });

beforeEach(() => {
  const s = _defaultState();
  s.wallets.w1 = wallet(2);
  _resetForTests(s);
});

const report = () => ({
  id: "2026-10-22-standard", date: "2026-10-22", mode: "standard", generatedAt: "2026-10-22T08:00:00Z",
  window: { pastFrom: "2026-10-15", pastTo: "2026-10-22", forwardTo: "2026-10-29" }, takeaways: [],
  ai: { model: "m", usage: { searches: 1 }, costUsd: 1, markdown: "secret analyst text" },
  confirmed: [
    { id: "a", kind: "confirmed", date: "2026-10-21", title: "Austal secures $245M", companies: [{ display: "Austal", listing: "ASX", code: "ASB" }], agency: "NRFC", value: { amount: 245e6, currency: "AUD", text: "$245M" }, scope: "LCH", sources: [{ title: "x", url: "https://x" }], stage: "awarded" },
    { id: "b", kind: "confirmed", date: "2026-10-21", title: "Excite", companies: [], agency: "Regulator", value: { amount: 2.9e6, currency: "AUD", text: "$2.9M" }, scope: "Forensics", sources: [{ title: "y", url: "https://y" }], stage: "awarded" },
  ],
  upcoming: [],
  other: [],
});

test("whole numbers only: decimals and strings are rejected, never rounded", () => {
  assert.equal(wholeNumber(25, "Price"), 25);
  for (const bad of [25.5, "25", -1, NaN, null]) assert.throws(() => wholeNumber(bad, "Price"), CommerceError);
  return assert.rejects(updateSettings({ tokenPriceAud: 2.5 }), /whole number/);
});

test("unlocking spends the item's token amount once per contract", async () => {
  assert.equal((await unlockItem("w1", "a")).spent, 1);
  assert.equal((await unlockItem("w1", "a")).spent, 0); // already unlocked: free
  assert.equal((await unlockItem("w1", "b")).wallet.balance, 0);
  await assert.rejects(unlockItem("w1", "c"), (err) => err.status === 402);
});

test("the token cost comes from the Superadmin item, not the code", async () => {
  await updateItem(DETAILS_ITEM_ID, { tokenAmount: 2 });
  assert.equal((await unlockItem("w1", "a")).wallet.balance, 0);
  await updateItem(DETAILS_ITEM_ID, { isActive: false });
  await assert.rejects(unlockItem("w1", "b"), /not available/);
});

test("locked items lose value/scope and sources; unlocked ones keep them", async () => {
  const s = await getState();
  const out = redactReport(report(), s, wallet(0, ["a"]));
  assert.equal(out.confirmed[0].value.text, "$245M");
  assert.equal(out.confirmed[1].locked, true);
  assert.equal(out.confirmed[1].value, null);
  assert.equal(out.confirmed[1].scope, null);
  assert.equal(out.confirmed[1].title, null);
  assert.deepEqual(out.confirmed[1].sources, []);
  assert.equal(out.confirmed[1].agency, "Regulator"); // still visible
  assert.equal(out.ai.markdown, undefined); // raw analyst text would leak every value
  const md = reportToMarkdown(out);
  assert.doesNotMatch(md, /\$2\.9M|Forensics|https:\/\/y/);
  assert.match(md, /Locked/);
});

test("with the token system off nothing is locked and no token data is public", async () => {
  await updateSettings({ isTokenSystemEnabled: false });
  const s = await getState();
  assert.equal(redactReport(report(), s, wallet(0)).confirmed[1].value.text, "$2.9M");
  assert.deepEqual(publicCommerce(s, wallet(5), "AU"), { tokenSystemEnabled: false });
});

test("AUD shows only to Australian visitors; each currency follows its own toggle", async () => {
  await updateSettings({ tokenPriceAud: 3, tokenPriceUsd: 2 });
  let s = await getState();
  assert.deepEqual(publicCommerce(s, wallet(1), "AU").items[0].price, { aud: 3, usd: 2 });
  assert.deepEqual(publicCommerce(s, wallet(1), "US").items[0].price, { usd: 2 });
  await updateSettings({ isUsdEnabled: false });
  s = await getState();
  assert.deepEqual(publicCommerce(s, wallet(1), "US").items[0].price, {}); // no currencies: no tooltip
  assert.deepEqual(publicCommerce(s, wallet(1), "AU").tokenPrice, { aud: 3 });
});

test("item prices are integers, explicit or token amount x token price", async () => {
  await updateSettings({ tokenPriceAud: 4, tokenPriceUsd: 3 });
  await createItem({ title: "Weekly pack", description: "x", tokenAmount: 5, priceAud: 18 });
  const s = await getState();
  const pack = publicCommerce(s, wallet(0), "AU").items.find((i) => i.title === "Weekly pack");
  assert.deepEqual(pack.price, { aud: 18, usd: 15 });
  await assert.rejects(createItem({ title: "Bad", tokenAmount: 1.5 }), /whole number/);
  await assert.rejects(deleteItem(DETAILS_ITEM_ID), (err) => err.status === 409);
});

test("wallet adjustments are whole numbers and never go negative", async () => {
  await adjustWallet("w1", 10);
  assert.equal((await getState()).wallets.w1.balance, 12);
  await assert.rejects(adjustWallet("w1", -20), /below zero/);
  await assert.rejects(adjustWallet("w1", 0.5), /whole number/);
});

test("viewer country: CDN header first, then time zone or language", () => {
  process.env.GEO_COUNTRY_HEADER = "cf-ipcountry";
  assert.equal(viewerCountry({ headers: { "cf-ipcountry": "us", "x-client-timezone": "Australia/Sydney" } }), "US");
  delete process.env.GEO_COUNTRY_HEADER;
  assert.equal(viewerCountry({ headers: { "x-client-timezone": "Australia/Perth" } }), "AU");
  assert.equal(viewerCountry({ headers: { "accept-language": "en-AU,en;q=0.9" } }), "AU");
  assert.equal(viewerCountry({ headers: { "accept-language": "en-US" } }), null);
});
