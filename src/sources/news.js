import { fetchText, mapLimit } from "../lib/http.js";
import { parseFeed } from "../lib/rss.js";
import { truncate } from "../lib/text.js";

// Google News search RSS (Australian edition) covers paywalled and syndicated outlets such as
// the AFR, The Australian and Defence Connect; direct feeds add summaries where available.
export const GOOGLE_QUERIES = [
  '"awarded" contract "Australian Government" when:7d',
  '"Department of Defence" contract awarded when:7d',
  'Defence contract Australia awarded OR signs OR secures when:7d',
  '"Commonwealth" contract signed Australia when:7d',
  'ASX "government contract" when:7d',
  'ASX secures contract Defence OR government when:7d',
  '"NSW Government" contract awarded when:7d',
  '"Victorian Government" contract awarded when:7d',
  '"Queensland Government" contract awarded when:7d',
  '"WA Government" OR "Western Australian Government" contract when:7d',
  '"South Australian Government" OR "SA Government" contract when:7d',
  '"Tasmanian Government" OR "ACT Government" OR "Northern Territory Government" contract when:7d',
  'site:defenceconnect.com.au when:7d',
  'site:itnews.com.au contract OR tender OR awarded when:7d',
  'site:innovationaus.com contract OR tender when:7d',
  'site:afr.com government contract when:7d',
  'site:theaustralian.com.au government contract when:7d',
  'site:marketindex.com.au contract when:7d',
  '"Services Australia" OR "Home Affairs" OR "Australian Taxation Office" contract when:7d',
  '"preferred tenderer" OR "preferred bidder" OR "preferred proponent" Australia when:7d',
  'shortlisted tender Australia government when:7d',
  '"request for tender" OR "expressions of interest" government Australia when:7d',
  'Defence tender shortlist OR preferred Australia when:7d',
  '"contract expected" OR "expected to be awarded" OR "decision expected" government Australia when:7d',
];

export const FEEDS = [
  { name: "iTnews", url: "https://www.itnews.com.au/RSS/rss.ashx" },
  { name: "InnovationAus", url: "https://www.innovationaus.com/feed/" },
  { name: "Government News", url: "https://www.governmentnews.com.au/feed/" },
  { name: "Asia Pacific Defence Reporter", url: "https://asiapacificdefencereporter.com/feed/" },
  { name: "Stockhead", url: "https://stockhead.com.au/feed/" },
  { name: "The Market Online", url: "https://themarketonline.com.au/feed/" },
  { name: "Business News (WA)", url: "https://www.businessnews.com.au/rssfeed/latest.rss" },
  { name: "ABC News Business", url: "https://www.abc.net.au/news/feed/51892/rss.xml" },
  { name: "SMH Business", url: "https://www.smh.com.au/rss/business.xml" },
];

const googleUrl = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`;

function fromGoogle(item, query) {
  let title = item.title;
  let publisher = item.source?.name ?? "";
  const cut = title.lastIndexOf(" - ");
  if (cut > 20) {
    publisher ||= title.slice(cut + 3).trim();
    title = title.slice(0, cut).trim();
  }
  return { title, link: item.link, date: item.date, summary: "", publisher: publisher || "Google News", publisherUrl: item.source?.url ?? "", via: "google", query };
}

function fromFeed(item, feed) {
  return { title: item.title, link: item.link, date: item.date, summary: truncate(item.description, 600), publisher: feed.name, publisherUrl: new URL(feed.url).origin, via: "feed", query: null };
}

/** Recent news items from every query and feed, with exact duplicates removed. */
export async function fetchNews({ since, onProgress } = {}) {
  const items = [];
  const errors = [];
  let done = 0;
  const total = GOOGLE_QUERIES.length + FEEDS.length;
  await mapLimit(GOOGLE_QUERIES, 3, async (q) => {
    try {
      for (const it of parseFeed(await fetchText(googleUrl(q), { retries: 1 }))) items.push(fromGoogle(it, q));
    } catch (err) {
      errors.push(`Google News [${q}]: ${err.message}`);
    }
    onProgress?.(++done, total);
  });
  await mapLimit(FEEDS, 4, async (feed) => {
    try {
      for (const it of parseFeed(await fetchText(feed.url, { retries: 1 }))) items.push(fromFeed(it, feed));
    } catch (err) {
      errors.push(`${feed.name}: ${err.message}`);
    }
    onProgress?.(++done, total);
  });

  const latest = Date.now() + 86_400_000;
  const seen = new Set();
  const unique = items.filter((i) => {
    const t = Date.parse(i.date);
    if (!(t >= since.getTime() && t <= latest)) return false;
    const key = `${i.title.toLowerCase()}|${i.publisher.toLowerCase()}`;
    if (seen.has(key) || seen.has(i.link)) return false;
    seen.add(key);
    seen.add(i.link);
    return true;
  });
  return { items: unique, errors, queries: GOOGLE_QUERIES.length, feeds: FEEDS.length };
}
