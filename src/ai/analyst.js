import Anthropic from "@anthropic-ai/sdk";
import { ANALYST_BRIEF, REPORT_SCHEMA, researchPrompt, structurePrompt } from "./prompt.js";
import { tickerLabel } from "../lib/entities.js";
import { contractStatus, hostOf } from "../lib/classify.js";
import { addDays, sydneyDate } from "../lib/dates.js";
import { displayName, formatMoney, shortHash } from "../lib/text.js";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
// Server-side fallback: if the model declines, the API re-runs the request on a fallback model.
const BETAS = ["server-side-fallback-2026-07-01"];
const MAX_CONTINUATIONS = 5;
// Claude Opus 5.5 list prices (USD per token) plus web search (USD per search), for the in-app estimate.
const PRICE = { input: 4e-6, cacheWrite: 5e-6, cacheRead: 0.2e-6, output: 20e-6, search: 0.01 };

const blankUsage = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 });

function addUsage(total, u = {}) {
  total.input += u.input_tokens ?? 0;
  total.output += u.output_tokens ?? 0;
  total.cacheRead += u.cache_read_input_tokens ?? 0;
  total.cacheWrite += u.cache_creation_input_tokens ?? 0;
  total.searches += u.server_tool_use?.web_search_requests ?? 0;
}

const estimateCost = (u) =>
  u.input * PRICE.input + u.cacheWrite * PRICE.cacheWrite + u.cacheRead * PRICE.cacheRead + u.output * PRICE.output + u.searches * PRICE.search;

function leadsFrom(standard) {
  const pick = (i) => ({
    date: i.date,
    window: i.window?.label,
    companies: i.companies.map((c) => `${c.display} [${tickerLabel(c)}]`),
    agency: i.agency,
    value: i.value?.text,
    headline: i.title,
    stage: i.stage,
    sources: i.sources.slice(0, 2).map((s) => ({ title: s.title, url: s.url })),
  });
  return {
    confirmed: standard.confirmed.slice(0, 40).map(pick),
    upcoming: standard.upcoming.slice(0, 25).map(pick),
  };
}

function collectCitations(contents) {
  const seen = new Map();
  const add = (url, title) => {
    if (url && !seen.has(url)) seen.set(url, { url, title: title ?? null });
  };
  for (const content of contents) {
    for (const block of content) {
      if (block.type === "text") for (const c of block.citations ?? []) add(c.url, c.title);
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) for (const r of block.content) add(r.url, r.title);
    }
  }
  return [...seen.values()];
}

const textOf = (content) => content.filter((b) => b.type === "text").map((b) => b.text).join("");

async function research(client, { prompt, settings, onProgress }) {
  const messages = [{ role: "user", content: prompt }];
  const usage = blankUsage();
  const contents = [];
  let message;
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64_000,
      betas: BETAS,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: settings.ai.effort },
      system: ANALYST_BRIEF,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: Math.max(1, settings.ai.maxSearches - usage.searches),
          user_location: { type: "approximate", country: "AU", timezone: "Australia/Sydney" },
        },
      ],
      messages,
    });
    message = await stream.finalMessage();
    addUsage(usage, message.usage);
    contents.push(message.content);
    if (message.stop_reason !== "pause_turn") break;
    // The server paused its search loop; send the turn back unchanged and it resumes.
    messages.push({ role: "assistant", content: message.content });
    onProgress?.({ label: `AI analyst: still researching (${usage.searches} searches so far)`, pct: 93 });
  }
  if (message.stop_reason === "refusal") {
    throw new Error(`The model declined the research request${message.stop_details?.category ? ` (${message.stop_details.category})` : ""}.`);
  }
  if (message.stop_reason === "pause_turn") throw new Error("AI research did not finish within the continuation limit.");
  const markdown = textOf(message.content).trim() || contents.map(textOf).join("\n").trim();
  if (!markdown) throw new Error("The AI analyst returned no report text.");
  return { markdown, citations: collectCitations(contents), usage };
}

async function structure(client, { markdown, citations }) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16_000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: REPORT_SCHEMA } },
    messages: [{ role: "user", content: structurePrompt({ markdown, citations }) }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to structure the report.");
  if (response.stop_reason === "max_tokens") throw new Error("The structured report was cut off (max_tokens).");
  return { data: JSON.parse(textOf(response.content)), usage: response.usage };
}

const TICKER_RE = /^\s*([A-Za-z]{2,6})\s*:\s*([A-Za-z0-9.\-]{1,10})\s*$/;
const isNamed = (s) => Boolean(s) && !/^(?:not named|n\/a|none|unknown|tbc|tba|various|multiple|undisclosed|-|—)$/i.test(String(s).trim());
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? "") ? u : null);

