import { test } from "node:test";
import assert from "node:assert/strict";
import { announcementToItem, newsToItem } from "../src/pipeline.js";
import { NOW, SETTINGS, resolver } from "./helpers.js";

const r = resolver();
const news = (title, extra = {}) => ({
  title, summary: "", link: `https://example.com/${encodeURIComponent(title)}`, date: "2026-10-20T00:00:00Z",
  publisher: "Example News", publisherUrl: "https://example.com.au", ...extra,
});
const announcement = (code, headline, text = "") => ({
  key: `${code}-${headline}`, code, company: code, date: "2026-10-20T00:00:00Z", headline, text,
  priceSensitive: true, types: ["Progress Report"], url: "https://example.com/doc.pdf",
});
const build = (a) => announcementToItem(a, { resolver: r, settings: SETTINGS, now: NOW });

test("news: an ASX company's federal contract is confirmed and ticker-mapped", () => {
  const item = newsToItem(news("Excite Technology Services (ASX:EXT) Wins a Federal Regulator Contract"), { resolver: r, now: NOW });
  assert.equal(item.kind, "confirmed");
  assert.equal(item.companies[0].code, "EXT");
  assert.equal(item.jurisdiction, "Federal");
});

test("news: a foreign defence department is not the Australian one", () => {
  const item = newsToItem(news("NordSpace Awarded $20 Million Contract with Department of National Defence for Launch from Atlantic Spaceport", { publisherUrl: "https://www.einpresswire.com" }), { resolver: r, now: NOW });
  assert.equal(item, null);
});

test("news: a shortlist with no named vendors still reaches Section 2", () => {
  const item = newsToItem(news("Four shortlisted for CQ gas tender"), { resolver: r, now: NOW });
  assert.equal(item.kind, "upcoming");
  assert.equal(item.jurisdiction, "QLD");
  assert.deepEqual(item.companies, []);
});

test("news: ASX contract news with a private customer goes to the other list", () => {
  const item = newsToItem(news("Pro Medicus signs $43M, seven-year contract with Virtua Health in US"), { resolver: r, now: NOW });
  assert.equal(item.kind, "other");
  assert.equal(item.companies[0].code, "PME");
});

test("announcement: NRFC funding for a Defence program counts", () => {
  const item = build(announcement("ASB", "Austal secures $245M for Landing Craft Heavy Infrastructure",
    "AUSTAL SECURES $245 MILLION TO BUILD LANDING CRAFT HEAVY INFRASTRUCTURE Austal Limited (ASX: ASB) has secured $245 million in debt funding from the National Reconstruction Fund Corporation (NRFC) to fund infrastructure required to deliver its ~$4 billion Landing Craft Heavy (LCH) contract."));
  assert.equal(item.kind, "confirmed");
  assert.equal(item.agency, "National Reconstruction Fund Corporation");
  assert.equal(item.value.amount, 245e6);
  assert.equal(item.sector, "Defence");
  assert.doesNotMatch(item.scope, /^BUILD/); // not the all-caps title
});

test("announcement: a regulator in a filing is not a customer", () => {
  assert.equal(build(announcement("PME", "Extension of Time to Hold 2026 Annual General Meeting", "ASIC has granted an extension.")), null);
  const supply = build(announcement("PME", "Licence & Supply Agreement with Umedica", "The product is registered with the TGA. The agreement with Umedica covers supply."));
  assert.equal(supply.kind, "other");
});

test("announcement: boilerplate 'Commonwealth' does not make a government deal", () => {
  const item = build(announcement("PME", "Secures US$40M Glencore Funding for Prieska", "Orion has secured funding from Glencore. Offers are not made in the Commonwealth of Australia."));
  assert.equal(item, null);
});

test("announcement: local councils stay out of the brief by default", () => {
  const item = build(announcement("PME", "Asset Vision wins $1.55M council contract", "City of Whittlesea awards Asset Vision a five-year contract valued at $1.55 million."));
  assert.equal(item.kind, "other");
  assert.equal(item.note, "Local government counterparty");
});
