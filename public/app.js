// MY ASX Options: client for the local report server.
// DOM-native and automation-friendly: every interactive element carries data-agent-id and
// data-testid, forms are generated from the shared JSON Schemas and validated before dispatch,
// and readiness is exposed through body[data-ready] and #agent-status (see agent-driver.js).
import { $, $$, agent, h, icon } from "./js/dom.js";
import { ApiError, api, setAgentStatus, track } from "./js/net.js";
import { bindLiveValidation, formErrorNode, readForm, schemaFields, showErrors, validateForm } from "./js/forms.js";
import { validate } from "/shared/json-schema.js";
import {
  ASX_CODE, COMMERCE_SETTINGS_PATCH, ITEM_INPUT, ITEM_PATCH, JURISDICTIONS, LOGIN_REQUEST, SECTORS, SELF_CREDIT_FORM, SETTINGS,
  SETTINGS_PATCH, WALLET_ADJUST_REQUEST,
} from "/shared/schemas.js";

// Tells boot-check.js the module graph loaded (an import that fails stops this file running).
window.__maoStarted = true;

const VIEWS = ["overview", "confirmed", "upcoming", "other", "settings", "admin"];
const DETAILS_ITEM_ID = "contract-details"; // the saleable item that unlocks value/scope and sources
const BRIEF_VIEWS = new Set(["overview", "confirmed", "upcoming"]);
const STAGE_LABELS = {
  awarded: "Contract awarded",
  extension: "Contract extension",
  "contract-notice": "AusTender notice",
  amendment: "Contract amendment",
  preferred: "Preferred tenderer",
  shortlisted: "Shortlist",
  selected: "Selected, contract pending",
  tender: "Tender activity",
  expected: "Decision expected",
  speculation: "Speculation",
  "tender-closing": "Tender closing",
};
const NO_FINDINGS = "No major government commercial agreements or credible forward speculation reported within the 14-day window.";
const THEME_KEY = "mao-theme";

const main = $("#main");
const desktop = matchMedia("(min-width: 1024px)");

const state = {
  reports: [],
  report: null,
  settings: null,
  status: null,
  commerce: null,
  admin: null,
  editingItem: null,
  authError: null,
  view: "overview",
  filters: { q: "", scope: "all", sector: "", jur: "", source: "" },
  sort: "date",
  pollTimer: null,
  wasRunning: false,
};

const safeUrl = (url) => (/^https?:\/\//i.test(url ?? "") ? url : null);

// ------------------------------------------------------------------ formatting

function fmtMoney(amount, currency = "AUD") {
  if (!Number.isFinite(amount)) return "—";
  const prefix = currency === "AUD" ? "$" : currency === "USD" ? "US$" : currency === "NZD" ? "NZ$" : `${currency} `;
  const scaled = (v, suffix) => {
    const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "");
    return `${prefix}${s}${suffix}`;
  };
  const abs = Math.abs(amount);
  if (abs >= 1e9) return scaled(amount / 1e9, "B");
  if (abs >= 1e6) return scaled(amount / 1e6, "M");
  if (abs >= 1e3) return scaled(amount / 1e3, "k");
  return `${prefix}${amount.toFixed(0)}`;
}
const utcDate = (iso) => new Date(`${iso}T00:00:00Z`);
const fmtDate = (iso) => (iso ? utcDate(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }) : "—");
const fmtDateLong = (iso) =>
  utcDate(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });
const fmtDateTime = (ts) =>
  new Date(ts).toLocaleString("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtPrice = (p) => (Number.isFinite(p) ? `$${p < 1 ? p.toFixed(3) : p.toFixed(2)}` : "—");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function tickerLabel(c, short = false) {
  if (c.listing === "ASX") return `ASX: ${c.code}`;
  if (c.listing === "Overseas") return `${c.exchange}: ${c.code}`;
  if (c.listing === "Private" || c.listing === "Government-owned") return c.listing;
  return short ? "Unverified" : "Unlisted / unverified";
}

// ------------------------------------------------------------------ tokens

const tokensOn = () => state.commerce?.tokenSystemEnabled === true;
const detailsProduct = () => state.commerce?.items?.find((i) => i.id === DETAILS_ITEM_ID) ?? null;
const dollars = (n, currency) => `$${Math.round(n)} ${currency}`;

/** Dollar lines for a price object, only for currencies this visitor may see. */
function priceLines(price = {}) {
  return [price.aud !== undefined ? dollars(price.aud, "AUD") : null, price.usd !== undefined ? dollars(price.usd, "USD") : null].filter(Boolean);
}

/** Token icon + whole-number amount; dollar equivalents appear only in its hover/focus tooltip. */
function tokenBadge(amount, price) {
  const lines = priceLines(price);
  const el = h(
    "span",
    { class: "token", tabindex: lines.length ? "0" : null, "aria-label": `${amount} ${amount === 1 ? "token" : "tokens"}${lines.length ? ` (${lines.join(", ")})` : ""}` },
    icon("i-token", "token-icon"),
    h("span", { "aria-hidden": "true" }, String(amount)),
  );
  if (lines.length) el.dataset.tip = lines.join("\n");
  return el;
}

function lockedValue(item, where = "table") {
  const product = detailsProduct();
  if (!product) return h("span", { class: "locked-note" }, icon("i-lock"), "Details unavailable");
  return h(
    "button",
    {
      class: "unlock-btn",
      type: "button",
      "data-unlock": item.id,
      "aria-label": `Unlock value, scope and sources for ${item.companies.map((c) => c.display).join(", ") || "this item"}`,
      ...agent(where === "table" ? `btn_unlock_${item.id}` : `btn_unlock_${where}_${item.id}`),
    },
    icon("i-lock"),
    h("span", {}, "Unlock"),
    tokenBadge(product.tokenAmount, product.price),
  );
}

const lockedSource = () => h("span", { class: "locked-note" }, icon("i-lock"), "Source unlocks with details");

function renderWallet() {
  const btn = $("#wallet-btn");
  btn.hidden = !tokensOn();
  if (tokensOn()) $("#wallet-balance").textContent = String(state.commerce.wallet.balance);
}

async function loadCommerce() {
  try {
    state.commerce = await api("GET", "/api/commerce");
  } catch {
    state.commerce = null;
  }
  renderWallet();
}

function tokenDialog(title, ...content) {
  $("#token-title").textContent = title;
  $("#token-body").replaceChildren(...content.flat().filter(Boolean));
  const dialog = $("#token-dialog");
  if (!dialog.open) dialog.showModal();
}

function itemLabel(item) {
  return item.companies.map((c) => c.display).join(", ") || item.agency || "This item";
}

function openUnlock(itemId) {
  const item = allItems().find((i) => i.id === itemId);
  const product = detailsProduct();
  if (!item || !product) return;
  const balance = state.commerce.wallet.balance;
  const short = product.tokenAmount - balance;
  tokenDialog(
    product.title,
    h("p", {}, product.description),
    h(
      "dl",
      { class: "facts" },
      fact(item.kind === "upcoming" ? "Opportunity" : "Contract", `${itemLabel(item)}${item.agency ? ` · ${item.agency}` : ""}`),
      fact("Cost", tokenBadge(product.tokenAmount, product.price)),
      fact("Your balance", h("span", { class: "token" }, icon("i-token", "token-icon"), String(balance))),
    ),
    short <= 0
      ? h("div", { class: "dialog-actions" }, h("button", { class: "btn btn-primary", type: "button", "data-confirm-unlock": item.id, ...agent("btn_confirm_unlock") }, icon("i-lock"), "Unlock"))
      : [
          h("p", { class: "notice notice-warn" }, `You need ${plural(short, "more token")}.`),
          h("div", { class: "dialog-actions" }, h("button", { class: "btn btn-primary", type: "button", "data-open-wallet": "", ...agent("btn_get_tokens") }, icon("i-token", "token-icon"), "Get tokens")),
        ],
  );
}

async function confirmUnlock(itemId) {
  try {
    const { balance } = await api("POST", "/api/unlock", { itemId });
    $("#token-dialog").close();
    await loadCommerce();
    await loadReport(state.report.id);
    announce(`Unlocked · ${plural(balance, "token")} left`);
  } catch (err) {
    announce(err.message, "error");
    await loadCommerce();
  }
}

