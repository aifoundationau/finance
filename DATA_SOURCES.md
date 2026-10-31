# Data sources

Phase 1 findings for the token-gated procurement, grants and ASX intelligence platform. Every
endpoint below was tested live on **30 October 2026** from the development computer (`curl`, Node
`fetch` and headless Edge). Samples are trimmed copies of real responses. "Used today" means the
current app (`src/sources/`) already depends on it.

Sources that block automated access are recorded as blocked. They are not worked around: the
build uses an official access route (registration, API key, data agreement) or leaves them out.

## At a glance

| # | Source | Coverage | Status | Auth | Use it for |
|---|---|---|---|---|---|
| 1 | AusTender OCDS API | Federal contract notices | ✅ Verified, used today | None | Federal awards (core feed) |
| 2 | AusTender bulk history (data.gov.au) | Federal, 2013 onwards | ✅ Listed | None | Backfill, fallback |
| 3 | AusTender open tenders (ATM pages) | Federal open tenders | ⛔ Blocks scripts | None | Not usable without official access |
| 4 | GrantConnect (grants.gov.au) | Federal grant awards | ⛔ Blocks scripts and headless browsers | None | Needs a data agreement with Finance |
| 5 | data.gov.au CKAN | Catalogue, some grants | ✅ Verified | None | Discovery; no current federal grant-awards feed |
| 6 | NSW eTendering | NSW contracts ≥ $150k | ⛔ Public site blocks scripts; 🔑 API.NSW product | OAuth key/secret | NSW awards, once registered |
| 7 | Queensland contract disclosure (CKAN) | QLD agency contracts | ✅ Verified | None | QLD awards, monthly lag |
| 8 | Tenders WA award files (CKAN) | WA contracts | ⚠️ Annual files, newest FY 2023-24 | None | Backfill only |
| 9 | ACT contracts registers (Socrata) | ACT contracts | ⚠️ Stale (last update 2017) | None | Not useful |
| 10 | Victoria, SA | — | ❌ No machine-readable award feed found | — | Not available |
| 11 | ABR ABN Lookup (JSON) | All ABNs | 🔑 Needs GUID | GUID | ABN → legal name, status, ACN |
| 12 | ASX company directory (Markit) | ASX listings | ✅ Verified, used today | Public site token | Ticker list, market cap |
| 13 | ASX quotes, options, announcements (Markit) | ASX | ✅ Verified, used today | Public site token | Prices, options, filings |
| 14 | ABS Data API (SDMX) | Macro | ✅ Verified | None | CPI, capex, construction |
| 15 | RBA statistical tables | Macro | ✅ Verified | None | Cash rate, inflation, credit |
| 16 | EODHD | Global equities incl. `.AU` | 🔑 Paid key for ASX | API key | Fundamentals, analyst ratings |
| 17 | Financial Modeling Prep | Global equities | 🔑 Key; commercial licence needed | API key | Price targets, estimates |
| 18 | Alpha Vantage | Mostly US | 🔑 Key; commercial terms by agreement | API key | Peers (limited ASX use) |
| 19 | Australian Tenders | Aggregator | 🔑 Paid plan (Core/Premium) | Key + secret | Optional state/local coverage |
| 20 | PollenOne | — | ❌ No product or API found | — | Not available |
| 21 | Google News RSS + publisher feeds | News | ✅ Used today | None | Early signals |

## Before anything is sold: licensing