/** Trust the live ASX list over the model for ASX tickers; keep its overseas/private labels otherwise. */
function resolveCompany({ company, ticker, listing }, resolver) {
  const name = String(company ?? "").trim();
  const m = TICKER_RE.exec(ticker ?? "");
  const exchange = m?.[1].toUpperCase();
  const byName = resolver.resolveName(name);
  if (exchange === "ASX") {
    const code = m[2].toUpperCase();
    // A real but wrong code (another company's) loses to a confident name match.
    if (byName.listing === "ASX" && byName.code !== code) return { ...byName, match: "ai", note: `AI gave ${ticker.trim()}; matched by name instead` };
    const c = resolver.byCode.get(code);
    if (c) return { ...resolver.fromCompany(c, "ai"), name };
  }
  if (byName.listing !== "Unverified") return { ...byName, match: "ai" };
  if (m && exchange !== "ASX") return { name, display: displayName(name), listing: "Overseas", exchange, code: m[2].toUpperCase(), match: "ai" };
  if (listing === "Private" || listing === "Government-owned") return { name, display: displayName(name), listing, exchange: null, code: null, match: "ai" };
  return { ...byName, match: "ai", ...(exchange === "ASX" ? { note: `AI suggested ${ticker.trim()}, which is not on the current ASX list` } : {}) };
}

function aiValue(row) {
  if (Number.isFinite(row.value_aud) && row.value_aud > 0) return { amount: row.value_aud, currency: "AUD", text: formatMoney(row.value_aud) };
  return isNamed(row.value_text) ? { amount: null, currency: null, text: row.value_text } : null;
}

function aiSource(row, date) {
  const url = safeUrl(row.source_url);
  return url ? [{ type: "ai", title: row.source_title || url, url, publisher: hostOf(url), date }] : [];
}

function confirmedItem(row, resolver, today) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : today;
  return {
    id: `ai-${shortHash(`${row.company}|${row.agency}|${row.scope}`)}`,
    kind: "confirmed",
    date,
    title: row.source_title || row.scope,
    companies: isNamed(row.company) ? [resolveCompany(row, resolver)] : [],
    agency: row.agency || null,
    jurisdiction: row.jurisdiction === "Unknown" ? null : row.jurisdiction,
    value: aiValue(row),
    scope: row.scope,
    sector: row.sector,
    status: "confirmed",
    stage: contractStatus(row.scope).stage === "extension" ? "extension" : "awarded",
    sources: aiSource(row, date),
    confidence: "medium",
    flags: [],
  };
}

function upcomingItem(row, resolver, today) {
  const due = /\b(\d{4}-\d{2}-\d{2})\b/.exec(row.window ?? "")?.[1];
  return {
    id: `ai-${shortHash(`${row.project}|${row.procuring_body}`)}`,
    kind: "upcoming",
    date: today,
    title: row.project,
    companies: (row.vendors ?? []).filter((v) => isNamed(v.company)).map((v) => resolveCompany(v, resolver)),
    agency: row.procuring_body || null,
    jurisdiction: row.jurisdiction === "Unknown" ? null : row.jurisdiction,
    value: aiValue(row),
    scope: row.project,
    sector: row.sector,
    status: "forward",
    stage: contractStatus(`${row.context} ${row.project}`).stage ?? "speculation",
    window: { label: row.window || "Next 7 days", from: today, to: due && due >= today ? due : addDays(today, 7) },
    context: row.context,
    sources: aiSource(row, today),
    confidence: "medium",
    flags: [],
  };
}

/** The structured AI output as report items, with tickers re-checked against the ASX list. */
export function itemsFromStructured(data, resolver, today) {
  return {
    confirmed: (data.confirmed ?? []).map((row) => confirmedItem(row, resolver, today)),
    upcoming: (data.upcoming ?? []).map((row) => upcomingItem(row, resolver, today)),
    takeaways: (data.takeaways ?? []).slice(0, 3),
  };
}

function describeApiError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new Error("The Anthropic API key was rejected (401). Check ANTHROPIC_API_KEY in .env.");
  if (err instanceof Anthropic.PermissionDeniedError) return new Error(`This API key cannot use ${MODEL} or web search (403).`);
  if (err instanceof Anthropic.RateLimitError) return new Error("Anthropic API rate limit reached (429). Try again shortly.");
  if (err instanceof Anthropic.BadRequestError) return new Error(`The Anthropic API rejected the request (400): ${err.message}`);
  if (err instanceof Anthropic.APIConnectionError) return new Error(`Could not reach the Anthropic API: ${err.message}`);
  if (err instanceof Anthropic.APIError) return new Error(`Anthropic API error ${err.status ?? ""}: ${err.message}`);
  return err;
}

/** Runs the analyst brief with web search, seeded with the standard report's leads. */
export async function runAiAnalyst({ standard, resolver, settings, now = new Date(), onProgress }) {
  const client = new Anthropic({ timeout: 20 * 60_000, maxRetries: 3 }); // SDK applies its own backoff with jitter
  const today = sydneyDate(now);
  const weekday = now.toLocaleDateString("en-AU", { weekday: "long", timeZone: "Australia/Sydney" });
  try {
    const found = await research(client, {
      prompt: researchPrompt({ today, weekday, window: standard.window, leads: leadsFrom(standard) }),
      settings,
      onProgress,
    });
    onProgress?.({ label: "AI analyst: structuring the report", pct: 95 });
    const { data, usage } = await structure(client, found);
    addUsage(found.usage, usage);
    return {
      model: MODEL,
      markdown: found.markdown,
      citations: found.citations.slice(0, 200),
      usage: found.usage,
      costUsd: estimateCost(found.usage),
      ...itemsFromStructured(data, resolver, today),
    };
  } catch (err) {
    throw describeApiError(err);
  }
}