function openWallet() {
  const c = state.commerce;
  const quantity = h("input", {
    type: "number", min: "1", step: "1", value: "10", inputmode: "numeric", id: "buy-qty", name: "quantity",
    "aria-describedby": "buy-qty-error buy-total", ...agent("input_buy_quantity"),
  });
  const error = h("span", { id: "buy-qty-error", class: "error-msg", "data-agent-error": "quantity", "aria-live": "assertive" });
  const total = h("p", { class: "buy-total", id: "buy-total", "aria-live": "polite" });
  const updateTotal = () => {
    const n = Number(quantity.value);
    const valid = Number.isInteger(n) && n > 0;
    error.textContent = valid ? "" : "Enter a whole number of tokens.";
    quantity.toggleAttribute("aria-invalid", !valid);
    const lines = valid ? priceLines({ aud: c.tokenPrice.aud !== undefined ? n * c.tokenPrice.aud : undefined, usd: c.tokenPrice.usd !== undefined ? n * c.tokenPrice.usd : undefined }) : [];
    total.textContent = lines.length ? `Total: ${lines.join(" · ")}` : "";
  };
  quantity.addEventListener("input", updateTotal);
  updateTotal();
  const perToken = priceLines(c.tokenPrice);
  tokenDialog(
    "Your tokens",
    h("dl", { class: "facts" }, fact("Balance", h("span", { class: "token" }, icon("i-token", "token-icon"), String(c.wallet.balance))), fact("Contracts unlocked", String(c.wallet.unlocked)), fact("Wallet", c.walletLabel)),
    h(
      "section",
      { class: "detail-section" },
      h("h3", {}, "Buy tokens"),
      perToken.length ? h("p", { class: "cell-sub" }, `Price per token: ${perToken.join(" · ")}`) : null,
      h("div", { class: "field" }, h("label", { for: "buy-qty" }, "Tokens"), quantity, error),
      total,
      h("button", { class: "btn btn-primary", type: "button", disabled: true, ...agent("btn_buy_tokens") }, "Buy tokens"),
      h("p", { class: "hint" }, `Online payment isn't connected yet. The administrator can add tokens to wallet ${c.walletLabel} from the Superadmin panel.`),
    ),
  );
}

// ------------------------------------------------------------------ filtering

const marketOf = (code) => state.report?.market?.[code] ?? null;
const watchlist = () => new Set(state.settings?.watchlist ?? []);
const asxCompanies = (item) => item.companies.filter((c) => c.listing === "ASX");
const isWatch = (item) => {
  const w = watchlist();
  return asxCompanies(item).some((c) => w.has(c.code));
};
const hasOptions = (item) => asxCompanies(item).some((c) => marketOf(c.code)?.options?.available);
const audValue = (item) => (item.value?.currency === "AUD" && Number.isFinite(item.value.amount) ? item.value.amount : 0);

function matches(item) {
  const f = state.filters;
  if (f.scope === "asx" && !asxCompanies(item).length) return false;
  if (f.scope === "options" && !hasOptions(item)) return false;
  if (f.scope === "watchlist" && !isWatch(item)) return false;
  if (f.sector && item.sector !== f.sector) return false;
  if (f.jur && (item.jurisdiction ?? "Unknown") !== f.jur) return false;
  if (f.source && !item.sources.some((s) => s.type === f.source)) return false;
  if (f.q) {
    const haystack = [item.title, item.scope, item.agency, item.context, item.note, ...item.companies.flatMap((c) => [c.display, c.name, c.code, tickerLabel(c)])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term))) return false;
  }
  return true;
}

const filtered = (list) => (list ?? []).filter(matches);
const activeFilterCount = () => ["sector", "jur", "source"].filter((k) => state.filters[k]).length + (state.filters.scope !== "all" ? 1 : 0);

// ------------------------------------------------------------------ navigation

