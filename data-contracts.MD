# Data Contracts Manifesto

This document defines the strict, canonical data contracts across all UI, API, Agent, and Storage boundaries in **MY ASX Options (Gov Contract Radar)**.

All schemas strictly enforce `additionalProperties: false`, deterministic integer arithmetic for token and financial operations, input sanitization, and compliance with the **Australian Privacy Act 1988 (Cth)** and **Australian Privacy Principles (APPs)**.

---

## 1. Governance & Security Principles

1. **Closed Schemas (`additionalProperties: false`)**: Every API endpoint and storage payload rejects unrecognised fields immediately with HTTP 400 (`VALIDATION_FAILED`).
2. **Strict Integer Economy & Rounding Up (`Math.ceil`, No Decimals)**:
   - All token amounts, token balances, and AUD business prices are strictly whole numbers.
   - We never use decimals; all calculations are rounded up (`Math.ceil`) to ensure whole numbers.
   - The default price for one token is AUD $1 (`tokenPriceAud: 1`).
   - Currency conversions (e.g. AUD to USD) may display up to a maximum of 2 decimal places (`(Math.round(val * 100) / 100).toFixed(2)`).
   - Invoices and charges are issued strictly in Australian Dollars (AUD).
   - Geolocation automatically sets the visitor's default region: Australia and New Zealand visitors see AUD; visitors outside AU/NZ see indicative USD currency conversion.
3. **Privacy & Australian Privacy Principles (APP Compliance)**:
   - **Data Minimisation (APP 3 & 4)**: Only verified authentication tokens and identifiers required for access control are retained.
   - **Openness & Transparent Management (APP 1)**: Public legal policies (/privacy.html, /terms.html, /ai-policy.html, /token-policy.html) are embedded directly in the application.
   - **Security of Personal Information (APP 11)**: Zero plain-text credentials stored. Session cookies are HTTP-only, SameSite=Lax, Secure with HMAC-SHA256 signatures. Google OAuth tokens are verified via Google Identity APIs.
4. **Resilience & Idempotency**: Modifying requests require deterministic `x-idempotency-key` headers with exponential backoff retries and state caching.

---

## 2. Commerce & Token Economy Contracts

### `COMMERCE_SETTINGS`
Persisted in `app/commerce` storage document. Controls global token gates, currency visibility, and regional pricing.

```json
{
  "title": "Token system settings",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "isTokenSystemEnabled",
    "isAudEnabled",
    "isUsdEnabled",
    "tokenPriceAud",
    "tokenPriceUsd"
  ],
  "properties": {
    "isTokenSystemEnabled": {
      "type": "boolean",
      "title": "Token system",
      "description": "Off: no tokens anywhere and all contract details are visible to everyone."
    },
    "isAudEnabled": {
      "type": "boolean",
      "title": "AUD currency",
      "description": "Shown only to visitors located in Australia and New Zealand."
    },
    "isUsdEnabled": {
      "type": "boolean",
      "title": "USD currency",
      "description": "Shown to all other countries other than Australia and New Zealand."
    },
    "tokenPriceAud": {
      "type": "integer",
      "title": "AUD price",
      "minimum": 0,
      "maximum": 1000000,
      "description": "Whole dollars per token for AU and NZ visitors"
    },
    "tokenPriceUsd": {
      "type": "integer",
      "title": "USD price",
      "minimum": 0,
      "maximum": 1000000,
      "description": "Default whole dollars per token for global visitors"
    },
    "countryTokenRates": {
      "type": "object",
      "title": "Country Token Rates (Purchasing Power Parity)",
      "description": "Flexible purchasing power parity token overrides per USD $1 by 2-letter ISO 3166-1 alpha-2 country code (all 279 global regions/territories supported, e.g. KH: 10, TH: 5). Supports inline real-time editing and open economic data synchronization via World Bank API (PA.NUS.PPP & PA.NUS.FCRF).",
      "additionalProperties": {
        "type": "integer",
        "minimum": 1,
        "maximum": 1000000
      }
    }
  }
}
```

#### PPP Economic Sync & Safety Protocols
- **Calculation Formula**: `tokensPerUsd = Math.max(1, Math.round(officialExchangeRate / pppConversionFactor))`
- **Fault-Tolerant Fallback**: World Bank API requests time out gracefully after 6,000ms. If network or indicator is unavailable, manual input is always accepted without blocking.
- **Confirm Delete Protocol**: Destructive actions on country rates and saleable catalog items require a verified two-step confirmation (`data-confirm-delete-*`), eliminating accidental data loss.


### `ITEM_INPUT` / `ITEM_PATCH`
Saleable item catalog managed via Superadmin.

```json
{
  "title": "Saleable item",
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "tokenAmount"],
  "properties": {
    "title": { "type": "string", "minLength": 1, "maxLength": 120 },
    "description": { "type": "string", "maxLength": 1000 },
    "tokenAmount": { "type": "integer", "minimum": 0, "maximum": 1000000 },
    "priceAud": { "type": ["integer", "null"], "minimum": 0, "maximum": 1000000 },
    "priceUsd": { "type": ["integer", "null"], "minimum": 0, "maximum": 1000000 },
    "isActive": { "type": "boolean", "default": true }
  }
}
```

