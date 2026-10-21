// Token & multi-currency commerce (see .agents/rules/token-economy.md).
// All token amounts and dollar prices are whole numbers: inputs that are not integers are
// rejected, never rounded silently. State lives in data/commerce.json.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

/** The saleable item that unlocks one contract's value/scope and sources. */
export const DETAILS_ITEM_ID = "contract-details";

const MAX_TOKENS = 1_000_000;
const MAX_PRICE = 1_000_000;
const LEDGER_LIMIT = 5_000;

const DEFAULT_STATE = () => ({
  settings: { isTokenSystemEnabled: true, isAudEnabled: true, isUsdEnabled: true, tokenPriceAud: 1, tokenPriceUsd: 1 },
  items: [
    {
      id: DETAILS_ITEM_ID,
      title: "Contract details",
      description: "Unlocks the value/scope and sources of one contract in the brief. Once unlocked it stays visible in later reports.",
      tokenAmount: 1,
      priceAud: null,
      priceUsd: null,
      isActive: true,
      system: true,
    },
  ],
  wallets: {},
  ledger: [],
});

const file = () => path.join(config.dataDir, "commerce.json");
let state = null;
let writing = Promise.resolve();

export class CommerceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** A whole number within [min, max]; anything else (decimals, strings, NaN) is rejected. */
export function wholeNumber(value, label, { min = 0, max = MAX_PRICE } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CommerceError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

async function load() {
  if (state) return state;
  try {
    const saved = JSON.parse(await fs.readFile(file(), "utf8"));
    const defaults = DEFAULT_STATE();
    state = { ...defaults, ...saved, settings: { ...defaults.settings, ...saved.settings } };
    if (!state.items.some((i) => i.id === DETAILS_ITEM_ID)) state.items.unshift(defaults.items[0]);
  } catch {
    state = DEFAULT_STATE();
  }
  return state;
}

/** Applies `fn` to the state and persists it; writes are serialised. */
function mutate(fn) {
  const next = writing.then(async () => {
    const s = await load();
    const result = await fn(s);
    await fs.mkdir(config.dataDir, { recursive: true });
    const tmp = `${file()}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(s, null, 1));
    await fs.rename(tmp, file());
    return result;
  });
  writing = next.catch(() => {});
  return next;
}

// ------------------------------------------------------------------ pricing

export function itemPrices(item, settings) {
  return {
    priceAud: item.priceAud ?? item.tokenAmount * settings.tokenPriceAud,
    priceUsd: item.priceUsd ?? item.tokenAmount * settings.tokenPriceUsd,
  };
}

/**
 * Currencies this viewer may see. USD follows its toggle; AUD also needs an Australian viewer.
 */
export function visibleCurrencies(settings, country) {
  return { aud: settings.isAudEnabled && country === "AU", usd: settings.isUsdEnabled };
}

/**
 * Viewer country for currency display. Behind a CDN, set GEO_COUNTRY_HEADER (e.g. cf-ipcountry)
 * to trust its geolocation header; otherwise fall back to the browser's time zone and language.
 */
export function viewerCountry(req) {
  const header = process.env.GEO_COUNTRY_HEADER?.toLowerCase();
  if (header && req.headers[header]) return String(req.headers[header]).trim().toUpperCase();
  if (/^Australia\//.test(String(req.headers["x-client-timezone"] ?? ""))) return "AU";
  if (/-AU\b/i.test(String(req.headers["accept-language"] ?? ""))) return "AU";
  return null;
}

// ------------------------------------------------------------------ wallets

const newWalletId = () => crypto.randomBytes(16).toString("base64url");

/** The viewer's wallet, created on first sight. Returns { wallet, created }. */
export async function ensureWallet(id) {
  const s = await load();
  if (id && s.wallets[id]) return { wallet: s.wallets[id], created: false };
  const wallet = await mutate((st) => {
    const w = { id: newWalletId(), balance: 0, unlocks: [], createdAt: new Date().toISOString() };
    st.wallets[w.id] = w;
    return w;
  });
  return { wallet, created: true };
}

function record(s, entry) {
  s.ledger.push({ at: new Date().toISOString(), ...entry });
  if (s.ledger.length > LEDGER_LIMIT) s.ledger.splice(0, s.ledger.length - LEDGER_LIMIT);
}

/** Spends the details item's token cost to unlock one report item for this wallet. */
export async function unlockItem(walletId, itemId) {
  if (typeof itemId !== "string" || !/^[\w-]{1,64}$/.test(itemId)) throw new CommerceError("Unknown report item.");
  return mutate((s) => {
    if (!s.settings.isTokenSystemEnabled) throw new CommerceError("Tokens are not in use; details are already visible.", 409);
    const wallet = s.wallets[walletId];
    if (!wallet) throw new CommerceError("No wallet for this browser.", 401);
    if (wallet.unlocks.includes(itemId)) return { wallet, spent: 0 };
    const product = s.items.find((i) => i.id === DETAILS_ITEM_ID);
    if (!product?.isActive) throw new CommerceError("Contract details are not available right now.", 409);
    if (wallet.balance < product.tokenAmount) throw new CommerceError("Not enough tokens.", 402);
    wallet.balance -= product.tokenAmount;
    wallet.unlocks.push(itemId);
    record(s, { walletId, type: "unlock", amount: -product.tokenAmount, itemId });
    return { wallet, spent: product.tokenAmount };
  });
}

// ------------------------------------------------------------------ views for the API

export async function getState() {
  return load();
}

export function isUnlocked(state_, wallet, itemId) {
  return !state_.settings.isTokenSystemEnabled || Boolean(wallet?.unlocks.includes(itemId));
}

/** What a visitor may know about the economy. Nothing token-related when it is off. */
export function publicCommerce(s, wallet, country) {
  if (!s.settings.isTokenSystemEnabled) return { tokenSystemEnabled: false };
  const currencies = visibleCurrencies(s.settings, country);
  const priced = (aud, usd) => ({ ...(currencies.aud ? { aud } : {}), ...(currencies.usd ? { usd } : {}) });
  return {
    tokenSystemEnabled: true,
    tokenPrice: priced(s.settings.tokenPriceAud, s.settings.tokenPriceUsd),
    items: s.items
      .filter((i) => i.isActive)
      .map((i) => {
        const p = itemPrices(i, s.settings);
        return { id: i.id, title: i.title, description: i.description, tokenAmount: i.tokenAmount, price: priced(p.priceAud, p.priceUsd) };
      }),
    wallet: { balance: wallet?.balance ?? 0, unlocked: wallet?.unlocks.length ?? 0 },
  };
}

const LOCKED_FIELDS = ["title", "value", "scope", "sources", "context", "details"];

/** The report with each item's value/scope and sources removed unless the wallet has unlocked it. */
export function redactReport(report, s, wallet) {
  if (!s.settings.isTokenSystemEnabled) return report;
  const lock = (item) => {
    if (wallet?.unlocks.includes(item.id)) return item;
    const copy = { ...item, locked: true, sources: [] };
    for (const key of LOCKED_FIELDS) if (key !== "sources") copy[key] = null;
    return copy;
  };
  const { ai, ...rest } = report;
  return {
    ...rest,
    ...(ai ? { ai: { model: ai.model, usage: ai.usage, costUsd: ai.costUsd } } : {}),
    confirmed: report.confirmed.map(lock),
    upcoming: report.upcoming.map(lock),
    other: (report.other ?? []).map(lock),
  };
}

// ------------------------------------------------------------------ superadmin

export function adminView(s) {
  return {
    settings: s.settings,
    items: s.items.map((i) => ({ ...i, effective: itemPrices(i, s.settings) })),
    wallets: Object.values(s.wallets)
      .map((w) => ({ id: w.id, balance: w.balance, unlocked: w.unlocks.length, createdAt: w.createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ledger: s.ledger.slice(-50).reverse(),
  };
}

export function updateSettings(patch = {}) {
  return mutate((s) => {
    const next = { ...s.settings };
    for (const key of ["isTokenSystemEnabled", "isAudEnabled", "isUsdEnabled"]) {
      if (key in patch) {
        if (typeof patch[key] !== "boolean") throw new CommerceError(`${key} must be true or false.`);
        next[key] = patch[key];
      }
    }
    if ("tokenPriceAud" in patch) next.tokenPriceAud = wholeNumber(patch.tokenPriceAud, "AUD token price");
    if ("tokenPriceUsd" in patch) next.tokenPriceUsd = wholeNumber(patch.tokenPriceUsd, "USD token price");
    s.settings = next;
    return adminView(s);
  });
}

function cleanItem(input, existing = {}) {
  const title = String(input.title ?? existing.title ?? "").trim();
  if (!title || title.length > 120) throw new CommerceError("Title is required (up to 120 characters).");
  const description = String(input.description ?? existing.description ?? "").trim();
  if (description.length > 1_000) throw new CommerceError("Description is limited to 1,000 characters.");
  const optionalPrice = (v, label) => (v === null || v === undefined || v === "" ? null : wholeNumber(v, label));
  return {
    title,
    description,
    tokenAmount: wholeNumber(input.tokenAmount ?? existing.tokenAmount, "Token amount", { min: 0, max: MAX_TOKENS }),
    priceAud: "priceAud" in input ? optionalPrice(input.priceAud, "AUD price") : existing.priceAud ?? null,
    priceUsd: "priceUsd" in input ? optionalPrice(input.priceUsd, "USD price") : existing.priceUsd ?? null,
    isActive: typeof input.isActive === "boolean" ? input.isActive : existing.isActive ?? true,
  };
}

export function createItem(input) {
  return mutate((s) => {
    const base = String(input.id ?? input.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
    let id = base;
    for (let n = 2; s.items.some((i) => i.id === id); n++) id = `${base}-${n}`;
    s.items.push({ id, ...cleanItem(input), system: false });
    return adminView(s);
  });
}

export function updateItem(id, input) {
  return mutate((s) => {
    const item = s.items.find((i) => i.id === id);
    if (!item) throw new CommerceError("Item not found.", 404);
    Object.assign(item, cleanItem(input, item));
    return adminView(s);
  });
}

export function deleteItem(id) {
  return mutate((s) => {
    const item = s.items.find((i) => i.id === id);
    if (!item) throw new CommerceError("Item not found.", 404);
    if (item.system) throw new CommerceError("This item drives the contract-details lock and cannot be deleted; deactivate it instead.", 409);
    s.items = s.items.filter((i) => i.id !== id);
    return adminView(s);
  });
}

/** Adds (or with a negative amount, removes) tokens from a wallet. */
export function adjustWallet(id, amount, note = "") {
  return mutate((s) => {
    const wallet = s.wallets[id];
    if (!wallet) throw new CommerceError("Wallet not found.", 404);
    wholeNumber(amount, "Token adjustment", { min: -MAX_TOKENS, max: MAX_TOKENS });
    if (amount === 0) throw new CommerceError("Enter a non-zero number of tokens.");
    if (wallet.balance + amount < 0) throw new CommerceError("A wallet balance cannot go below zero.");
    wallet.balance += amount;
    record(s, { walletId: id, type: amount > 0 ? "credit" : "debit", amount, note: String(note).slice(0, 200) });
    return adminView(s);
  });
}

/** Test hook: start from defaults (or a given state) without touching disk-loaded state. */
export function _resetForTests(initial = DEFAULT_STATE()) {
  state = initial;
  writing = Promise.resolve();
}
export const _defaultState = DEFAULT_STATE;