function setView(view, { scroll = true } = {}) {
  if (!VIEWS.includes(view)) view = "overview";
  state.view = view;
  main.dataset.view = view;
  if (view === "admin") renderAdmin();
  for (const a of $$(".sidenav [data-nav], .bottomnav [data-nav]")) {
    if (a.dataset.nav === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (!scroll) return;
  if (desktop.matches && BRIEF_VIEWS.has(view) && view !== "overview") $(`#${view}`).scrollIntoView({ block: "start" });
  else window.scrollTo({ top: 0 });
}

function navigate(view) {
  history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
  setView(view);
}

// ------------------------------------------------------------------ rendering: brief

function renderMeta() {
  const r = state.report;
  const meta = $("#report-meta");
  if (!r) {
    $("#overview-title").textContent = "Daily brief";
    meta.replaceChildren();
    return;
  }
  $("#overview-title").textContent = `Daily brief · ${fmtDateLong(r.date)}`;
  const parts = [
    h("span", { class: r.mode === "ai" ? "badge badge-ai" : "badge" }, r.mode === "ai" ? [icon("i-sparkle"), "AI analyst"] : "Standard (rule-based)"),
    h("span", {}, `Confirmed: ${fmtDate(r.window.pastFrom)} – ${fmtDate(r.window.pastTo)}`),
    h("span", {}, `Forward: to ${fmtDate(r.window.forwardTo)}`),
    h("span", {}, `Generated ${fmtTime(r.generatedAt)} Sydney time`),
    r.ai ? h("span", {}, `Est. cost US$${r.ai.costUsd.toFixed(2)} · ${plural(r.ai.usage.searches, "search", "searches")}`) : null,
  ];
  meta.replaceChildren(...parts.filter(Boolean));
}

function notice(kind, iconId, ...content) {
  return h("div", { class: `notice notice-${kind}`, role: kind === "error" ? "alert" : null }, icon(iconId), h("div", {}, ...content));
}

function renderNotices() {
  const box = $("#notices");
  const r = state.report;
  const items = [];
  const status = state.status;
  if (status?.storageWarning) items.push(notice("error", "i-alert", status.storageWarning));
  if (status?.error && !status.running) items.push(notice("error", "i-alert", `Last run failed: ${status.error}`));
  if (!r) {
    items.push(notice("warn", "i-info", status?.running || state.runRequestPending ? "Building the first report. This takes about half a minute." : "No report yet. Press Refresh to build the first one."));
  } else {
    if (!r.confirmed.length && !r.upcoming.length) items.push(h("div", { class: "notice notice-empty" }, NO_FINDINGS));
    const failing = r.sources.filter((s) => s.status === "error");
    if (failing.length) {
      items.push(notice("warn", "i-alert", `${plural(failing.length, "source")} failed in this run: ${failing.map((s) => `${s.label} (${s.error})`).join("; ")}. Results may be incomplete.`));
    }
    const w = watchlist();
    const hits = [...new Set([...r.confirmed, ...r.upcoming, ...r.other].flatMap((i) => asxCompanies(i).map((c) => c.code)).filter((code) => w.has(code)))];
    if (hits.length) items.push(notice("info", "i-star", `Watchlist in this report: ${hits.join(", ")}`));
  }
  box.replaceChildren(...items);
}

function kpi(label, value, sub) {
  return h("div", { class: "kpi" }, h("span", { class: "kpi-label" }, label), h("span", { class: "kpi-value" }, value), sub ? h("span", { class: "kpi-sub" }, sub) : null);
}

function renderKpis() {
  const r = state.report;
  const box = $("#kpis");
  if (!r) return box.replaceChildren();
  const confirmed = filtered(r.confirmed);
  const upcoming = filtered(r.upcoming);
  const both = [...confirmed, ...upcoming];
  const tickers = new Set(both.flatMap((i) => asxCompanies(i).map((c) => c.code)));
  const withOptions = [...tickers].filter((code) => marketOf(code)?.options?.available);
  const valued = confirmed.filter((i) => audValue(i) > 0);
  const total = valued.reduce((sum, i) => sum + audValue(i), 0);
  const locked = confirmed.filter((i) => i.locked).length;
  box.replaceChildren(
    kpi("Confirmed contracts", String(confirmed.length), `${fmtDate(r.window.pastFrom)} – ${fmtDate(r.window.pastTo)}`),
    kpi("ASX-linked items", String(both.filter((i) => asxCompanies(i).length).length), plural(tickers.size, "ticker")),
    kpi("Disclosed value", fmtMoney(total), `${plural(valued.length, "confirmed item")} with a value${locked ? `; ${locked} locked not counted` : ""}`),
    kpi("Upcoming", String(upcoming.length), `to ${fmtDate(r.window.forwardTo)}`),
    kpi("Tickers with options", String(withOptions.length), withOptions.length ? withOptions.slice(0, 5).join(", ") + (withOptions.length > 5 ? "…" : "") : "none in view"),
  );
}

function renderTakeaways() {
  const list = $("#takeaways");
  const takeaways = state.report?.takeaways ?? [];
  list.replaceChildren(...(takeaways.length ? takeaways.map((t) => h("li", {}, t)) : [h("li", { class: "muted" }, state.report ? NO_FINDINGS : "Takeaways appear once a report has run.")]));
}

function renderSectorBars() {
  const box = $("#sector-bars");
  const confirmed = filtered(state.report?.confirmed);
  const bySector = new Map();
  for (const item of confirmed) {
    const s = bySector.get(item.sector) ?? { count: 0, value: 0, locked: 0 };
    s.count += 1;
    s.value += audValue(item);
    if (item.locked) s.locked += 1;
    bySector.set(item.sector, s);
  }
  const rows = [...bySector.entries()].sort((a, b) => b[1].count - a[1].count || b[1].value - a[1].value);
  if (!rows.length) return box.replaceChildren(h("p", { class: "empty-chart" }, "No confirmed items in view."));
  const max = Math.max(...rows.map(([, s]) => s.count));
  box.replaceChildren(
    ...rows.map(([sector, s]) => {
      const valueText = s.locked === s.count ? "values locked" : s.value ? `${fmtMoney(s.value)}${s.locked ? ` + ${s.locked} locked` : ""}` : "value undisclosed";
      const bar = h("span", { class: "bar" });
      bar.style.setProperty("--w", `${(s.count / max) * 100}%`);
      const row = h(
        "div",
        { class: "bar-row", role: "listitem", tabindex: "0", "aria-label": `${sector}: ${plural(s.count, "confirmed item")}, ${valueText}`, ...agent(`chart_sector_${sector}`) },
        h("span", { class: "bar-label" }, sector),
        h("span", { class: "bar-track", "aria-hidden": "true" }, bar),
        h("span", { class: "bar-value" }, String(s.count), h("small", {}, ` · ${valueText}`)),
      );
      row.dataset.tipValue = plural(s.count, "item");
      row.dataset.tipLabel = `${sector} · ${valueText}`;
      return row;
    }),
  );
}

// ------------------------------------------------------------------ rendering: tables

function changeEl(pct) {
  const dir = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const words = dir === "up" ? "up" : dir === "down" ? "down" : "unchanged";
  return h(
    "span",
    { class: `chg ${dir}`, title: "Latest session move (delayed)", "aria-label": `${words} ${Math.abs(pct).toFixed(1)} percent, latest session` },
    dir === "flat" ? null : icon(dir === "up" ? "i-up" : "i-down"),
    `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
  );
}

function tickerChip(c) {
  const m = c.listing === "ASX" ? marketOf(c.code) : null;
  const title = c.note ?? (c.listing === "Unverified" ? "Not matched to a listed company" : c.listing === "ASX" && m?.price ? `Last ${fmtPrice(m.price)}` : null);
  return h(
    "span",
    { class: "ticker", "data-listing": c.listing, title },
    h("span", { class: "ticker-code" }, tickerLabel(c, true)),
    m && Number.isFinite(m.changePct) ? changeEl(m.changePct) : null,
    m?.options?.available ? h("span", { class: "opt-badge", title: "Exchange-traded options are listed on this stock" }, "Options") : null,
  );
}

/** Companies with one entry per listing (the same ticker can be named several ways in a story). */
function uniqueCompanies(item) {
  const seen = new Set();
  return item.companies.filter((c) => {
    const key = tickerLabel(c, true) + (c.listing === "ASX" || c.listing === "Overseas" ? "" : c.display);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tickersCell(item) {
  if (!item.companies.length) return h("span", { class: "muted" }, "—");
  return h("div", { class: "tickers" }, uniqueCompanies(item).map(tickerChip));
}

function companyCell(item, emptyLabel = "Not named") {
  const names = item.companies.map((c) => c.display);
  const sub = asxCompanies(item)[0]?.industry ?? (item.companies[0]?.listing === "Unverified" ? "Listing unverified" : null);
  return [
    isWatch(item) ? [icon("i-star", "watch-star"), h("span", { class: "visually-hidden" }, "Watchlist: ")] : null,
    h("button", { class: "company-btn", type: "button", "data-open": item.id, "aria-haspopup": "dialog", ...agent(`btn_open_details_${item.id}`) }, names.length ? names.join(", ") : emptyLabel),
    sub ? h("span", { class: "cell-sub" }, sub) : null,
  ];
}

/** `where` keeps agent ids unique between the table and the detail dialog. */
function sourceLink(item, source, index, where = "table") {
  const url = safeUrl(source.url);
  return url
    ? h("a", { class: "source-link", href: url, target: "_blank", rel: "noopener noreferrer", title: source.title, ...agent(`link_source_${where}_${item.id}_${index}`) }, h("span", { class: "src-title" }, source.title), icon("i-external"))
    : h("span", {}, source.title);
}

function sourceCell(item, { context } = {}) {
  const [first, ...rest] = item.sources;
  const parts = [];
  if (context) parts.push(h("span", { class: "context-text clamp-2", title: context }, context));
  if (first) parts.push(sourceLink(item, first, 0), h("span", { class: "cell-sub" }, [first.publisher, first.date ? fmtDate(first.date) : null].filter(Boolean).join(" · ")));
  else if (!context) parts.push(h("span", { class: "muted" }, "—"));
  if (rest.length) {
    parts.push(h("button", { class: "btn-link source-more", type: "button", "data-open": item.id, ...agent(`btn_more_sources_${item.id}`) }, `+${rest.length} more ${rest.length === 1 ? "source" : "sources"}`));
  }
  return parts;
}

function agencyCell(item) {
  if (!item.agency) return h("span", { class: "muted" }, "—");
  return [h("span", { class: "cell-main" }, item.agency), item.jurisdiction ? h("span", { class: "cell-sub" }, item.jurisdiction) : null];
}

function valueCell(item, text = item.scope) {
  return h("div", { class: "value-cell" }, item.value ? h("strong", {}, item.value.text) : null, text ? h("span", { class: "clamp-2", title: text }, text) : null);
}

const rowFor = (item, cells) => h("tr", { class: `row${isWatch(item) ? " is-watch" : ""}`, role: "row", "data-id": item.id }, cells);
const td = (cls, label, ...content) => h("td", { class: cls, role: "cell", "data-label": label }, ...content);

function headerRow(cols) {
  return h(
    "thead",
    { role: "rowgroup" },
    h(
      "tr",
      { role: "row" },
      cols.map(([cls, label, sortKey]) =>
        h(
          "th",
          { class: cls, role: "columnheader", scope: "col", "aria-sort": sortKey && state.sort === sortKey ? "descending" : null },
          sortKey ? h("button", { class: "sort-btn", type: "button", "data-sort": sortKey, "aria-pressed": String(state.sort === sortKey), ...agent(`btn_sort_${sortKey}`) }, label) : label,
        ),
      ),
    ),
  );
}

const emptyRow = (message) => h("tr", { class: "empty-row", role: "row" }, h("td", { role: "cell", colspan: "6" }, message));

function emptyMessage(list, noun) {
  if (!state.report) return "No report loaded.";
  if (!list.length) return `No ${noun} in this report.`;
  return `No ${noun} match the current filters.`;
}

function renderConfirmed() {
  const all = state.report?.confirmed ?? [];
  const items = filtered(all);
  if (state.sort === "value") items.sort((a, b) => audValue(b) - audValue(a));
  const rows = items.map((item) =>
    rowFor(item, [
      td("c-lead date-cell", null, h("time", { datetime: item.date }, fmtDate(item.date)), h("span", { class: "stage" }, STAGE_LABELS[item.stage] ?? "")),
      td("c-lead", null, companyCell(item)),
      td("c-ticker", null, tickersCell(item)),
      td("", "Agency", agencyCell(item)),
      td("", "Value & scope", item.locked ? lockedValue(item) : valueCell(item)),
      td("c-source", null, item.locked ? lockedSource() : sourceCell(item)),
    ]),
  );
  $("#confirmed-table").replaceChildren(
    h("caption", { class: "visually-hidden" }, "Confirmed contracts, past 7 days"),
    headerRow([["col-date", "Date", "date"], ["col-company", "Company"], ["col-ticker", "ASX / ticker"], ["col-agency", "Agency / department"], ["col-value", "Value / scope", "value"], ["col-source", "Source"]]),
    h("tbody", { role: "rowgroup" }, rows.length ? rows : emptyRow(emptyMessage(all, "confirmed contracts"))),
  );
}

function renderUpcoming() {
  const all = state.report?.upcoming ?? [];
  const items = filtered(all);
  const rows = items.map((item) =>
    rowFor(item, [
      td("c-lead date-cell", null, h("span", { class: "cell-main" }, item.window?.label ?? "Next 7 days"), h("span", { class: "stage" }, STAGE_LABELS[item.stage] ?? "")),
      td("c-lead", null, companyCell(item, item.stage === "tender-closing" ? "Open tender" : "Vendors not named")),
      td("c-ticker", null, tickersCell(item)),
      td("", "Procuring body", agencyCell(item)),
      td("", "Opportunity", item.locked ? lockedValue(item) : valueCell(item, item.title)),
      td("c-source", null, item.locked ? [h("span", { class: "context-text" }, STAGE_LABELS[item.stage] ?? ""), lockedSource()] : sourceCell(item, { context: item.context })),
    ]),
  );
  $("#upcoming-table").replaceChildren(
    h("caption", { class: "visually-hidden" }, "Upcoming contracts and speculation, next 7 days"),
    headerRow([["col-date", "Window"], ["col-company", "Prospective vendors"], ["col-ticker", "ASX / ticker"], ["col-agency", "Procuring body"], ["col-value", "Opportunity"], ["col-source", "Context & source"]]),
    h("tbody", { role: "rowgroup" }, rows.length ? rows : emptyRow(emptyMessage(all, "forward-looking items"))),
  );
}

function renderOther() {
  const all = state.report?.other ?? [];
  const items = filtered(all);
  const rows = items.map((item) =>
    rowFor(item, [
      td("c-lead date-cell", null, h("time", { datetime: item.date }, fmtDate(item.date)), h("span", { class: "stage" }, STAGE_LABELS[item.stage] ?? "")),
      td("c-lead", null, companyCell(item)),
      td("c-ticker", null, tickersCell(item)),
      td("", "Announcement", item.locked ? null : h("span", { class: "cell-main" }, item.title), item.note ? h("span", { class: "cell-sub" }, item.note) : null),
      td("", "Value", item.locked ? lockedValue(item) : item.value ? h("strong", {}, item.value.text) : h("span", { class: "muted" }, "—")),
      td("c-source", null, item.locked ? lockedSource() : sourceCell(item)),
    ]),
  );
  $("#other-table").replaceChildren(
    h("caption", { class: "visually-hidden" }, "Other ASX contract news"),
    headerRow([["col-date", "Date"], ["col-company", "Company"], ["col-ticker", "Ticker"], ["", "Announcement"], ["col-agency", "Value"], ["col-source", "Source"]]),
    h("tbody", { role: "rowgroup" }, rows.length ? rows : emptyRow(emptyMessage(all, "other contract announcements"))),
  );
}

function renderCounts() {
  const r = state.report;
  for (const key of ["confirmed", "upcoming", "other"]) {
    const el = $(`.nav-count[data-count="${key}"]`);
    if (el) el.textContent = r ? String(filtered(r[key]).length) : "";
  }
}

function renderSourcesTable() {
  const sources = state.report?.sources ?? [];
  const label = { ok: "OK", partial: "Partial", stale: "Stale", error: "Failed", off: "Off" };
  $("#sources-table").replaceChildren(
    h("caption", { class: "visually-hidden" }, "Source health"),
    headerRow([["", "Source"], ["", "Details"], ["", "Status"], ["", "Items"], ["", "Time"]]),
    h(
      "tbody",
      { role: "rowgroup" },
      sources.length
        ? sources.map((s) =>
            h(
              "tr",
              { class: "row", role: "row" },
              td("c-lead", null, h("span", { class: "cell-main" }, s.label)),
              td("", "Details", [s.error ?? s.detail ?? "", ...(s.warnings ?? []).slice(0, 3).map((w) => h("span", { class: "cell-sub" }, w))]),
              td("c-ticker", null, h("span", { class: "status-pill", "data-status": s.status }, h("span", { class: "dot" }), label[s.status] ?? s.status)),
              td("", "Items", String(s.count ?? 0)),
              td("", "Time", s.ms ? `${(s.ms / 1000).toFixed(1)} s` : "—"),
            ),
          )
        : emptyRow("Run a report to see source health."),
    ),
  );
  const ai = state.report?.ai;
  $("#ai-output-card").hidden = !ai?.markdown;
  $("#ai-markdown").textContent = ai?.markdown ?? "";
}

function render() {
  renderMeta();
  renderNotices();
  renderKpis();
  renderTakeaways();
  renderSectorBars();
  renderConfirmed();
  renderUpcoming();
  renderOther();
  renderCounts();
  renderSourcesTable();
  const n = activeFilterCount();
  $("#filters-badge").hidden = !n;
  $("#filters-badge").textContent = String(n);
  $("#f-clear").hidden = !n && !state.filters.q;
}

// ------------------------------------------------------------------ detail dialog

const allItems = () => (state.report ? [...state.report.confirmed, ...state.report.upcoming, ...state.report.other] : []);

function fact(label, value) {
  return value ? h("div", {}, h("dt", {}, label), h("dd", {}, value)) : null;
}

function companyDetail(c) {
  const m = c.listing === "ASX" ? marketOf(c.code) : null;
  const o = m?.options;
  const asxLinks =
    c.listing === "ASX"
      ? h(
          "div",
          { class: "link-row" },
          h("a", { href: `https://www.asx.com.au/markets/company/${encodeURIComponent(c.code)}`, target: "_blank", rel: "noopener noreferrer", ...agent(`link_asx_company_${c.code}`) }, "ASX company page ", icon("i-external")),
          h(
            "a",
            { href: `https://www.asx.com.au/markets/trade-our-cash-market/announcements.${encodeURIComponent(c.code.toLowerCase())}`, target: "_blank", rel: "noopener noreferrer", ...agent(`link_asx_announcements_${c.code}`) },
            "Announcements ",
            icon("i-external"),
          ),
        )
      : null;
  return h(
    "div",
    { class: "company-card" },
    h("div", { class: "company-card-head" }, h("strong", {}, c.display), tickerChip(c)),
    m
      ? h(
          "dl",
          { class: "facts" },
          fact("Last price", fmtPrice(m.price)),
          fact("Latest session", Number.isFinite(m.changePct) ? changeEl(m.changePct) : "—"),
          fact("Market cap", m.marketCap ? fmtMoney(m.marketCap) : "—"),
          fact(
            "Exchange-traded options",
            o ? (o.available ? `Yes: ${[o.weekly ? `${o.weekly} weekly` : null, o.monthly ? `${o.monthly} monthly` : null, o.quarterly ? `${o.quarterly} quarterly` : null].filter(Boolean).join(", ")} expiries` : "Not listed") : "Unknown",
          ),
          o?.nextExpiry ? fact("Next expiry", fmtDateLong(o.nextExpiry)) : null,
        )
      : null,
    c.note ? h("p", { class: "cell-sub" }, c.note) : null,
    c.listing === "Unverified" ? h("p", { class: "cell-sub" }, `Named "${c.name}" in the source; not matched to an ASX or overseas listing.`) : null,
    asxLinks,
  );
}

function sourcesSection(item) {
  if (item.locked) {
    return h(
      "section",
      { class: "detail-section locked-panel" },
      h("h3", {}, "Value, scope & sources"),
      h("p", {}, detailsProduct()?.description ?? "Contract details are not available right now."),
      detailsProduct() ? lockedValue(item, "detail") : null,
    );
  }
  return h(
    "section",
    { class: "detail-section" },
    h("h3", {}, item.sources.length === 1 ? "Source" : `Sources (${item.sources.length})`),
    item.sources.length
      ? h(
          "ul",
          { class: "source-list" },
          item.sources.map((s, i) => h("li", {}, sourceLink(item, s, i, "detail"),h("span", { class: "cell-sub" }, [s.publisher, s.date ? fmtDate(s.date) : null].filter(Boolean).join(" · ")))),
        )
      : h("p", { class: "muted" }, "No source link."),
  );
}

function openDetail(id) {
  const item = allItems().find((i) => i.id === id);
  if (!item) return;
  const kindLabel = item.kind === "confirmed" ? "Confirmed contract" : item.kind === "upcoming" ? "Upcoming / speculation" : "Other ASX contract news";
  $("#detail-eyebrow").textContent = `${kindLabel} · ${STAGE_LABELS[item.stage] ?? ""}`;
  $("#detail-title").textContent = item.title ?? itemLabel(item);
  const notices = item.details?.notices ?? [];
  const sections = [
    h(
      "section",
      { class: "detail-section" },
      h("h3", {}, "Overview"),
      h(
        "dl",
        { class: "facts" },
        fact(item.kind === "upcoming" ? "Window" : "Date", item.kind === "upcoming" ? item.window?.label : fmtDateLong(item.date)),
        fact(item.kind === "upcoming" ? "Procuring body" : "Agency", item.agency),
        fact("Government", item.jurisdiction),
        fact("Value", item.value?.text),
        fact("Sector", item.sector),
        fact("Confidence", item.confidence ? `${item.confidence[0].toUpperCase()}${item.confidence.slice(1)}` : null),
      ),
      item.scope && item.scope !== item.title ? h("p", {}, item.scope) : null,
      item.context ? h("p", {}, item.context) : null,
      item.note ? h("p", { class: "cell-sub" }, item.note) : null,
    ),
    item.companies.length ? h("section", { class: "detail-section" }, h("h3", {}, item.companies.length === 1 ? "Company" : "Companies"), uniqueCompanies(item).map(companyDetail)) : null,
    notices.length
      ? h(
          "section",
          { class: "detail-section" },
          h("h3", {}, "AusTender contract notices"),
          h(
            "ul",
            { class: "source-list" },
            notices.map((n) =>
              h(
                "li",
                {},
                safeUrl(n.url) ? h("a", { href: n.url, target: "_blank", rel: "noopener noreferrer", ...agent(`link_notice_${n.cnId}`) }, `${n.cnId}: ${n.description || n.category} `, icon("i-external")) : `${n.cnId}: ${n.description}`,
                h(
                  "span",
                  { class: "cell-sub" },
                  [fmtMoney(n.value ?? NaN), n.amendment ? "amendment" : null, n.start && n.end ? `${fmtDate(n.start)} – ${fmtDate(n.end)} ${n.end.slice(0, 4)}` : null, n.method, n.supplier].filter(Boolean).join(" · "),
                ),
              ),
            ),
          ),
        )
      : null,
    sourcesSection(item),
  ];
  // replaceChildren() would print a null as text, so drop absent sections first.
  $("#detail-body").replaceChildren(...sections.filter(Boolean));
  $("#detail").showModal();
  $("#detail .dialog-body").scrollTop = 0;
}

// ------------------------------------------------------------------ settings (schema-driven)

// Each card's fields. A group that is the card's whole subject is rendered flat (the card
// title already names it); the rest keep their fieldset and legend.
const SETTINGS_FORMS = {
  "#schedule-form": (s) => groupFields("schedule", s),
  "#sources-form": (s) => [
    ...groupFields("sources", s),
    ...schemaFields(SETTINGS, { form: "settings", values: s, only: ["includeLocalGovernment", "thresholds"] }),
  ],
  "#ai-form": (s) => groupFields("ai", s),
};
const groupFields = (key, s) => schemaFields(SETTINGS.properties[key], { form: "settings", path: [key], values: s[key] });

/** (Re)builds the settings forms from the Settings schema with the current values. */
function renderSettings() {
  const s = state.settings;
  if (!s) return;
  $("#watchlist-chips").replaceChildren(
    ...s.watchlist.map((code) =>
      h("li", { class: "chip" }, code, h("button", { type: "button", "data-remove": code, "aria-label": `Remove ${code} from watchlist`, ...agent(`btn_watchlist_remove_${code}`) }, icon("i-close"))),
    ),
  );
  for (const [selector, fields] of Object.entries(SETTINGS_FORMS)) {
    const form = $(selector);
    $("[data-fields]", form).replaceChildren(...fields(s), formErrorNode(form.id));
  }
  const aiSwitch = $("#settings-schedule-ai");
  if (aiSwitch) aiSwitch.disabled = !state.status?.aiConfigured;
  applyManageAccess();
}

/** On a public deployment only the superadmin may change settings or start runs. */
function applyManageAccess() {
  const allowed = state.status?.canManage !== false;
  for (const form of $$("#settings form")) {
    for (const el of $$("input, select, textarea, button", form)) {
      if (!allowed) el.disabled = true;
      else if (el.dataset.lockedByAccess) el.disabled = false;
      if (!allowed) el.dataset.lockedByAccess = "true";
      else delete el.dataset.lockedByAccess;
    }
  }
  for (const btn of $$("[data-remove]")) btn.hidden = !allowed;
  const note = $("#manage-note");
  if (note) note.hidden = allowed;
  if (allowed) {
    const aiSwitch = $("#settings-schedule-ai");
    if (aiSwitch) aiSwitch.disabled = !state.status?.aiConfigured;
  }
}

async function saveSettings(patch, { form, message = "Settings saved" } = {}) {
  const errors = validate(SETTINGS_PATCH, patch);
  if (errors.length) {
    if (form) showErrors(form, errors);
    announce(errors[0].message, "error");
    return false;
  }
  try {
    state.settings = await api("PUT", "/api/settings", patch);
    renderSettings();
    render();
    await refreshStatus();
    announce(message);
    return true;
  } catch (err) {
    if (form && err instanceof ApiError && err.fields.length) showErrors(form, err.fields);
    announce(`Could not save: ${err.message}`, "error");
    return false;
  }
}

function bindSettingsForms() {
  for (const selector of Object.keys(SETTINGS_FORMS)) {
    const form = $(selector);
    bindLiveValidation(form, SETTINGS_PATCH);
    form.addEventListener("change", (event) => {
      if (!event.target.dataset.schemaPath) return;
      const { value, errors } = validateForm(form, SETTINGS_PATCH);
      if (!errors.length) saveSettings(value, { form });
    });
    form.addEventListener("submit", (event) => event.preventDefault());
  }

  const watchForm = $("#watchlist-form");
  watchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#watchlist-input");
    const codes = [...new Set(input.value.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
    const bad = codes.filter((c) => validate(ASX_CODE, c).length);
    const errorNode = $('[data-agent-error="watchlist"]', watchForm);
    if (!codes.length || bad.length) {
      errorNode.textContent = codes.length ? `Not ASX codes: ${bad.join(", ")}. ${ASX_CODE["x-pattern-message"]}` : "Enter one or more ASX codes, e.g. DRO, TNE.";
      input.setAttribute("aria-invalid", "true");
      return;
    }
    errorNode.textContent = "";
    input.removeAttribute("aria-invalid");
    saveSettings({ watchlist: [...new Set([...state.settings.watchlist, ...codes])] }, { form: watchForm, message: `Watchlist: added ${codes.join(", ")}` }).then((saved) => {
      if (saved) input.value = "";
    });
  });
}

// ------------------------------------------------------------------ superadmin panel (schema-driven)

async function adminCall(method, path, body, { form, message } = {}) {
  try {
    state.admin = await api(method, `/api/admin/${path}`, body ?? {});
    if (message) announce(message);
    await loadCommerce();
    if (state.report) await loadReport(state.report.id);
    renderAdmin();
    return true;
  } catch (err) {
    if (form && err instanceof ApiError && err.fields.length) showErrors(form, err.fields);
    announce(err.message, "error");
    return false;
  }
}

/** A <form> whose fields come from `schema`, with live validation and a submit button. */
function schemaForm({ id, schema, only, values, title, submitLabel, className = "card", extra = [], labels }) {
  const form = h(
    "form",
    { class: className, id, novalidate: true, "data-schema-target": schema.title, ...agent(`form_${id}`), "aria-labelledby": title ? `${id}-title` : null },
    title ? h("h3", { class: "card-title", id: `${id}-title` }, title) : null,
    schemaFields(schema, { form: id, values, only, labels }),
    formErrorNode(id),
    extra,
    submitLabel ? h("button", { class: "btn btn-primary", type: "submit", ...agent(`btn_submit_${id}`) }, submitLabel) : null,
  );
  bindLiveValidation(form, schema);
  form.dataset.schema = id;
  SCHEMA_FORMS.set(id, schema);
  return form;
}
const SCHEMA_FORMS = new Map();

function renderAdmin() {
  const root = $("#admin-root");
  const actions = $("#admin-actions");
  const c = state.commerce;
  SCHEMA_FORMS.clear();
  if (!c?.admin) {
    actions.replaceChildren();
    const authError = state.authError
      ? h("p", { class: "notice notice-warn", role: "alert", "data-agent-error": "_auth" }, state.authError)
      : null;
    if (c?.adminAuth === "google") {
      root.replaceChildren(
        h(
          "section",
          { class: "card admin-login", "aria-labelledby": "admin-google-title" },
          h("h3", { class: "card-title", id: "admin-google-title" }, "Superadmin sign-in"),
          h("p", { class: "card-sub" }, "Sign in with the Google account that is listed as superadmin."),
          authError,
          h("a", { class: "btn btn-primary", href: "/auth/google", ...agent("btn_admin_google_sign_in") }, icon("i-shield"), "Sign in with Google"),
        ),
      );
      return;
    }
    const form = schemaForm({
      id: "admin-login",
      schema: LOGIN_REQUEST,
      title: "Superadmin sign-in",
      className: "card admin-login",
      submitLabel: "Sign in",
      extra: c && !c.adminAuth ? [h("p", { class: "notice notice-warn" }, "Superadmin access isn't set up. Add Google sign-in or SUPERADMIN_PASSWORD to the .env file next to package.json (see README), then restart the app.")] : [],
    });
    if (authError) form.insertBefore(authError, form.children[1]);
    root.replaceChildren(form);
    return;
  }
  if (!state.admin) {
    root.replaceChildren(h("p", { class: "muted" }, "Loading…"));
    api("GET", "/api/admin/state").then(
      (s) => {
        state.admin = s;
        renderAdmin();
      },
      (err) => announce(err.message, "error"),
    );
    return;
  }
  const a = state.admin;
  actions.replaceChildren(
    c.adminIdentity && c.adminIdentity !== "password" ? h("span", { class: "cell-sub admin-identity" }, `Signed in as ${c.adminIdentity}`) : null,
    h("button", { class: "btn btn-ghost", type: "button", "data-admin-logout": "", ...agent("btn_admin_sign_out") }, "Sign out"),
  );

  const toggles = schemaForm({ id: "admin-toggles", schema: COMMERCE_SETTINGS_PATCH, only: ["isTokenSystemEnabled", "isAudEnabled", "isUsdEnabled"], values: a.settings, title: "System toggles" });
  const pricing = schemaForm({ id: "admin-pricing", schema: COMMERCE_SETTINGS_PATCH, only: ["tokenPriceAud", "tokenPriceUsd"], values: a.settings, title: "Token price", submitLabel: "Save prices" });

  const editing = a.items.find((i) => i.id === state.editingItem) ?? null;
  const itemForm = schemaForm({
    id: "admin-item",
    schema: editing ? ITEM_PATCH : ITEM_INPUT,
    values: editing ?? { tokenAmount: 1, isActive: true, priceAud: null, priceUsd: null },
    className: "item-form",
    submitLabel: editing ? "Save item" : "Add item",
    extra: [
      h("p", { class: "hint" }, "Leave a price blank to calculate it as token amount × token price."),
      editing ? h("button", { class: "btn btn-ghost", type: "button", "data-admin-cancel": "", ...agent("btn_admin_cancel_edit") }, "Cancel") : null,
    ],
  });
  itemForm.prepend(h("h4", {}, editing ? `Edit “${editing.title}”` : "New saleable item"));

  const itemsTable = h(
    "table",
    { class: "data-table compact admin-table", role: "table" },
    h("caption", { class: "visually-hidden" }, "Saleable items"),
    headerRow([["", "Item"], ["", "Description"], ["", "Tokens"], ["", "Prices"], ["", "Status"], ["", "Actions"]]),
    h(
      "tbody",
      { role: "rowgroup" },
      a.items.map((i) =>
        h(
          "tr",
          { class: "row", role: "row" },
          td("c-lead", null, h("span", { class: "cell-main" }, i.title), h("span", { class: "cell-sub" }, i.id)),
          td("", "Description", i.description || "—"),
          td("c-ticker", null, h("span", { class: "token" }, icon("i-token", "token-icon"), String(i.tokenAmount))),
          td("", "Prices", `${dollars(i.effective.priceAud, "AUD")}${i.priceAud === null ? " (auto)" : ""} · ${dollars(i.effective.priceUsd, "USD")}${i.priceUsd === null ? " (auto)" : ""}`),
          td("", "Status", i.isActive ? "Active" : "Inactive"),
          td(
            "c-source",
            null,
            h("button", { class: "btn-link", type: "button", "data-admin-edit": i.id, ...agent(`btn_admin_edit_${i.id}`) }, "Edit"),
            i.system ? null : h("button", { class: "btn-link", type: "button", "data-admin-delete": i.id, ...agent(`btn_admin_delete_${i.id}`) }, "Delete"),
          ),
        ),
      ),
    ),
  );

  const selfCredit = schemaForm({
    id: "admin-self-credit",
    schema: SELF_CREDIT_FORM,
    values: { amount: 10 },
    className: "inline-form",
    submitLabel: "Add",
    labels: { amount: `Add tokens to your own wallet (${c.walletLabel ?? "this browser"})` },
  });

  const wallets = h(
    "section",
    { class: "card card-wide" },
    h("h3", { class: "card-title" }, "Wallets"),
    selfCredit,
    h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "data-table compact admin-table", role: "table" },
        h("caption", { class: "visually-hidden" }, "Wallets"),
        headerRow([["", "Wallet"], ["", "Created"], ["", "Balance"], ["", "Unlocked"], ["", "Adjust"]]),
        h(
          "tbody",
          { role: "rowgroup" },
          a.wallets.length
            ? a.wallets.map((w) => {
                const adjust = schemaForm({
                  id: `admin-adjust-${w.label}`,
                  schema: WALLET_ADJUST_REQUEST,
                  only: ["amount"],
                  values: {},
                  className: "inline-form adjust-form",
                  submitLabel: "Apply",
                  labels: { amount: `Tokens for ${w.label} (+/-)` },
                });
                adjust.dataset.walletId = w.id;
                return h(
                  "tr",
                  { class: "row", role: "row" },
                  td("c-lead", null, h("span", { class: "cell-main" }, w.label), w.label === c.walletLabel ? h("span", { class: "cell-sub" }, "this browser") : null),
                  td("", "Created", fmtDateTime(w.createdAt)),
                  td("c-ticker", null, h("span", { class: "token" }, icon("i-token", "token-icon"), String(w.balance))),
                  td("", "Unlocked", String(w.unlocked)),
                  td("", "Adjust", adjust),
                );
              })
            : emptyRow("No wallets yet."),
        ),
      ),
    ),
    a.ledger.length
      ? h(
          "details",
          { class: "ledger" },
          h("summary", { ...agent("btn_toggle_ledger") }, `Recent activity (${a.ledger.length})`),
          h(
            "ul",
            { class: "source-list" },
            a.ledger.map((e) =>
              h("li", {}, `${fmtDateTime(e.at)} · ${e.type} ${e.amount > 0 ? "+" : ""}${e.amount} · wallet ${a.wallets.find((w) => w.id === e.walletId)?.label ?? "?"}${e.itemId ? ` · ${e.itemId}` : ""}${e.note ? ` · ${e.note}` : ""}`),
            ),
          ),
        )
      : null,
  );

  root.replaceChildren(
    h(
      "div",
      { class: "settings-grid" },
      toggles,
      pricing,
      h("section", { class: "card card-wide" }, h("h3", { class: "card-title" }, "Saleable items"), h("div", { class: "table-wrap" }, itemsTable), itemForm),
      wallets,
    ),
  );
}

