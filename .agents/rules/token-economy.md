---
trigger: always_on
---

# Google Antigravity Customization Rule: Global Token & Multi-Currency Commerce System

## 1. Core Architecture & Number Formatting Directives
All websites and applications in this workspace MUST implement a centralized **Token & Multi-Currency Commerce System** governed by a **Superadmin Panel**.
- **Strict Integer Rule (No Decimals):** Every token amount, token base price, and dollar amount across the entire platform (database, API, Superadmin inputs, and frontend UI) MUST be a whole round number (`Integer`). Never display or accept decimal places or cents (e.g., render `$25 AUD`, NEVER `$25.00 AUD`). Enforce `Math.round()` or integer-only validation on all pricing calculations and inputs.

## 2. Global Settings & Toggles (Superadmin Controlled)
The system must maintain global configuration states managed exclusively within the Superadmin Panel:
- **`isTokenSystemEnabled` (Boolean):** Master toggle for the entire token economy.
- **`isAudEnabled` (Boolean):** Independent toggle to enable/disable Australian Dollar (AUD) pricing.
- **`isUsdEnabled` (Boolean):** Independent toggle to enable/disable US Dollar (USD) pricing.
- **`tokenPriceAud` (Integer):** Whole-dollar price of a token in AUD.
- **`tokenPriceUsd` (Integer):** Whole-dollar price of a token in USD.

- Australian pricing is only used in Australian regions through geolocation. The AUD pricing is shown only to users in the Australian geolocation.

*Constraint:* `isAudEnabled` and `isUsdEnabled` must operate independently of one another. Each can be turned off at any time by superadmin panel.

## 3. Token System Visibility & Hover Tooltip Rules
Strict conditional rendering MUST be enforced across all user-facing views based on `isTokenSystemEnabled`:

- **When `isTokenSystemEnabled === false` (OFF):**
  - NEVER render token icons, token amounts, token balances, or token prices anywhere in the UI.
  - Strip or hide all token-related fields from public views.

- **When `isTokenSystemEnabled === true` (ON):**
  - **Primary Display (Tokens Only):** Website visitors ONLY see the **Token Icon** and the whole-number **Token Amount** on saleable items (plus the global token purchase price where applicable). Never display dollar amounts directly on the page alongside the item.
  - **Hover Tooltip (Dollar Amounts):** When a user hovers their cursor over the token amount/icon, render a tooltip displaying the corresponding whole-dollar amount in whichever currencies are currently enabled:
    - Show `$X AUD` ONLY if `isAudEnabled === true`.
    - Show `$Y USD` ONLY if `isUsdEnabled === true`.
    - If both currencies are disabled, do not render a hover tooltip.

## 4. Saleable Items & Catalog Management
Every saleable item on the website MUST be created and managed in the Superadmin Panel with the following attributes:
- **`id`:** Unique identifier.
- **`title`:** Name of the item.
- **`description`:** Item description entered by the Superadmin.
- **`tokenAmount` (Integer):** Whole-number token cost entered by the Superadmin.
- **`priceAud` (Integer):** Whole-number AUD value (calculated from token price or entered as an integer in Superadmin).
- **`priceUsd` (Integer):** Whole-number USD value (calculated from token price or entered as an integer in Superadmin).
- **`isActive` (Boolean):** Item availability toggle.

*Constraint:* Never hardcode item prices, descriptions, or token costs in frontend code. All saleable items must dynamically pull their description and token amount from the Superadmin data store.

## 5. Superadmin Panel UI Requirements
Whenever generating or updating the Superadmin Panel, always include:
1. **System Toggles:** Independent switches for `Token System (On/Off)`, `AUD Currency (On/Off)`, and `USD Currency (On/Off)`.
2. **Token Pricing Configuration:** Whole-number integer inputs (`step="1"`, no decimals) for the Superadmin to set the **USD Price** and **AUD Price**.
3. **Item Management CRUD:** A form/table allowing the Superadmin to create and edit saleable items, including fields for the **Item Description** and whole-number **Token Amount**.
