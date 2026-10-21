import { cleanText, decodeEntities, squash } from "./text.js";

const unCdata = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? unCdata(m[1]).trim() : "";
}

function attr(block, name, attrName) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${attrName}="([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

/** Minimal RSS 2.0 / Atom parser: enough for news feeds, no external dependency. */
export function parseFeed(xml = "") {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const [open, close] = isAtom ? [/<entry[\s>]/i, /<\/entry>/i] : [/<item[\s>]/i, /<\/item>/i];
  return xml
    .split(open)
    .slice(1)
    .map((chunk) => {
      const raw = chunk.split(close)[0];
      const link = (isAtom ? attr(raw, "link", "href") : decodeEntities(tag(raw, "link"))) || decodeEntities(tag(raw, "guid"));
      const dateStr = tag(raw, "pubDate") || tag(raw, "published") || tag(raw, "updated") || tag(raw, "dc:date");
      const date = dateStr ? new Date(dateStr) : null;
      const sourceName = cleanText(tag(raw, "source"));
      return {
        title: cleanText(tag(raw, "title")),
        link: squash(link),
        date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
        description: cleanText(tag(raw, "description") || tag(raw, "summary") || tag(raw, "content")),
        source: sourceName ? { name: sourceName, url: attr(raw, "source", "url") } : null,
        categories: [...raw.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => cleanText(unCdata(m[1]))),
      };
    })
    .filter((item) => item.title);
}
