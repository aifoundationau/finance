# MY ASX Options · Gov Contract Radar

A local web app that produces a daily brief on Australian Federal and State government contracts with commercial companies, maps every company to its ASX ticker (or overseas listing, or private status), and flags which tickers have exchange-traded options.

Each report follows the analyst brief's three sections:

1. **Confirmed contracts (past 7 days):** awards, signed agreements, purchase orders and AusTender contract notices.
2. **Upcoming contracts & speculation (next 7 days):** tenders, shortlists, preferred tenderers, expected decisions.
3. **Strategic key takeaways:** the biggest ASX-linked awards, the busiest sectors, and price reactions.

A fourth list, **Other ASX**, shows listed companies' contract announcements where no Australian government customer was identified (for example US hospital deals). They're not part of the brief, but they often move prices.

## Quick start

Requires Node.js 20.10 or later.

```powershell
npm install
npm start
```

Open <http://localhost:3000>. On first start the app builds today's report, which takes about 30 seconds. **Refresh** builds a new one at any time.

## How a report is built

| Source | What it contributes | Notes |
|---|---|---|
| AusTender OCDS API (Department of Finance) | Every Commonwealth contract notice published in the past 7 days, with supplier, ABN, agency, value and category | Official, CC BY 3.0 AU. Kept when the supplier is ASX-listed (≥ $100k), overseas-listed (≥ $1M), or the contract is ≥ $20M. Thresholds are in Settings. |
| ASX announcements | Listed companies' own contract disclosures. The app reads the first pages of each candidate PDF to find the government counterparty. | The feed behind asx.com.au, not a documented public API; it may change without notice. |
| Google News search (Australian edition) | Coverage from the AFR, The Australian, Defence Connect, Market Index, state outlets and others | 24 targeted searches, including `site:` searches of the outlets the brief names. |
| Publisher RSS | iTnews, InnovationAus, Government News, Asia Pacific Defence Reporter, Stockhead, The Market Online, Business News, ABC and SMH business | |
| ASX quotes and options | Latest price move, market cap, and exchange-traded options availability (expiries) for every ASX ticker in the report | Delayed prices. |
| AusTender open tenders (**off by default**) | Commonwealth tenders closing in the next 7 days | tenders.gov.au refuses non-browser clients, so this source sends a browser-style User-Agent. Turn it on in Settings only if you're comfortable with that and with AusTender's terms. |

The pipeline then:

- **Classifies** each item as confirmed or forward-looking (e.g. "awarded" vs "preferred tenderer" or "shortlisted").
- **Applies the brief's exclusions:** grants and co-funding, wage deals, policy debates, prizes, and mining permits/acreage.
- **Identifies the government counterparty**, from the Department of Defence down to state-owned corporations. Regulators mentioned in filings (ASIC, TGA) don't count as customers. Generic mentions only count in an Australian context.
- **Resolves companies** against the live ASX company list plus a curated table of subsidiaries and overseas primes (`src/data/aliases.js`). For example, "Austal Ships Pty Ltd" maps to ASX: ASB and "Leidos Australia" to NYSE: LDOS. "Aspen Medical" is *not* matched to Aspen Group.
- **Merges duplicates** across syndications and sources, keeping every source link.

## Tokens and the Superadmin panel

The app follows the workspace's token-economy rule (`.agents/rules/token-economy.md`).

- **What costs a token:** viewing a contract's **value/scope and sources** costs the token amount of the *Contract details* item (1 token by default). It is charged once per contract, and an unlocked contract stays visible in later reports. Company, ticker, agency, date and the takeaways stay free.
- **Enforced on the server:** locked fields are removed from the API, the Markdown and CSV exports, and the raw AI write-up, not just hidden in the page.
- **Visitors see tokens only:** a token icon and a whole-number amount. Hovering (or focusing) the amount shows the dollar price in enabled currencies.
- **Currencies:** AUD shows only to visitors in Australia; USD follows its own toggle. Behind a CDN, set `GEO_COUNTRY_HEADER` (e.g. `cf-ipcountry`); otherwise the browser's time zone and language decide.
- **Superadmin panel:** open **Settings → Open Superadmin panel** (or `/#admin`) and sign in with `SUPERADMIN_PASSWORD` from `.env`. From there you can:
  - switch the token system, AUD and USD on or off independently
  - set whole-dollar token prices
  - create, edit, deactivate and delete saleable items
  - add or remove tokens on any wallet, including your own
- **Wallets:** each browser gets an anonymous wallet (a cookie), identified by a short label such as `E9B7B9`.
- **Payments:** online payment isn't connected yet, so the *Buy tokens* button is disabled. Credit wallets from the panel until a payment provider is added.
- **Whole numbers:** all token amounts and prices are integers; anything else is rejected.

Commerce state is stored in `data/commerce.json`.

## AI analyst (optional)

The standard report is rule-based and needs no account. With an Anthropic API key, an **AI analyst** report runs your brief verbatim (`src/ai/prompt.js`) on Claude Opus 5.5 with web search. The standard report's leads are passed in as unverified input to confirm or discard, and the model searches for what they miss. Tickers it suggests are re-checked against the live ASX list.

1. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.
2. Restart the app, then use **Settings → Run AI analysis now** (or `npm run report:ai`).

AI runs are billed to your Anthropic account. Each AI report shows its token use, number of searches and an estimated cost, and the raw analyst write-up is under Settings. The run uses up to the configured number of web searches (default 12) at the configured effort (default `high`).

