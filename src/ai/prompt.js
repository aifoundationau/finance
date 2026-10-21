import { SECTORS } from "../lib/classify.js";

// The analyst brief, verbatim, used as the system prompt for AI mode.
export const ANALYST_BRIEF = `# Role & Objective
You are an autonomous Market Intelligence & Government Procurement Analyst. Your daily objective is to monitor, aggregate, and synthesize news reports, media releases, and market intelligence regarding Australian Federal and State Government contracts with commercial enterprises.

---

### Scope & Parameters
- Target Entities: Publicly traded (focus on ASX) and notable private companies entering agreements with the Australian Federal Government, State/Territory governments, or defense agencies.
- Time Window:
  - Past 7 Days: Confirmed procurement awards, signed agreements, and purchase orders.
  - Next 7 Days (Forward-Looking): Anticipated tenders, expected contract milestones, shortlisted vendors, and credible market speculation.
- Topic Exclusions: General policy debates, generic grants/subsidies without commercial deliverables, or routine employment/public service wage negotiations.

---

### Execution Protocol
1. Search & Information Gathering:
   - Search across Australian financial news (e.g., AFR, The Australian, InnovationAus, ITNews, Defence Connect, Market Index).
   - Use search operators to identify keywords such as:
     - "Australian Government signs contract with"
     - "Department awards contract to"
     - "secures Commonwealth contract"
     - "preferred tenderer" OR "contract expected"
2. Entity Resolution & ASX Mapping:
   - Identify every distinct company named in the reporting.
   - Determine if the company is listed on the Australian Securities Exchange (ASX). If listed, identify the official 3-letter ticker code.
   - If not listed on the ASX, denote whether it is listed on a global exchange (e.g., NASDAQ, NYSE, LSE) or an unlisted private entity.
3. Verification:
   - Filter out duplicate reporting of the same contract across multiple syndications.
   - Distinguish strictly between confirmed agreements and forward-looking speculation.

---

### Output Format
Present the daily findings in the following two structured sections:

#### Section 1: Confirmed Contracts (Past 7 Days)
| Date Signed / Reported | Company Name | ASX / Ticker Code | Government Agency / Department | Contract Value / Scope | Source Headline & Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [YYYY-MM-DD] | [Entity Name] | [e.g., ASX: ABC or Private] | [e.g., Dept of Defence] | [Brief summary of supply/deliverable] | [Source] |

#### Section 2: Upcoming Contracts & Speculation (Next 7 Days Ahead)
| Target Decision Date / Window | Prospective Vendor(s) | ASX / Ticker Code | Procuring Body | Project / Opportunity Details | Speculation / Pipeline Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [Date/Range] | [Entity Name(s)] | [e.g., ASX: XYZ] | [Agency] | [Tender description] | [Why this is expected this week] |

#### Section 3: Strategic Key Takeaways
Provide a concise 3-bullet summary highlighting the most impactful market movements, sectors seeing heightened procurement activity (e.g., Defense, Cyber/IT, Infrastructure), and any notable ASX market reactions.

---

*If no relevant contract news or forward speculation is found within the specified rolling window, explicitly state: "No major government commercial agreements or credible forward speculation reported within the 14-day window."*`;

export function researchPrompt({ today, weekday, window, leads }) {
  return `Today is ${weekday} ${today} (Australia/Sydney).
Past 7 days: ${window.pastFrom} to ${window.pastTo}. Next 7 days: to ${window.forwardTo}.

The app has already collected the leads below from AusTender contract notices, ASX announcements and Australian news feeds. They are unverified machine extractions: confirm, correct or discard each one, then search the web for what they miss, especially State and Territory contracts, defence programs, shortlists and decisions expected in the next 7 days.

<leads>
${JSON.stringify(leads)}
</leads>

Write the report in the format your instructions specify. Give every row a source link and use YYYY-MM-DD dates.`;
}

export function structurePrompt({ markdown, citations }) {
  return `Convert the analyst report below into JSON that matches the schema.
- Use only facts stated in the report; do not add companies, contracts or sources.
- "confirmed" holds the Section 1 rows, "upcoming" the Section 2 rows, "takeaways" the Section 3 bullets (at most 3).
- value_aud is the amount in Australian dollars when the report states one, otherwise null.
- ticker is "ASX: XYZ", "<EXCHANGE>: <CODE>" for other exchanges, "Private", "Government-owned" or "Unknown".
- source_url must be a URL that appears in the report or in the source list.
- If the report says no relevant contracts were found, return empty arrays.

<report>
${markdown}
</report>

<source_list>
${citations.map((c) => `- ${c.title ?? ""} ${c.url}`).join("\n")}
</source_list>`;
}

const LISTINGS = ["ASX", "Overseas", "Private", "Government-owned", "Unknown"];
const JURISDICTIONS = ["Federal", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT", "Local", "Unknown"];
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
const str = (description) => (description ? { type: "string", description } : { type: "string" });

export const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["confirmed", "upcoming", "takeaways"],
  properties: {
    confirmed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "company", "ticker", "listing", "agency", "jurisdiction", "value_aud", "value_text", "scope", "sector", "source_title", "source_url"],
        properties: {
          date: str("YYYY-MM-DD the contract was signed or reported"),
          company: str(),
          ticker: str("'ASX: XYZ', '<EXCHANGE>: <CODE>', 'Private', 'Government-owned' or 'Unknown'"),
          listing: { type: "string", enum: LISTINGS },
          agency: str(),
          jurisdiction: { type: "string", enum: JURISDICTIONS },
          value_aud: nullableNumber,
          value_text: str("Value as reported, e.g. '$110M', or 'Undisclosed'"),
          scope: str(),
          sector: { type: "string", enum: SECTORS },
          source_title: str(),
          source_url: str(),
        },
      },
    },
    upcoming: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["window", "vendors", "procuring_body", "jurisdiction", "project", "context", "sector", "value_aud", "value_text", "source_title", "source_url"],
        properties: {
          window: str("Target decision date or range, e.g. '2026-10-27' or 'Week of 26 Oct'"),
          vendors: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["company", "ticker", "listing"],
              properties: { company: str(), ticker: str(), listing: { type: "string", enum: LISTINGS } },
            },
          },
          procuring_body: str(),
          jurisdiction: { type: "string", enum: JURISDICTIONS },
          project: str(),
          context: str("Why this is expected in the next 7 days"),
          sector: { type: "string", enum: SECTORS },
          value_aud: nullableNumber,
          value_text: str(),
          source_title: str(),
          source_url: str(),
        },
      },
    },
    takeaways: { type: "array", items: { type: "string" } },
  },
};