### `WALLET_ADJUST_REQUEST`
```json
{
  "title": "Wallet adjustment",
  "type": "object",
  "additionalProperties": false,
  "required": ["amount"],
  "properties": {
    "amount": { "type": "integer", "minimum": -1000000, "maximum": 1000000 },
    "note": { "type": "string", "maxLength": 200 }
  }
}
```

### `UNLOCK_REQUEST`
```json
{
  "title": "Unlock request",
  "type": "object",
  "additionalProperties": false,
  "required": ["itemId"],
  "properties": {
    "itemId": {
      "type": "string",
      "pattern": "^[\\w-]{1,64}$"
    }
  }
}
```

---

## 3. Application Settings & Preferences

### `SETTINGS` / `SETTINGS_PATCH`
Persisted in `app/settings`. Configures automated collection runs, thresholds, and data feeds.

```json
{
  "title": "Settings",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "watchlist",
    "schedule",
    "thresholds",
    "sources",
    "includeLocalGovernment",
    "ai"
  ],
  "properties": {
    "watchlist": {
      "type": "array",
      "title": "Watchlist",
      "items": { "type": "string", "pattern": "^[A-Z0-9.-]{1,12}$" },
      "maxItems": 100
    },
    "schedule": {
      "type": "object",
      "additionalProperties": false,
      "required": ["enabled", "time", "runOnStartup", "ai"],
      "properties": {
        "enabled": { "type": "boolean" },
        "time": { "type": "string", "format": "time" },
        "runOnStartup": { "type": "boolean" },
        "ai": { "type": "boolean" }
      }
    },
    "thresholds": {
      "type": "object",
      "additionalProperties": false,
      "required": ["austenderAsxMin", "austenderOverseasMin", "austenderMajorMin"],
      "properties": {
        "austenderAsxMin": { "type": "integer", "minimum": 0, "maximum": 10000000000 },
        "austenderOverseasMin": { "type": "integer", "minimum": 0, "maximum": 10000000000 },
        "austenderMajorMin": { "type": "integer", "minimum": 0, "maximum": 100000000000 }
      }
    },
    "sources": {
      "type": "object",
      "additionalProperties": false,
      "required": ["austender", "asxAnnouncements", "readAnnouncementPdfs", "news", "market", "austenderTenders"],
      "properties": {
        "austender": { "type": "boolean" },
        "asxAnnouncements": { "type": "boolean" },
        "readAnnouncementPdfs": { "type": "boolean" },
        "news": { "type": "boolean" },
        "market": { "type": "boolean" },
        "austenderTenders": { "type": "boolean" }
      }
    },
    "includeLocalGovernment": { "type": "boolean" },
    "ai": {
      "type": "object",
      "additionalProperties": false,
      "required": ["maxSearches", "effort"],
      "properties": {
        "maxSearches": { "type": "integer", "minimum": 1, "maximum": 30 },
        "effort": { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }
      }
    }
  }
}
```

---

## 4. Regional Geolocation & Time Preferences

### `GEO_SETTINGS`
Persisted in browser client storage (`localStorage: geo_settings`). Controls thin footer bar and user display preferences.

```json
{
  "title": "Geolocation and Time Settings",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "suburb",
    "state",
    "timeFormat",
    "dateFormat",
    "timezone",
    "temp",
    "condition",
    "lat",
    "lon"
  ],
  "properties": {
    "suburb": { "type": "string", "maxLength": 64 },
    "state": { "type": "string", "enum": ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] },
    "timeFormat": { "type": "string", "enum": ["12", "24"] },
    "dateFormat": { "type": "string", "enum": ["DD/MM/YYYY", "YYYY-MM-DD"] },
    "timezone": {
      "type": "string",
      "enum": [
        "Australia/Sydney",
        "Australia/Melbourne",
        "Australia/Brisbane",
        "Australia/Adelaide",
        "Australia/Darwin",
        "Australia/Perth",
        "Australia/Hobart"
      ]
    },
    "temp": { "type": "integer", "minimum": -50, "maximum": 60 },
    "condition": { "type": "string", "maxLength": 64 },
    "lat": { "type": "number", "minimum": -90, "maximum": 90 },
    "lon": { "type": "number", "minimum": -180, "maximum": 180 }
  }
}
```

---

## 5. Report & Intelligence Schema

### `REPORT_ITEM`
Each individual contract record in the daily intelligence brief.