function bindAdmin() {
  const root = $("#admin-root");
  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const schema = SCHEMA_FORMS.get(form.dataset.schema);
    if (!schema) return;
    const { value, errors } = validateForm(form, schema);
    if (errors.length) return announce(errors[0].message, "error");
    if (form.id === "admin-login") {
      try {
        await api("POST", "/api/admin/login", value);
        state.admin = null;
        state.authError = null;
        await loadCommerce();
        await refreshStatus();
        if (state.report) await loadReport(state.report.id);
        renderAdmin();
        announce("Signed in as superadmin");
      } catch (err) {
        if (err.fields?.length) showErrors(form, err.fields);
        announce(err.message, "error");
      }
    } else if (form.id === "admin-pricing") {
      await adminCall("PUT", "settings", value, { form, message: "Token prices saved" });
    } else if (form.id === "admin-item") {
      const id = state.editingItem;
      const ok = await adminCall(id ? "PUT" : "POST", id ? `items/${encodeURIComponent(id)}` : "items", value, { form, message: id ? "Item saved" : "Item added" });
      if (ok) {
        state.editingItem = null;
        renderAdmin();
      }
    } else if (form.id === "admin-self-credit") {
      await adminCall("POST", "wallets/self/adjust", { ...value, note: "superadmin self-credit" }, { form, message: "Tokens added to your wallet" });
    } else if (form.dataset.walletId) {
      if (value.amount === 0) return showErrors(form, [{ path: "amount", message: "Enter a non-zero number of tokens." }]);
      await adminCall("POST", `wallets/${encodeURIComponent(form.dataset.walletId)}/adjust`, { ...value, note: "superadmin adjustment" }, { form, message: "Wallet updated" });
    }
  });
  root.addEventListener("change", (event) => {
    const form = event.target.form;
    if (form?.id !== "admin-toggles") return;
    const value = readForm(form, COMMERCE_SETTINGS_PATCH);
    adminCall("PUT", "settings", value, { form, message: "Saved" });
  });
  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-admin-edit]");
    if (edit) {
      state.editingItem = edit.dataset.adminEdit;
      renderAdmin();
      $("#admin-item").scrollIntoView({ block: "center" });
      return;
    }
    if (event.target.closest("[data-admin-cancel]")) {
      state.editingItem = null;
      renderAdmin();
      return;
    }
    const del = event.target.closest("[data-admin-delete]");
    if (del && confirm("Delete this item?")) adminCall("DELETE", `items/${encodeURIComponent(del.dataset.adminDelete)}`, {}, { message: "Item deleted" });
    if (event.target.closest("[data-admin-logout]")) {
      api("POST", "/api/admin/logout", {}).then(async () => {
        state.admin = null;
        await loadCommerce();
        await refreshStatus();
        if (state.report) await loadReport(state.report.id);
        renderAdmin();
        announce("Signed out");
      }, (err) => announce(err.message, "error"));
    }
  });
}

