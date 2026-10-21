import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../src/lib/rss.js";
import { normalizeRelease } from "../src/sources/austender.js";
import { parseAtmList } from "../src/sources/atm.js";
import { dedupe } from "../src/lib/dedupe.js";
import { NO_FINDINGS, reportToMarkdown } from "../src/lib/markdown.js";

test("parseFeed reads RSS (Google News style) and Atom", () => {
  const rss = `<rss><channel><item><title>Ventia secures contract - AFR</title><link>https://news.google.com/x</link>
    <pubDate>Mon, 20 Oct 2026 01:00:00 GMT</pubDate><description><![CDATA[<p>Body &amp; more</p>]]></description>
    <source url="https://www.afr.com">The Australian Financial Review</source></item></channel></rss>`;
  const [item] = parseFeed(rss);
  assert.equal(item.title, "Ventia secures contract - AFR");
  assert.equal(item.description, "Body & more");
  assert.equal(item.source.url, "https://www.afr.com");
  assert.equal(item.date, "2026-10-20T01:00:00.000Z");
  const atom = `<feed><entry><title type="html">Atom title</title><link href="https://a.example/1"/><updated>2026-10-19T00:00:00Z</updated></entry></feed>`;
  assert.equal(parseFeed(atom)[0].link, "https://a.example/1");
});

test("AusTender releases normalise, with the public notice link and amendment ids", () => {
  const base = {
    date: "2026-10-21T02:33:50Z",
    parties: [
      { name: "Technology One Limited", roles: ["supplier"], additionalIdentifiers: [{ scheme: "AU-ABN", id: "84010487180" }] },
      { name: "National Indigenous Australians Agency", roles: ["procuringEntity"] },
    ],
    awards: [{ id: "CN4283814-3178fd14ea3d48bbb980ceabc38fecf8" }],
    contracts: [{ id: "CN4283814", awardID: "CN4283814-3178fd14ea3d48bbb980ceabc38fecf8", description: "Software", value: { amount: "1211087.14", currency: "AUD" }, items: [{ classification: { id: "43231500" } }] }],
  };
  const original = normalizeRelease({ ...base, tag: ["contract"] });
  assert.equal(original.url, "https://www.tenders.gov.au/Cn/Show/3178fd14-ea3d-48bb-b980-ceabc38fecf8");
  assert.equal(original.cnId, "CN4283814");
  assert.equal(original.sector, "Cyber/IT");
  assert.equal(original.suppliers[0].abn, "84010487180");
  const amendment = normalizeRelease({ ...base, tag: ["contractAmendment"], contracts: [{ ...base.contracts[0], amendments: [{ id: "CN4283814-A1" }] }] });
  assert.equal(amendment.cnId, "CN4283814-A1");
  assert.equal(amendment.amendment, true);
});

test("AusTender open-tender list parses close times in Canberra time", () => {
  const html = `<div class="row"> <div class="col-sm-4"> <div class="box"><p class="lead" role="heading">Townsville Demolition</p></div></div>
    <div class="col-sm-8"><div class="list-desc"> <span>ATM ID:</span> <div class="list-desc-inner"> <a href="/Atm/Show/62588e72-df93-4f07-ade4-53ab55c29d4e">6132-2025-26</a> </div> </div>
    <div class="list-desc"> <span>Close Date &amp; Time:</span> <div class="list-desc-inner"> 22-Oct-2026 12:00 pm <span>(ACT Local Time)</span> </div> </div>
    <div class="list-desc"> <span>Agency:</span> <div class="list-desc-inner">Bureau of Meteorology</div> </div></div></div>`;
  const [atm] = parseAtmList(html);
  assert.equal(atm.atmId, "6132-2025-26");
  assert.equal(atm.agency, "Bureau of Meteorology");
  assert.equal(atm.closes, "2026-10-22T01:00:00.000Z"); // noon AEDT = 01:00 UTC
});

const item = (over) => ({ kind: "confirmed", date: "2026-10-20", title: "", companies: [], value: null, sources: [{ type: "news", url: Math.random().toString(), publisher: "AFR" }], confidence: "low", jurisdiction: null, ...over });
const excite = { display: "Excite Technology Services", listing: "ASX", exchange: "ASX", code: "EXT" };

test("dedupe merges syndicated copies of one contract", () => {
  const merged = dedupe([
    item({ title: "$2.9M Contract with Federal Government Regulator", companies: [excite], value: { amount: 2.9e6, currency: "AUD", text: "$2.9M" }, sources: [{ type: "asx", url: "a" }], confidence: "high" }),
    item({ title: "Excite bags $2.9m federal regulator deal", companies: [{ display: "Excite", listing: "Unverified" }], value: { amount: 2.9e6, currency: "AUD", text: "$2.9m" } }),
    item({ title: "Excite Technology Services wins federal regulator contract", companies: [excite] }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].sources.length, 3);
  assert.deepEqual(merged[0].companies.map((c) => c.display), ["Excite Technology Services"]);
});

test("dedupe keeps two contracts of different value apart", () => {
  const pme = { display: "Pro Medicus", listing: "ASX", exchange: "ASX", code: "PME" };
  const kept = dedupe([
    item({ title: "PME signs A$43M, 7-year contract with Virtua Health", companies: [pme], value: { amount: 43e6, currency: "AUD" } }),
    item({ title: "PME signs AUD $24M, 7-year contract with Billings Clinic", companies: [pme], value: { amount: 24e6, currency: "AUD" } }),
  ]);
  assert.equal(kept.length, 2);
});

test("Markdown export uses the brief's exact sections, or its no-findings sentence", () => {
  const report = { date: "2026-10-21", mode: "standard", generatedAt: "2026-10-21T08:00:00Z", window: { pastFrom: "2026-10-14", pastTo: "2026-10-21", forwardTo: "2026-10-28" }, takeaways: [] };
  assert.match(reportToMarkdown({ ...report, confirmed: [], upcoming: [] }), new RegExp(NO_FINDINGS.replace(/[.]/g, "\\.")));
  const md = reportToMarkdown({
    ...report,
    confirmed: [item({ date: "2026-10-21", companies: [excite], agency: "Federal regulator | unnamed", value: { text: "$2.9M" }, scope: "Digital forensics", sources: [{ title: "Excite wins", url: "https://x.example/a" }] })],
    upcoming: [],
    takeaways: ["One", "Two", "Three"],
  });
  assert.match(md, /#### Section 1: Confirmed Contracts \(Past 7 Days\)/);
  assert.match(md, /\| Date Signed \/ Reported \| Company Name \| ASX \/ Ticker Code \| Government Agency \/ Department \| Contract Value \/ Scope \| Source Headline & Link \|/);
  assert.match(md, /\| 2026-10-21 \| Excite Technology Services \| ASX: EXT \| Federal regulator \\\| unnamed \| \$2\.9M: Digital forensics \| \[Excite wins\]\(https:\/\/x\.example\/a\) \|/);
  assert.match(md, /#### Section 3: Strategic Key Takeaways\n- One\n- Two\n- Three/);
});