- **ASX prices.** Public display of ASX market data, delayed or not, generally needs a
  redistribution licence from ASX. Data vendors' own plans don't include it: Twelve Data, for
  example, limits ASX data to internal use whatever the subscription
  ([Twelve Data](https://support.twelvedata.com/en/articles/13001919-australian-equities-market-data)).
  The app shows ASX prices from the Markit endpoints that asx.com.au uses, and from Yahoo charts.
  Neither is licensed for redistribution in a paid product.
- **Vendor terms.** FMP's personal plans exclude commercial use, and display needs a separate
  Data Display and Licensing Agreement
  ([FMP](https://site.financialmodelingprep.com/insights/platform/can-you-use-fmp-data-in-a-public-app-website-or-client-dashboard)).
  Alpha Vantage's free licence is personal and non-commercial unless agreed in writing
  ([Alpha Vantage terms](https://alphavantage.co/terms_of_service)). EODHD asks commercial users
  to contact them ([EODHD B2B](https://eodhd.com/lp/b2b-solution)).
- **Government data.** AusTender data is CC BY 3.0 AU, the Queensland datasets are CC BY 4.0 and
  WA's are CC BY 3.0 AU. Reselling it is allowed, with attribution shown on the page.

This is a summary for planning, not legal advice. Confirm with ASX and each vendor before charging.

---

## 1. AusTender OCDS API (federal contracts)

- **Coverage:** every Commonwealth contract notice (CN) and amendment from 1 Jan 2013. Publisher:
  Department of Finance.
- **Docs:** <https://github.com/austender/austender-ocds-api>; Swagger:
  `https://api.swaggerhub.com/apis/austender/ocds-api/1.1` (two paths).
- **Endpoints (verified):**
  - `GET https://api.tenders.gov.au/ocds/findById/{CN}`, for example `/ocds/findById/CN4285490`
  - `GET https://api.tenders.gov.au/ocds/findByDates/{dateType}/{start}/{end}`, where `dateType`
    is `contractPublished` | `contractStart` | `contractEnd` | `contractLastModified` and the dates
    are ISO 8601 UTC (`2026-10-27T00:00:00Z`)
- **Paging:** 100 releases per page. `links.next` carries a `cursor`; the last page has no `links`.
  A 6-hour window returned 99 releases on one page; 2 days needed several pages.
- **Auth / limits:** none. No rate-limit headers are returned (AWS API Gateway). Keep requests
  sequential.
- **Licence:** `https://creativecommons.org/licenses/by/3.0/au/` (in every response's `license` field).
- **Field paths (corrections to the spec).** The real paths differ from the ones in the brief:

  | Spec asked for | Actual path |
  |---|---|
  | `awards[].suppliers[].name` | ✅ `awards[].suppliers[].name` (also `parties[]` with `roles: ["supplier"]`) |
  | `awards[].suppliers[].identifier.id` (ABN) | ❌ `parties[?roles∋supplier].additionalIdentifiers[?scheme=="AU-ABN"].id` |
  | `awards[].value.amount` | ❌ `contracts[0].value.amount`, a **string** (`"191708.00"`) |
  | `buyer.name` | ❌ no `buyer`; use `parties[?roles∋procuringEntity].name` |
  | `ocid` | ✅ `ocid` (the procurement); the CN number is `contracts[0].id` |

  Amendments have `tag: ["contractAmendment"]`. Their value is the amendment amount, and their id
  is in `contracts[0].amendments[-1].id` (for example `CN4283814-A1`). `contracts[0].title` is an
  agency reference, not a title; the description is in `contracts[0].description`.
- **Sample (`findByDates`, trimmed):**

  ```json
  {
    "publisher": { "name": "Department of Finance" },
    "license": "https://creativecommons.org/licenses/by/3.0/au/",
    "version": "1.1",
    "releases": [{
      "ocid": "prod-c8c1750bb7de4634b3ec950f251127b6",
      "date": "2026-10-29T04:19:36Z",
      "tag": ["contract"],
      "parties": [
        { "id": "db81d55a…", "name": "DAVIDSON RECRUITMENT PTY LTD", "roles": ["supplier"],
          "additionalIdentifiers": [{ "id": "50167132523", "scheme": "AU-ABN" }],
          "address": { "locality": "Brisbane", "region": "QLD", "countryName": "Australia" } },
        { "id": "fae76f4d…", "name": "Department of Industry, Science and Resources", "roles": ["procuringEntity"],
          "additionalIdentifiers": [{ "id": "74599608295", "scheme": "AU-ABN" }] }
      ],
      "awards": [{ "id": "CN4285490-f0aed3cb…", "suppliers": [{ "id": "db81d55a…", "name": "DAVIDSON RECRUITMENT PTY LTD" }], "status": "active" }],
      "contracts": [{
        "id": "CN4285490", "awardID": "CN4285490-f0aed3cb…", "dateSigned": "2026-10-29T04:19:36Z",
        "description": "ATRC Recruitment Services", "title": "CON011255",
        "items": [{ "classification": { "scheme": "UNSPSC", "id": "80111700" } }],
        "period": { "startDate": "2026-10-25T13:00:00Z", "endDate": "2027-10-21T13:00:00Z" },
        "value": { "currency": "AUD", "amount": "191708.00" }
      }],
      "tender": { "procurementMethod": "open", "procurementMethodDetails": "Open tender" }
    }],
    "links": { "next": "https://api.tenders.gov.au/ocds/findByDates/contractPublished/…?cursor=…" }
  }
  ```
- **Public notice link:** `https://www.tenders.gov.au/Cn/Show/{GUID}`, where the GUID is the
  32-hex suffix of the award id formatted 8-4-4-4-12 (see `src/sources/austender.js`).
- **Fallback:** if the API is down, retry with backoff and use the previous run's cached
  releases; for history, use source 2.

## 2. AusTender bulk history (data.gov.au)

- **Dataset:** "Historical Australian Government Contract Notice Data",
  `https://data.gov.au/data/dataset/5c7fa69b-b0e9-4553-b8df-2a022dd2e982` (catalogue entry
  returned 200). It includes an OCDS "Contract Notice (API)" resource.
- **Use:** one-off backfill and analytics (for example, a supplier's history of past awards).
  It's not a live feed.

## 3. AusTender open tenders (ATM pages)

- `https://www.tenders.gov.au/atm` serves HTML only and refuses non-browser clients. The current
  app's opt-in "AusTender open tenders" source gets past this by sending a browser User-Agent.
  That works around the site's block, so it should stay **off**. For upcoming tenders, ask
  Finance's AusTender team for API or data access.

## 4. GrantConnect (grants.gov.au), federal grant awards

- `https://www.grants.gov.au/`, `/Ga/List`, `/Ga/Search` and `help.grants.gov.au` all return
  **CloudFront 403 "Request blocked"** to `curl` and to headless Edge.
- data.gov.au has **no GrantConnect dataset** (`package_search?q=grantconnect` returns 0). The
  catalogue's "Grants Awarded Data" (DISR, CC BY 3.0 AU, updated 2024-10-28) only links back to the
  blocked help site.
- **Route:** request bulk or API access from the Department of Finance (which runs GrantConnect).
  Until then, the platform can't offer federal grant awards. Grants announced by ASX companies
  still reach the feed through source 13.

## 5. data.gov.au CKAN Action API

- `GET https://data.gov.au/data/api/3/action/package_search?q={terms}&rows={n}` ✅;
  `package_show?id={name}` ✅; `datastore_search?resource_id={id}` for resources marked
  `datastore_active`.
- `q=grants` returned 3,322 datasets and `q=grant awards` 1,803. They are mostly council and arts
  grant lists and program summaries, with no current, national grant-awards feed. Useful
  state-agency datasets are listed under 7–9.
- Auth none; licence per dataset (`license_title`).

## 6. NSW eTendering

- The public OCDS endpoints on `tenders.nsw.gov.au` returned **CloudFront 403** to scripts. They
  were not retried with a browser identity.
- **Official route:** the "E-tendering API" on API.NSW (`https://api.nsw.gov.au/Product/Index/12`)
  has contract and planned-procurement search, with consumer key and secret credentials (OAuth 2.0
  token). It allows 5 calls a minute anonymously, and more after you register and subscribe.
  NSW Treasury publishes the data under CC BY 3.0 AU
  ([OCDS registry](https://data.open-contracting.org/en/publication/11)).
  Agencies must publish contracts of $150,000 (GST incl.) or more.
- **Env:** `NSW_ETENDERING_API_KEY`, `NSW_ETENDERING_API_SECRET` once registered.

## 7. Queensland contract disclosure (CKAN)

- Catalogue: `https://www.data.qld.gov.au/api/3/action/…` (`data.qld.gov.au` redirects with a 301
  to `www.`). `package_search?q=contract disclosure` returned **380 datasets**, one or more per
  agency, updated monthly to yearly (newest seen 2026-10-18).
- `datastore_search` works, for example `resource_id=d4e305bb-42f0-4bdb-b784-b371f31e39bb`
  (DESBT FY2019-20, 195 rows).
- Columns differ between agencies, and the **ABN is often blank**. One sample:
  ```json
  {"Agency (Dept or Stat Body)":"DESBT ","Award contract date":"2019-07-01T00:00:00",
   "Contract description/name":"Click Dimensions 12 month subscription","Contract value":"15,666.73",
   "Supplier name":"NTT Australia Digitial Pty Ltd","Supplier ABN":""}
  ```
- **Use:** a per-agency column mapping, polled weekly; a 1–2 month lag. Licence CC BY 4.0.

## 8. Tenders WA award files

- `catalogue.data.wa.gov.au` (CKAN) has "Tenders WA contract award details" as **one CSV per
  financial year**. The newest is **2023-24**, for example
  `https://catalogue.data.wa.gov.au/dataset/90b272e8-…/download/tenders-wa-contract-award-details-2023-24-financial-year.csv`.
  Licence CC BY 3.0 AU. `data.wa.gov.au/api/3/…` returned HTTP 500; use the catalogue host.
- **Use:** history only. It's too old for a 7-day feed.

## 9. ACT contracts registers (Socrata)

- `https://www.data.act.gov.au/resource/pfs5-8d64.json` and `/resource/8wge-3sy9.json` work (SoQL,
  no key) but were last updated in **2017** (`/api/views/{id}.json` → `rowsUpdatedAt`). Not useful.

## 10. Victoria, South Australia

- Victoria's catalogue had no Buying for Victoria award dataset (`q=contracts awarded` returned 1
  unrelated hit). `data.sa.gov.au/api/3/…` and `data.nsw.gov.au/api/3/…` return 404 (those
  portals are no longer CKAN). No machine-readable award feed was found for VIC or SA.

## 11. ABR ABN Lookup (JSON)

- **Endpoints (verified to respond):**
  - `GET https://abr.business.gov.au/json/AbnDetails.aspx?abn={ABN}&guid={GUID}`
  - `GET https://abr.business.gov.au/json/AcnDetails.aspx?acn={ACN}&guid={GUID}`
  - `GET https://abr.business.gov.au/json/MatchingNames.aspx?name={NAME}&maxResults={n}&guid={GUID}`
- **Format:** JSONP (`text/javascript`), wrapped as `callback(...)` or `{callback}(...)`. Strip the
  wrapper before `JSON.parse`.
- **Auth:** a free GUID, emailed after registering and accepting the web services agreement at
  <https://abr.business.gov.au/Tools/WebServices>. **Env:** `ABR_API_GUID`.
- **Sample (unregistered GUID; the response shape is the same when registered):**
  ```json
  callback({"Abn":"","AbnStatus":"","AbnStatusEffectiveFrom":"","Acn":"","AddressDate":null,
    "AddressPostcode":"","AddressState":"","BusinessName":[],"EntityName":"","EntityTypeCode":"",
    "EntityTypeName":"","Gst":null,"Message":"The GUID entered is not recognised as a Registered Party"})
  ```
- **Linking ABN to ASX ticker:** no ASX source carries ABNs (checked `/companies/{code}/about`,
  `/header` and `/key-statistics`). Resolve the ABN through ABR to its `EntityName`, then match that
  name against the ASX list (`src/lib/entities.js` already does name matching).
- **Fallback:** the supplier name from AusTender, matched by name only, with lower confidence.

## 12–13. ASX via Markit (directory, quotes, options, announcements)

- These are the endpoints asx.com.au uses, at `https://asx.api.markitdigital.com/asx-research/1.0/`.
  The directory CSV and announcement PDFs need the public `access_token` that asx.com.au embeds in
  its pages. It's in `src/sources/` today; move it to `.env` as `ASX_WEB_TOKEN`. There's no SLA or
  licence for commercial redistribution (see Licensing).
- **Endpoints (verified):**
  - Directory CSV: `companies/directory/file?access_token=…` (1,836 companies today). The fallback
    `https://www.asx.com.au/asx/research/ASXListedCompanies.csv` also works.
  - Quote: `companies/{CODE}/header`
    ```json
    {"data":{"displayName":"TELSTRA GROUP LIMITED","priceLast":4.95,"priceChange":0.04,
     "priceChangePercent":0.81,"volume":30338335,"marketCap":54463980922,
     "sector":"Communication Services","industryGroup":"Telecommunication Services","symbol":"TLS"}}
    ```
  - Options expiries: `companies/{CODE}/options` → `{"monthly":["2026-11-19","2026-12-17",…],"weekly":[],"quarterly":[]}`
  - Announcements: `markets/announcements?itemsPerPage=500&page={n}`
    ```json
    {"symbol":"MKR","date":"2026-10-30T06:05:51.000Z","documentKey":"2924-03156456-2A1707523",
     "headline":"September 2026 Quarter Activities and Cashflow Reports","isPriceSensitive":true,
     "announcementTypes":["First Quarter Activities Report"],"companyInfo":[{"displayName":"MANUKA RESOURCES LTD.","isin":"AU0000090292"}]}
    ```
  - PDF: `https://cdn-api.markitdigital.com/apiman-gateway/ASX/asx-research/1.0/file/{documentKey}?access_token=…`
- **Fallback:** the cached directory (20 h); Yahoo daily closes for charts (also unlicensed for
  redistribution).

## 14. ABS Data API (SDMX)

- `GET https://data.api.abs.gov.au/rest/dataflow/ABS` lists **1,228 dataflows**. Relevant ones:
  `CAPEX` (private new capital expenditure and expected expenditure), `CAPEX_EST`, `EWD`
  (engineering construction work done), `QBIS` (business indicators), `CPI`.
- `GET https://data.api.abs.gov.au/rest/data/ABS,CPI/1.10001.10.50.Q?startPeriod=2025-Q1` with
  `Accept: application/vnd.sdmx.data+csv`:
  ```csv
  DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,…
  ABS:CPI(2.0.0),1,10001,10,50,Q,2026-Q3,103.64,IN,…
  ABS:CPI(2.0.0),1,10001,10,50,Q,2026-Q2,102.31,IN,…
  ```
- No key and no rate-limit headers. Licence CC BY 4.0 (ABS). Cache for 24 h; the data changes
  quarterly or monthly.

## 15. RBA statistical tables

- CSV downloads (`application/octet-stream`, UTF-8 with BOM, metadata rows before the data):
  `https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv` (cash rate),
  `…/g1-data.csv` (CPI inflation) and `…/d2-data.csv` (lending and credit). All returned 200.
- RBA **forecasts** are not in these tables. They're published in the Statement on Monetary
  Policy, as HTML and PDF.
- Cache for 24 h.

## 16. EODHD

- Base `https://eodhd.com/api/`. With the public `demo` key, `eod/AAPL.US` returned 200 and
  `fundamentals/AAPL.US?filter=AnalystRatings` returned
  `{"Rating":3.75,"TargetPrice":332.39,"StrongBuy":18,"Buy":6,"Hold":14,"Sell":3,"StrongSell":3}`.
  `eod/BHP.AU` with `demo` returned **403**, so ASX tickers need a paid key.
- **Env:** `EODHD_API_KEY`. Contact them for commercial and redistribution terms.

## 17. Financial Modeling Prep

- `https://financialmodelingprep.com/stable/price-target-consensus?symbol=…&apikey=…` returns
  401 "Invalid API KEY" without a real key, so it needs `FMP_API_KEY`.
- Personal plans are non-commercial. A paid product needs a Data Display and Licensing Agreement.

## 18. Alpha Vantage

- `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=demo` returns 200
  (IBM only). `BHP.AX` with `demo` returns "demo purposes only", so it needs `ALPHAVANTAGE_API_KEY`.
- Coverage of ASX analyst data is thin. It's best kept for international peer comparison, if used
  at all.

## 19–20. Commercial aggregators

- **Australian Tenders:** an API over your own watchlist and alert results, on the Core or
  Premium plan. You create the key and secret in your account under INTEGRATIONS
  ([help](https://info.australiantenders.com.au/help/integrations)). Coverage and fields are in
  their API docs (account needed).
- **PollenOne:** no tender product or API found under that name.

## 21. News (used today)

- Google News RSS search (`https://news.google.com/rss/search?q=…&hl=en-AU&gl=AU&ceid=AU:en`) and
  publisher RSS feeds (`src/sources/news.js`). The InnovationAus feed returns 403 to Vercel's
  servers; the Google `site:innovationaus.com` query covers it.

---

## Environment variables these sources need

```
ABR_API_GUID=                 # free, register at abr.business.gov.au/Tools/WebServices
NSW_ETENDERING_API_KEY=       # API.NSW E-tendering product
NSW_ETENDERING_API_SECRET=
EODHD_API_KEY=                # paid plan for .AU tickers
FMP_API_KEY=                  # plus a display licence for commercial use
ALPHAVANTAGE_API_KEY=         # optional
ASX_WEB_TOKEN=                # the public token asx.com.au uses, moved out of source
AUSTRALIAN_TENDERS_API_KEY=   # optional aggregator
AUSTRALIAN_TENDERS_API_SECRET=
```

## What this means for the build

1. **Live and free today:** federal contracts (AusTender), ASX announcements and prices, ABS and
   RBA macro data. Add ABR as soon as the GUID arrives.
2. **Needs registration or agreements before it can be built:** NSW (API.NSW), GrantConnect
   (Finance), analyst consensus (EODHD or FMP with a commercial licence), and ASX price display
   (ASX licence).
3. **Slow or partial:** Queensland disclosure is monthly and WA is annual. Neither suits a daily
   7-day feed.
4. **Not available:** VIC, SA and ACT current awards, and PollenOne.