// ------------------------------------------------------------------ runs and status

function renderStatus() {
  const s = state.status;
  if (!s) return;
  const runBtn = $("#run-btn");
  runBtn.disabled = s.running || state.runRequestPending || !(s.canManage || s.firstRunAllowed);
  runBtn.title = s.canManage || s.firstRunAllowed ? "" : "Sign in as superadmin to refresh the report";
  runBtn.classList.toggle("is-busy", s.running);
  runBtn.setAttribute("aria-busy", String(s.running));
  $(".btn-text", runBtn).textContent = s.running ? "Running…" : "Refresh";
  runBtn.setAttribute("aria-label", s.running ? "Report running" : "Refresh report");
  const progress = $("#run-progress");
  progress.hidden = !s.running;
  if (s.running) {
    $(".run-progress-fill", progress).style.setProperty("--pct", `${Math.max(2, s.pct)}%`);
    $(".run-progress-track", progress).setAttribute("aria-valuenow", String(s.pct));
    $("#run-progress-label").textContent = `${s.mode === "ai" ? "AI analyst · " : ""}${s.label}`;
    setAgentStatus("busy", `Report running: ${s.label}`);
  }
  const aiBtn = $("#ai-run-btn");
  aiBtn.disabled = s.running || !s.aiConfigured || !s.canManage;
  $("#ai-status").textContent = s.aiConfigured
    ? "Ready: an Anthropic API key was found. AI mode re-checks the standard leads, searches the web for what they miss, and writes the three-section brief."
    : "Off: add ANTHROPIC_API_KEY to the .env file next to package.json and restart the app (see README). Everything else works without it.";
  if (s.storage === "firestore") $("#settings-sub").textContent = "Saved in the cloud (Firestore) and shared by everyone using this app. Changes apply from the next report.";
  if (s.schedule?.kind === "cron") {
    $("#schedule-note").textContent = "Daily report: 6–7 pm Sydney";
    $("#schedule-hint").textContent = `${s.schedule.note} The time setting below applies only when the app runs on your own computer.`;
  } else {
    const next = s.nextScheduled ? `Next scheduled report: ${fmtDateTime(s.nextScheduled)}` : "Daily schedule is off";
    $("#schedule-note").textContent = next;
    $("#schedule-hint").textContent = `${next}. Scheduled runs only happen while this app is running; see the README for Windows Task Scheduler.`;
  }
  applyManageAccess();
}

