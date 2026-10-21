import { getDocumentProxy } from "unpdf";
import { squash } from "./text.js";

/** Plain text of the first pages of a PDF (ASX announcements put the substance up front). */
export async function pdfText(bytes, { maxPages = 2, maxChars = 8_000 } = {}) {
  const pdf = await getDocumentProxy(bytes, { verbosity: 0 });
  try {
    let text = "";
    for (let i = 1; i <= Math.min(pdf.numPages, maxPages) && text.length < maxChars; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      text += `${content.items.map((it) => it.str ?? "").join(" ")}\n`;
    }
    return squash(text).slice(0, maxChars);
  } finally {
    await (pdf.destroy?.() ?? pdf.loadingTask?.destroy?.());
  }
}
