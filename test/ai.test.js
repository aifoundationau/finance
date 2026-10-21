import { test } from "node:test";
import assert from "node:assert/strict";
import { itemsFromStructured } from "../src/ai/analyst.js";
import { REPORT_SCHEMA } from "../src/ai/prompt.js";
import { resolver } from "./helpers.js";

const r = resolver();
const row = (over) => ({
  date: "2026-10-20", company: "Excite Technology Services", ticker: "ASX: EXT", listing: "ASX", agency: "Federal regulator",
  jurisdiction: "Federal", value_aud: 2_900_000, value_text: "$2.9M", scope: "Digital forensics software", sector: "Cyber/IT",
  source_title: "Excite wins", source_url: "https://example.com/a", ...over,
});

test("AI rows become report items with verified tickers", () => {
  const { confirmed, upcoming, takeaways } = itemsFromStructured(
    {
      confirmed: [
        row(),
        row({ company: "Austal", ticker: "ASX: TNE" }), // another company's real code: the name wins
        row({ company: "Made Up Pty Ltd", ticker: "ASX: ZZZ", listing: "ASX" }), // hallucinated: flagged, not trusted
        row({ company: "Lockheed Martin", ticker: "NYSE: LMT", listing: "Overseas" }),
        row({ company: "Not named", ticker: "Unknown", source_url: "javascript:alert(1)" }),
      ],
      upcoming: [
        {
          window: "2026-10-27", vendors: [{ company: "BESIX Watpac", ticker: "Private", listing: "Private" }], procuring_body: "Macquarie Point Development Corporation",
          jurisdiction: "TAS", project: "Hobart stadium main works", context: "Preferred builder named; contract expected", sector: "Infrastructure",
          value_aud: null, value_text: "Undisclosed", source_title: "Builder chosen", source_url: "https://example.com/b",
        },
      ],
      takeaways: ["a", "b", "c", "d"],
    },
    r,
    "2026-10-21",
  );
  assert.equal(confirmed[0].companies[0].code, "EXT");
  assert.equal(confirmed[0].value.amount, 2.9e6);
  assert.equal(confirmed[1].companies[0].code, "ASB");
  assert.equal(confirmed[2].companies[0].listing, "Unverified");
  assert.match(confirmed[2].companies[0].note, /ASX: ZZZ/);
  assert.equal(confirmed[3].companies[0].code, "LMT");
  assert.deepEqual(confirmed[4].companies, []);
  assert.deepEqual(confirmed[4].sources, []); // unsafe URL dropped
  assert.equal(upcoming[0].window.to, "2026-10-27");
  assert.equal(upcoming[0].companies[0].listing, "Private");
  assert.equal(upcoming[0].value, null);
  assert.equal(upcoming[0].stage, "preferred");
  assert.equal(takeaways.length, 3);
});

test("the structured-output schema is closed and fully required", () => {
  const check = (schema) => {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
      Object.values(schema.properties).forEach(check);
    }
    if (schema.type === "array") check(schema.items);
  };
  check(REPORT_SCHEMA);
});