async function refreshStatus() {
  try {
    state.status = await api("GET", "/api/status");
  } catch {
    return;
  }
  renderStatus();
  if (state.status.running || state.runRequestPending) {
    if (state.status.running) state.wasRunning = true;
    clearTimeout(state.pollTimer);
    state.pollTimer = setTimeout(refreshStatus, 1200);
  } else if (state.wasRunning) {
    state.wasRunning = false;
    await onRunFinished();
  }
}

async function onRunFinished() {
  const s = state.status;
  if (s.error) {
    announce(`Report failed: ${s.error}`, "error");
    renderNotices();
    return;
  }
  await loadReports();
  if (s.lastReportId) await loadReport(s.lastReportId);
  announce("Report updated");
}

async function startRun(mode) {
  // On Vercel the request lasts until the run ends, so progress comes from polling meanwhile.
  state.wasRunning = true;
  state.runRequestPending = true;
  const request = api("POST", "/api/run", { mode });
  renderNotices();
  if (state.status) renderStatus();
  setTimeout(refreshStatus, 800);
  try {
    state.status = await request;
    renderStatus();
    renderNotices();
  } catch (err) {
    announce(err.message, "error");
  } finally {
    state.runRequestPending = false;
    refreshStatus();
  }
}

// ------------------------------------------------------------------ reports

