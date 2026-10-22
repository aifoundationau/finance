// Single source of truth for every JSON contract in the app: request bodies, persisted settings
// and commerce state, and the report itself. The server validates against these at its API and
// storage boundaries; the browser builds and validates its forms from the same definitions.
// "title"/"description" label generated form fields; "x-*" keywords are form-builder hints.
import { partial } from "./json-schema.js";

const obj = (title, properties, { required = Object.keys(properties), ...extra } = {}) => ({
  title, type: "object", additionalProperties: false, required, properties, ...extra,
});
const bool = (title, description) => ({ type: "boolean", title, ...(description ? { description } : {}) });
const int = (title, minimum, maximum, extra = {}) => ({ type: "integer", title, minimum, maximum, ...extra });
const str = (title, extra = {}) => ({ type: "string", title, ...extra });
const nullable = (schema) => ({ ...schema, type: [schema.type, "null"], ...(schema.enum ? { enum: [...schema.enum, null] } : {}) });

export const ASX_CODE = { type: "string", pattern: "^[A-Z0-9]{3,6}$", title: "ASX code", "x-pattern-message": "ASX codes are 3 to 6 letters or digits, e.g. TNE." };
export const SECTORS = ["Defence", "Cyber/IT", "Infrastructure", "Energy", "Health", "Transport", "Services", "Other"];
export const JURISDICTIONS = ["Federal", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT", "Local", "Unknown"];
export const LISTINGS = ["ASX", "Overseas", "Private", "Government-owned", "Unverified"];

// ------------------------------------------------------------------ app settings

export const SETTINGS = obj("Settings", {
  watchlist: { type: "array", title: "Watchlist", items: ASX_CODE, maxItems: 100 },
  schedule: obj("Daily schedule", {
    enabled: bool("Run a report every day while the app is running"),
    time: str("Time (Sydney)", { format: "time", "x-widget": "time" }),
    runOnStartup: bool("Run at start-up when today's report is missing"),
    ai: bool("Use the AI analyst for scheduled runs"),
  }),
  thresholds: obj("AusTender minimum contract value (AUD)", {
    austenderAsxMin: int("ASX-listed supplier", 0, 10_000_000_000, { "x-step": 10_000 }),
    austenderOverseasMin: int("Overseas-listed supplier", 0, 10_000_000_000, { "x-step": 100_000 }),
    austenderMajorMin: int("Any supplier", 0, 100_000_000_000, { "x-step": 1_000_000 }),
  }),
  sources: obj("Sources", {
    austender: bool("AusTender contract notices", "Official Commonwealth API"),
    asxAnnouncements: bool("ASX announcements", "Market-wide feed used by asx.com.au"),
    readAnnouncementPdfs: bool("Read announcement PDFs", "Finds the government counterparty in the document"),
    news: bool("News", "Google News search plus publisher RSS feeds"),
    market: bool("ASX prices & options availability"),
    austenderTenders: bool(
      "AusTender open tenders (opt-in)",
      "tenders.gov.au blocks non-browser clients, so this source sends a browser-style User-Agent. Enable it only if you are comfortable with that and AusTender's terms of use.",
    ),
  }),
  includeLocalGovernment: bool("Include local councils", "Outside the brief's federal/state scope"),
  ai: obj("AI analyst", {
    maxSearches: int("Max web searches", 1, 30),
    effort: str("Effort", { enum: ["low", "medium", "high", "xhigh", "max"] }),
  }),
});
export const SETTINGS_PATCH = partial(SETTINGS);

// ------------------------------------------------------------------ requests

export const EMPTY_REQUEST = obj("Empty body", {});
export const RUN_REQUEST = obj("Run request", { mode: str("Mode", { enum: ["standard", "ai"] }) });
export const UNLOCK_REQUEST = obj("Unlock request", { itemId: str("Report item", { pattern: "^[\\w-]{1,64}$" }) });
export const LOGIN_REQUEST = obj("Sign-in", { password: str("Password", { minLength: 1, maxLength: 200, "x-widget": "password" }) });

export const COMMERCE_SETTINGS = obj("Token system settings", {
  isTokenSystemEnabled: bool("Token system", "Off: no tokens anywhere and all contract details are visible to everyone."),
  isAudEnabled: bool("AUD currency", "Shown only to visitors located in Australia."),
  isUsdEnabled: bool("USD currency"),
  tokenPriceAud: int("AUD price", 0, 1_000_000, { description: "Whole dollars per token" }),
  tokenPriceUsd: int("USD price", 0, 1_000_000, { description: "Whole dollars per token" }),
});
export const COMMERCE_SETTINGS_PATCH = partial(COMMERCE_SETTINGS);

export const ITEM_INPUT = obj(
  "Saleable item",
  {
    title: str("Title", { minLength: 1, maxLength: 120 }),
    description: str("Description", { maxLength: 1_000, "x-widget": "textarea" }),
    tokenAmount: int("Token amount", 0, 1_000_000),
    priceAud: nullable(int("AUD price", 0, 1_000_000, { "x-placeholder": "auto" })),
    priceUsd: nullable(int("USD price", 0, 1_000_000, { "x-placeholder": "auto" })),
    isActive: bool("Active (available to buy)"),
  },
  { required: ["title", "tokenAmount"] },
);
export const ITEM_PATCH = partial(ITEM_INPUT);

export const WALLET_ADJUST_REQUEST = obj(
  "Wallet adjustment",
  { amount: int("Tokens to add (negative removes)", -1_000_000, 1_000_000), note: str("Note", { maxLength: 200 }) },
  { required: ["amount"] },
);
export const SELF_CREDIT_FORM = obj("Add tokens to your wallet", { amount: int("Tokens", 1, 1_000_000) });

// ------------------------------------------------------------------ report

const DATE = str("Date", { format: "date" });
const TIMESTAMP = str("Timestamp", { format: "date-time" });

const COMPANY = obj(
  "Company",
  {
    name: str("Name as written"),
    display: str("Display name"),
    listing: str("Listing", { enum: LISTINGS }),
    exchange: nullable(str("Exchange")),
    code: nullable(str("Ticker")),
    match: str("How it was matched"),
    industry: nullable(str("Industry")),
    note: str("Note"),
  },
  { required: ["display", "listing", "code", "match"] },
);
const SOURCE = obj(
  "Source",
  {
    type: str("Source type", { enum: ["asx", "austender", "news", "atm", "ai"] }),
    title: str("Headline"),
    url: str("Link", { format: "uri" }),
    publisher: str("Publisher"),
    date: nullable(DATE),
  },
  { required: ["type", "title", "url"] },
);
const VALUE = obj(
  "Value",
  { amount: nullable({ type: "number", title: "Amount" }), currency: nullable(str("Currency", { enum: ["AUD", "USD", "NZD"] })), text: str("Value"), note: str("Note") },
  { required: ["amount", "currency", "text"] },
);
const NOTICE = obj(
  "AusTender notice",
  {
    cnId: str("Notice ID"),
    url: str("Link", { format: "uri" }),
    value: nullable({ type: "number" }),
    description: str("Description"),
    category: str("Category"),
    start: nullable(str("Start")),
    end: nullable(str("End")),
    method: nullable(str("Procurement method")),
    amendment: bool("Amendment"),
    supplier: str("Supplier"),
    abn: nullable(str("ABN")),
  },
  { required: ["cnId", "url", "value", "amendment", "supplier"] },
);
export const REPORT_ITEM = obj(
  "Report item",
  {
    id: str("ID", { pattern: "^[\\w-]{1,64}$" }),
    // "other" (non-government contract news) only appears in reports saved before it was dropped.
    kind: str("Kind", { enum: ["confirmed", "upcoming", "other"] }),
    date: DATE,
    title: nullable(str("Headline")),
    companies: { type: "array", items: COMPANY },
    agency: nullable(str("Agency")),
    agencyWeak: bool("Agency inferred or generic"),
    jurisdiction: nullable(str("Jurisdiction", { enum: JURISDICTIONS })),
    value: { anyOf: [VALUE, { type: "null" }] },
    scope: nullable(str("Scope")),
    sector: str("Sector", { enum: SECTORS }),
    status: str("Status", { enum: ["confirmed", "forward"] }),
    stage: str("Stage"),
    window: obj("Window", { label: str("Window"), from: DATE, to: DATE }),
    context: nullable(str("Context")),
    sources: { type: "array", items: SOURCE },
    confidence: str("Confidence", { enum: ["low", "medium", "high"] }),
    flags: { type: "array", items: str("Flag") },
    note: str("Note"),
    details: { anyOf: [obj("Details", { notices: { type: "array", items: NOTICE } }), { type: "null" }] },
    locked: bool("Details locked"),
  },
  { required: ["id", "kind", "date", "title", "companies", "agency", "jurisdiction", "value", "scope", "sector", "status", "stage", "sources"] },
);

const MARKET = obj(
  "Market data",
  {
    code: ASX_CODE,
    asOf: TIMESTAMP,
    name: nullable(str("Name")),
    price: nullable({ type: "number" }),
    change: nullable({ type: "number" }),
    changePct: nullable({ type: "number" }),
    volume: nullable({ type: "number" }),
    marketCap: nullable({ type: "number" }),
    sector: nullable(str("Sector")),
    quoteError: str("Quote error"),
    options: {
      anyOf: [
        obj("Options", {
          available: bool("Options listed"),
          monthly: int("Monthly expiries", 0, 1000),
          weekly: int("Weekly expiries", 0, 1000),
          quarterly: int("Quarterly expiries", 0, 1000),
          nextExpiry: nullable(DATE),
          checkedAt: TIMESTAMP,
        }),
        { type: "null" },
      ],
    },
  },
  { required: ["code", "asOf"] },
);
export const PRICE_HISTORY = obj(
  "Price history",
  {
    code: ASX_CODE,
    name: nullable(str("Name")),
    country: nullable(str("Viewer country", { pattern: "^[A-Z]{2}$" })),
    currency: str("Currency", { pattern: "^[A-Z]{3}$" }),
    fx: { anyOf: [obj("Exchange rate", { rate: { type: "number", minimum: 0 }, date: DATE, source: str("Source") }), { type: "null" }] },
    fxError: str("Exchange rate error"),
    asOf: TIMESTAMP,
    source: str("Source"),
    points: { type: "array", items: obj("Daily close", { date: DATE, close: { type: "number" } }) },
  },
  { required: ["code", "name", "country", "currency", "fx", "asOf", "source", "points"] },
);

const SOURCE_HEALTH = obj(
  "Source health",
  {
    id: str("ID"),
    label: str("Label"),
    status: str("Status", { enum: ["ok", "partial", "stale", "error", "off"] }),
    count: int("Items", 0, 1_000_000),
    ms: int("Duration (ms)", 0, 86_400_000),
    detail: str("Detail"),
    warnings: { type: "array", items: str("Warning") },
    error: str("Error"),
  },
  { required: ["id", "label", "status", "count"] },
);
const SECTOR_STATS = { type: "object", additionalProperties: obj("Sector stats", { count: int("Count", 0, 100_000), value: { type: "number", minimum: 0 } }) };

export const REPORT = obj(
  "Report",
  {
    version: int("Version", 1, 1),
    app: str("App"),
    id: str("Report ID", { pattern: "^\\d{4}-\\d{2}-\\d{2}-(?:standard|ai)$" }),
    date: DATE,
    mode: str("Mode", { enum: ["standard", "ai"] }),
    generatedAt: TIMESTAMP,
    durationMs: int("Duration (ms)", 0, 86_400_000),
    window: obj("Window", { pastFrom: DATE, pastTo: DATE, forwardTo: DATE }),
    confirmed: { type: "array", items: REPORT_ITEM },
    upcoming: { type: "array", items: REPORT_ITEM },
    other: { type: "array", items: REPORT_ITEM },
    takeaways: { type: "array", items: str("Takeaway"), maxItems: 3 },
    market: { type: "object", additionalProperties: MARKET },
    sources: { type: "array", items: SOURCE_HEALTH },
    stats: obj("Stats", {
      confirmed: int("Confirmed", 0, 100_000),
      upcoming: int("Upcoming", 0, 100_000),
      other: int("Other", 0, 100_000),
      asxLinked: int("ASX-linked", 0, 100_000),
      asxTickers: { type: "array", items: ASX_CODE },
      disclosedValueAud: { type: "number", minimum: 0 },
      bySector: SECTOR_STATS,
      byJurisdiction: { type: "object", additionalProperties: int("Count", 0, 100_000) },
      bySource: { type: "object", additionalProperties: int("Count", 0, 100_000) },
    }, { required: ["confirmed", "upcoming", "asxLinked", "asxTickers", "disclosedValueAud", "bySector", "byJurisdiction", "bySource"] }),
    ai: obj(
      "AI analyst run",
      {
        model: str("Model"),
        usage: obj("Usage", { input: int("Input tokens", 0, 1e9), output: int("Output tokens", 0, 1e9), cacheRead: int("Cache reads", 0, 1e9), cacheWrite: int("Cache writes", 0, 1e9), searches: int("Searches", 0, 1e6) }),
        costUsd: { type: "number", minimum: 0 },
        markdown: str("Analyst write-up"),
        citations: { type: "array", items: obj("Citation", { url: str("URL"), title: nullable(str("Title")) }) },
      },
      { required: ["model", "usage", "costUsd"] },
    ),
  },
  { required: ["version", "id", "date", "mode", "generatedAt", "window", "confirmed", "upcoming", "takeaways", "market", "sources", "stats"] },
);
