// The footer every page must carry (copyright, Founder Welcome and the four policies, in that order),
// and the policy pages it links to: each with its contents, sections, contact email and the same footer.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/config.js";

const read = (file) => fs.readFileSync(path.join(ROOT, "public", file), "utf8");
const FOOTER = [
  ["https://www.aifoundation.net.au/", "© 2026 AI Foundation"],
  ["#welcome", "Founder Welcome"],
  ["/privacy.html", "Privacy Policy"],
  ["/terms.html", "Terms of Service"],
  ["/ai-policy.html", "AI Policy (ISO/IEC 42001)"],
  ["/token-policy.html", "Token Policy"],
];
const PAGES = ["privacy.html", "terms.html", "ai-policy.html", "token-policy.html"];

/** [href, text] of each link in an HTML fragment, in order. */
const links = (html) => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, text]) => [href, text.replace(/&copy;/g, "©").replace(/<[^>]+>/g, "").trim()]);

test("the app's footer has the copyright, Founder Welcome and the four policies, in order", () => {
  const html = read("index.html");
  const nav = html.slice(html.indexOf('<nav class="foot-links"'), html.indexOf("</nav>", html.indexOf('<nav class="foot-links"')));
  assert.deepEqual(links(nav), FOOTER);
  // Outside the views, so it shows on every one.
  assert.ok(html.indexOf('<footer class="app-foot">') > html.lastIndexOf('<section class="view"'));
  assert.ok(html.includes('id="welcome" data-view="welcome"'));
});

for (const file of PAGES) {
  test(`${file}: contents match its sections, with the contact email and the same footer`, () => {
    const page = read(file);
    assert.ok(page.includes('<html lang="en-AU">') && page.includes('<link rel="stylesheet" href="/legal.css">'));
    assert.match(page, /Last updated: <time datetime="\d{4}-\d{2}-\d{2}">/);
    const contents = page.slice(page.indexOf('<nav class="contents"'), page.indexOf("</nav>"));
    const ids = links(contents).map(([href]) => href.slice(1));
    assert.ok(ids.length > 3);
    for (const id of ids) assert.ok(page.includes(`<section id="${id}">`), `section ${id}`);
    assert.ok(page.includes("mailto:support@aifoundation.net.au"));
    const footer = page.slice(page.indexOf('<footer class="site-footer">'));
    assert.deepEqual(links(footer).map(([href, text]) => [href.replace(/^\/#/, "#"), text]), FOOTER);
  });
}

test("the Token Policy says what the business decided", () => {
  const policy = read("token-policy.html");
  for (const text of ["100 tokens for US$100", "converted to Australian dollars", "Each share costs 1 token", "more than 100 tokens", "72 hours' notice", "international wire transfer fees and surcharges"]) {
    assert.ok(policy.includes(text), text);
  }
});

test("the Terms say the brief is general information, not financial advice", () => {
  const terms = read("terms.html");
  assert.ok(terms.includes('<section id="not-advice">'));
  assert.ok(terms.includes("isn't financial product advice"));
});