async function loadReports() {
  state.reports = await api("GET", "/api/reports");
  const select = $("#report-select");
  select.disabled = !state.reports.length;
  select.replaceChildren(
    ...(state.reports.length
      ? state.reports.map((r) => h("option", { value: r.id }, `${fmtDate(r.date)} ${r.date.slice(0, 4)} · ${r.mode === "ai" ? "AI" : "Standard"}`))
      : [h("option", {}, "No reports yet")]),
  );
}

async function loadReport(id) {
  try {
    state.report = await api("GET", `/api/reports/${encodeURIComponent(id)}`);
  } catch (err) {
    announce(`Could not load report: ${err.message}`, "error");
    return;
  }
  $("#report-select").value = state.report.id;
  const params = new URLSearchParams(location.search);
  params.set("report", state.report.id);
  history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
  $('[data-action="csv"]').href = `/api/reports/${encodeURIComponent(state.report.id)}/csv`;
  populateFilterOptions();
  render();
}

function populateFilterOptions() {
  const r = state.report;
  const items = r ? [...r.confirmed, ...r.upcoming, ...r.other] : [];
  const fill = (select, values, allLabel) => {
    const current = select.value;
    select.replaceChildren(h("option", { value: "" }, allLabel), ...values.map((v) => h("option", { value: v }, v)));
    select.value = values.includes(current) ? current : "";
  };
  fill($("#f-sector"), SECTORS.filter((s) => items.some((i) => i.sector === s)), "All sectors");
  fill($("#f-jur"), JURISDICTIONS.filter((j) => items.some((i) => (i.jurisdiction ?? "Unknown") === j)), "All governments");
  state.filters.sector = $("#f-sector").value;
  state.filters.jur = $("#f-jur").value;
}