## Daily schedule

While the app is running it builds a report every day at **6:00 pm Sydney time**. That's after the ASX close, so the day's announcements and price reactions are included and the brief is ready before the next open. It also builds one at start-up if today's is missing. Change the time, or switch scheduled runs to AI mode, in Settings.

To run it without keeping the app open, use Windows Task Scheduler:

```powershell
schtasks /Create /TN "MY ASX Options daily report" /SC DAILY /ST 18:00 /TR "\"C:\Program Files\nodejs\node.exe\" \"E:\Antigravity Projects\finance\scripts\run-report.js\""
```

Add `--ai` after the script path for AI reports. Reports are saved in `data/reports/` and appear in the app's report picker.

## Using the app

- **Filters** (search, ASX-listed, *Has options*, Watchlist, sector, government, source) apply to every table and to the KPI tiles and sector chart.
- **Watchlist** (Settings): ASX codes you hold or trade. Matching rows get a star, and a notice lists them.
- **Company name** opens details: all sources, AusTender notices, latest price, market cap, option expiries, and links to the ASX company and announcements pages.
- **Copy Markdown** copies the brief in the exact table format of the analyst prompt. **CSV** downloads all three lists.

The layout is fluid from 240px feature phones to 4K monitors:

| Width / device | Layout |
|---|---|
| Phones | Bottom tab bar, and tables become cards |
| Tablets and landscape phones | Navigation rail; cards in two columns |
| Laptops | Sidebar, with the brief's sections together and real tables |
| Wide monitors | Takeaways pinned in a right-hand column |
| Dual-screen foldables (Surface Duo, Galaxy Z Fold, Pixel Fold, Zenbook Fold) | Lists on one screen, the brief on the other, nothing under the hinge |

It also adapts to touch versus mouse, short landscape screens, dark mode, reduced motion, forced colours and printing.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Web app on `PORT` (default 3000), bound to `127.0.0.1` |
| `npm run report` | Build a standard report from the command line |
| `npm run report:ai` | Standard plus AI analyst report |
| `npm test` | Unit tests (Node's built-in runner) |

`node scripts/run-report.js --print` also prints the Markdown brief.

## Automation and API contracts

The app follows the agentic architecture rule in `.agents/rules/dom-agentic-architecture.md`, so people, scripts and browser agents can drive it reliably.

- **Schemas:** `shared/schemas.js` holds one JSON Schema per contract: settings, every request body, commerce state and the saved report. Every object sets `required` and `additionalProperties: false`. The server rejects a body that fails its schema with `400 VALIDATION_FAILED` and a `fields` list. A report that fails its schema is never saved. The browser builds the Settings and Superadmin forms from the same schemas, so client and server checks always agree.
- **API:** `GET /api/openapi.json` describes every endpoint and its request schema. Errors are always `{ error, code, fields? }`.
- **Idempotency:** every POST, PUT and DELETE must send an `x-idempotency-key` header (8–128 letters, digits, `-` or `_`). If the same key arrives again with the same request, the server replays the first response (`idempotent-replayed: true`) rather than running the request again. The same key with a different body gets `422`. A missing key gets `428`.
- **Retries:** the client and the report fetchers share `shared/retry.js`. It starts at 500 ms, doubles each time, adds up to 250 ms of jitter and allows at most 3 retries.
- **DOM:** every interactive element has a matching `data-agent-id` and `data-testid`, every input has a `<label for>`, and field errors appear in `[data-agent-error="<path>"]` nodes linked by `aria-describedby`. The page shows `body[data-ready="true"]` when nothing is loading, and `#agent-status` (an `aria-live` region) shows the current state or the latest error.
- **Driver:** `window.AntigravityDOMDriver` (`public/agent-driver.js`) offers `waitForReady`, `executeSafeClick`, `executeSafeInput`, `executeSafeSelect`, `executeSafeToggle` and `validateAndDispatch`. Each action waits up to 3 s for its target and checks that the target is visible, enabled and not covered. It then confirms the result and returns `{ success, data?, error?, diagnostics?, timestamp }`.

## Project layout

```
server.js               HTTP server, API, scheduler
scripts/run-report.js   command-line / Task Scheduler entry point
src/pipeline.js         sources -> classification -> entity resolution -> dedupe -> report
src/sources/            AusTender, ASX announcements and directory, news, open tenders, market data
src/lib/                classifier, entity resolver, dedupe, takeaways, Markdown/CSV, PDF, RSS
src/data/               government agencies, supplier aliases, UNSPSC categories
src/ai/                 AI analyst (Anthropic SDK) and the brief
src/commerce.js, src/admin.js, src/idempotency.js   tokens, superadmin sessions, idempotency store
shared/                 JSON Schemas, schema validator and retry policy (used by server and browser)
public/                 the responsive front end (no build step): app.js, js/ (DOM, API, schema forms), agent-driver.js
data/                   reports, caches and settings (created at runtime)
```

## Limits

- Standard mode reads headlines, feed summaries and the first pages of ASX announcements. It can misjudge a story, for example an unnamed customer or a vendor not named in the headline. Every row links to its source, and items carry a confidence level.
- News-only items, and governments inferred from a state name, are marked **low** confidence.
- Paywalled articles are seen through their headlines only.
- Price moves are for the latest session and may not be caused by the contract news.
- This is a research aid, not financial advice.