```json
{
  "title": "Report item",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id",
    "kind",
    "date",
    "title",
    "companies",
    "agency",
    "jurisdiction",
    "value",
    "scope",
    "sector",
    "status",
    "stage",
    "sources"
  ],
  "properties": {
    "id": { "type": "string", "pattern": "^[\\w-]{1,64}$" },
    "kind": { "type": "string", "enum": ["confirmed", "upcoming", "other"] },
    "date": { "type": "string", "format": "date" },
    "title": { "type": ["string", "null"] },
    "companies": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["display", "listing", "code", "match"],
        "properties": {
          "name": { "type": "string" },
          "display": { "type": "string" },
          "listing": { "type": "string", "enum": ["ASX", "Overseas", "Private", "Government-owned", "Unverified"] },
          "exchange": { "type": ["string", "null"] },
          "code": { "type": ["string", "null"] },
          "match": { "type": "string" },
          "industry": { "type": ["string", "null"] },
          "note": { "type": "string" }
        }
      }
    },
    "agency": { "type": ["string", "null"] },
    "agencyWeak": { "type": "boolean" },
    "jurisdiction": { "type": ["string", "null"], "enum": ["Federal", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT", "Local", "Unknown"] },
    "value": {
      "anyOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["amount", "currency", "text"],
          "properties": {
            "amount": { "type": ["number", "null"] },
            "currency": { "type": ["string", "null"], "enum": ["AUD", "USD", "NZD"] },
            "text": { "type": "string" },
            "note": { "type": "string" }
          }
        },
        { "type": "null" }
      ]
    },
    "scope": { "type": ["string", "null"] },
    "sector": { "type": "string", "enum": ["Defence", "Cyber/IT", "Infrastructure", "Energy", "Health", "Transport", "Services", "Other"] },
    "status": { "type": "string", "enum": ["confirmed", "forward"] },
    "stage": { "type": "string" },
    "window": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "label": { "type": "string" },
        "from": { "type": "string", "format": "date" },
        "to": { "type": "string", "format": "date" }
      }
    },
    "context": { "type": ["string", "null"] },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["type", "title", "url"],
        "properties": {
          "type": { "type": "string", "enum": ["asx", "austender", "news", "atm", "ai"] },
          "title": { "type": "string" },
          "url": { "type": "string", "format": "uri" },
          "publisher": { "type": "string" },
          "date": { "type": ["string", "null"], "format": "date" }
        }
      }
    },
    "confidence": { "type": "string", "enum": ["low", "medium", "high"] },
    "flags": { "type": "array", "items": { "type": "string" } },
    "note": { "type": "string" },
    "details": {
      "anyOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["notices"],
          "properties": {
            "notices": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["cnId", "url", "value", "amendment", "supplier"],
                "properties": {
                  "cnId": { "type": "string" },
                  "url": { "type": "string", "format": "uri" },
                  "value": { "type": ["number", "null"] },
                  "description": { "type": "string" },
                  "category": { "type": "string" },
                  "start": { "type": ["string", "null"] },
                  "end": { "type": ["string", "null"] },
                  "method": { "type": ["string", "null"] },
                  "amendment": { "type": "boolean" },
                  "supplier": { "type": "string" },
                  "abn": { "type": ["string", "null"] }
                }
              }
            }
          }
        },
        { "type": "null" }
      ]
    },
    "locked": { "type": "boolean" }
  }
}
```

---

## 6. Authentication & Session Identity

### `AUTH_USER`
Returned on successful Google OAuth / token verification.

```json
{
  "title": "Authenticated User Session",
  "type": "object",
  "additionalProperties": false,
  "required": ["uid", "email", "name", "role"],
  "properties": {
    "uid": { "type": "string", "pattern": "^[a-zA-Z0-9_-]{1,128}$" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string", "maxLength": 128 },
    "role": { "type": "string", "enum": ["supporter", "member", "superadmin"] },
    "picture": { "type": "string", "format": "uri" },
    "created": { "type": "string", "format": "date-time" }
  }
}
```

---

## 7. Firebase Cloud Firestore Security Rules Contracts

The application utilizes Google Cloud Firestore in project `ai-foundation-firebase` with multi-database architecture defined in `firebase.json`:

### A. Dedicated App Database: `finance` (`firestore.rules`)
- **Isolation Principle**: All operations (state mutations, pricing updates, contract reports, concurrency locks) are executed **exclusively** via the Firebase Admin SDK using the secure service account (`finance-sa@ai-foundation-firebase.iam.gserviceaccount.com`).
- **Client Access Control**: Zero direct client access (`allow read, write: if false;`). Prevents direct client tampering, bypassing token barriers, or scraping unredacted intelligence.
- **Collections Governed**:
  - `myAsxOptions_app`: System settings, commerce rates, purchasing power parity overrides.
  - `myAsxOptions_reports`: Gzipped JSON report archives.
  - `myAsxOptions_runtime`: Concurrency execution lock (`run`).

### B. Shared Tenant Database: `(default)` (`firestore.default.rules`)
- **Shared Identity Directory**: User profiles stored under `/users/{uid}`.
- **Access Rule**:
  - `read`: Only profile owner (`isOwner(userId)`) or SuperAdmin.
  - `create/update`: Self-escalation and token manipulation are strictly blocked by locking privileged fields (`role`, `status`, `classification`, `isSuperAdmin`, `isAdmin`, `token_balance`, `fitTokens`, `unlocked_videos`) from client writes.