// ------------------------------------------------------------------ small UI pieces

let toastTimer;
/** Visible toast plus the #agent-status live region (errors are mirrored there too). */
function announce(message, kind = "info") {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3200);
  setAgentStatus(kind === "error" ? "error" : "idle", message);
}

function showTooltip(row, x, y) {
  const tip = $("#tooltip");
  if (row.dataset.tip) tip.replaceChildren(...row.dataset.tip.split("\n").map((line) => h("strong", {}, line)));
  else tip.replaceChildren(h("strong", {}, row.dataset.tipValue), row.dataset.tipLabel);
  tip.hidden = false;
  const rect = tip.getBoundingClientRect();
  const left = Math.min(Math.max(8, x + 12), window.innerWidth - rect.width - 8);
  const top = y - rect.height - 12 < 8 ? y + 16 : y - rect.height - 12;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function applyThemeLabel() {
  const dark = (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  $("#theme-btn").setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  return dark;
}

function toggleTheme() {
  const next = applyThemeLabel() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // storage unavailable: theme lasts for this page view
  }
  applyThemeLabel();
}

async function copyMarkdown() {
  if (!state.report) return;
  try {
    const text = await api("GET", `/api/reports/${encodeURIComponent(state.report.id)}/markdown`);
    await navigator.clipboard.writeText(text);
    announce("Brief copied as Markdown");
  } catch {
    announce("Copy failed; use the CSV download instead", "error");
  }
}

// ------------------------------------------------------------------ events

function bindEvents() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      event.preventDefault();
      navigate(nav.dataset.nav);
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) return openDetail(open.dataset.open);
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      state.sort = sort.dataset.sort;
      renderConfirmed();
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      saveSettings({ watchlist: state.settings.watchlist.filter((c) => c !== remove.dataset.remove) }, { message: `${remove.dataset.remove} removed from watchlist` });
      return;
    }
    if (event.target.closest('[data-action="copy-md"]')) copyMarkdown();
    if (event.target.closest("[data-close]")) $("#detail").close();
    const unlock = event.target.closest("[data-unlock]");
    if (unlock) {
      if ($("#detail").open) $("#detail").close();
      return openUnlock(unlock.dataset.unlock);
    }
    const confirmBtn = event.target.closest("[data-confirm-unlock]");
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.setAttribute("aria-busy", "true");
      return confirmUnlock(confirmBtn.dataset.confirmUnlock);
    }
    if (event.target.closest("[data-open-wallet]")) return openWallet();
    if (event.target.closest("[data-close-token]")) $("#token-dialog").close();
  });

  for (const id of ["#detail", "#token-dialog"]) {
    $(id).addEventListener("click", (event) => {
      if (event.target === event.currentTarget) event.currentTarget.close(); // backdrop click
    });
  }
  $("#wallet-btn").addEventListener("click", openWallet);

  // Dollar equivalents of token amounts: hover or keyboard focus only.
  document.addEventListener("pointerover", (event) => {
    const el = event.target.closest?.(".token[data-tip]");
    if (el) showTooltip(el, event.clientX, event.clientY);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.(".token[data-tip]")) $("#tooltip").hidden = true;
  });
  document.addEventListener("focusin", (event) => {
    const el = event.target.closest?.(".token[data-tip]");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    showTooltip(el, rect.left + rect.width / 2, rect.top);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.(".token[data-tip]")) $("#tooltip").hidden = true;
  });
  bindAdmin();
  bindSettingsForms();

  $("#run-btn").addEventListener("click", () => startRun("standard"));
  $("#ai-run-btn").addEventListener("click", () => {
    const ok = confirm("Run the AI analyst now? It calls Claude Opus 5.5 with web search and is billed to your Anthropic account.");
    if (ok) startRun("ai");
  });
  $("#theme-btn").addEventListener("click", toggleTheme);
  $("#report-select").addEventListener("change", (event) => loadReport(event.target.value));

  let searchTimer;
  $("#f-search").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.q = event.target.value.trim();
      render();
    }, 150);
  });
  for (const [id, key] of [["#f-sector", "sector"], ["#f-jur", "jur"], ["#f-source", "source"]]) {
    $(id).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      render();
    });
  }
  $(".seg").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-scope]");
    if (!btn) return;
    state.filters.scope = btn.dataset.scope;
    for (const b of $$(".seg [data-scope]")) b.setAttribute("aria-checked", String(b === btn));
    render();
  });
  $(".seg").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const buttons = $$(".seg [data-scope]");
    const i = buttons.indexOf(document.activeElement);
    const next = buttons[(i + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
    next.focus();
    next.click();
  });
  $("#filters-toggle").addEventListener("click", (event) => {
    const open = $("#filters").classList.toggle("is-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  $("#f-clear").addEventListener("click", () => {
    Object.assign(state.filters, { q: "", scope: "all", sector: "", jur: "", source: "" });
    $("#f-search").value = "";
    for (const id of ["#f-sector", "#f-jur", "#f-source"]) $(id).value = "";
    for (const b of $$(".seg [data-scope]")) b.setAttribute("aria-checked", String(b.dataset.scope === "all"));
    render();
  });

  const bars = $("#sector-bars");
  bars.addEventListener("pointermove", (event) => {
    const row = event.target.closest(".bar-row");
    if (row) showTooltip(row, event.clientX, event.clientY);
    else $("#tooltip").hidden = true;
  });
  bars.addEventListener("pointerleave", () => ($("#tooltip").hidden = true));
  bars.addEventListener("focusin", (event) => {
    const row = event.target.closest(".bar-row");
    if (!row) return;
    const rect = row.getBoundingClientRect();
    showTooltip(row, rect.left + rect.width / 2, rect.top);
  });
  bars.addEventListener("focusout", () => ($("#tooltip").hidden = true));

  window.addEventListener("hashchange", () => setView(location.hash.slice(1)));
  desktop.addEventListener("change", () => setView(state.view, { scroll: false }));

  // Keep sticky offsets in step with the app bar, whose height changes as it wraps.
  const appbar = $("#appbar");
  new ResizeObserver(() => document.documentElement.style.setProperty("--appbar-h", `${appbar.offsetHeight}px`)).observe(appbar);
}

// ------------------------------------------------------------------ start

async function init() {
  applyThemeLabel();
  // Google sign-in returns here with ?auth_error= when it fails; show it once, then tidy the URL.
  const params = new URLSearchParams(location.search);
  if (params.has("auth_error")) {
    state.authError = params.get("auth_error").slice(0, 300);
    params.delete("auth_error");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  }
  bindEvents();
  setView(location.hash.slice(1) || "overview", { scroll: false });
  await track(
    (async () => {
      try {
        // First, so the wallet cookie exists before the report request needs it.
        await loadCommerce();
        if (state.view === "admin") renderAdmin();
        const [status, settings] = await Promise.all([api("GET", "/api/status"), api("GET", "/api/settings")]);
        state.status = status;
        state.settings = settings;
        renderStatus();
        renderSettings();
        await loadReports();
        const wanted = new URLSearchParams(location.search).get("report");
        const id = state.reports.find((r) => r.id === wanted)?.id ?? state.reports[0]?.id;
        if (id) await loadReport(id);
        else render();
        if (status.running) {
          state.wasRunning = true;
          refreshStatus();
        } else if (!id && status.firstRunAllowed) {
          // A brand-new deployment: build the first report straight away.
          startRun("standard");
        }
        setAgentStatus(status.running ? "busy" : "idle", status.running ? "Report running" : "Ready");
      } catch (err) {
        render();
        $("#notices").replaceChildren(notice("error", "i-alert", `Cannot reach the MY ASX Options server (${err.message}). Start it with "npm start".`));
        setAgentStatus("error", err.message);
      }
    })(),
  );
}

init();
