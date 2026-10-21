import { fetchJson } from "../lib/http.js";
import { unspscInfo } from "../data/unspsc.js";

// AusTender's Open Contracting Data Standard API (Department of Finance), CC BY 3.0 AU.
const API = "https://api.tenders.gov.au/ocds";
const isoZ = (d) => `${d.toISOString().slice(0, 19)}Z`;

// The public notice page id is the hex suffix of the OCDS award id, formatted as a GUID.
function noticeGuid(awardId = "") {
  const hex = (awardId.split("-").pop() ?? "").toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
}

export function normalizeRelease(r) {
  const contract = r.contracts?.[0];
  if (!contract?.id) return null;
  const parties = r.parties ?? [];
  const withRole = (role) => parties.filter((p) => (p.roles ?? []).includes(role));
  const award = r.awards?.find((a) => a.id === contract.awardID) ?? r.awards?.[0];
  const guid = noticeGuid(award?.id ?? contract.awardID);
  const unspsc = contract.items?.[0]?.classification?.id ?? null;
  const category = unspscInfo(unspsc);
  const amount = Number(contract.value?.amount);
  // An amendment repeats the notice id; its own id (e.g. CN4283814-A1) keeps it distinct, and its
  // value is the amendment amount rather than a new total.
  const amendment = (r.tag ?? []).includes("contractAmendment");
  return {
    cnId: amendment ? contract.amendments?.at(-1)?.id ?? `${contract.id}-A` : contract.id,
    url: guid
      ? `https://www.tenders.gov.au/Cn/Show/${guid}`
      : `https://www.tenders.gov.au/Search/CnAdvancedSearch?CnId=${encodeURIComponent(contract.id)}`,
    published: r.date,
    description: (contract.description || contract.title || "").trim(),
    unspsc,
    category: category.label,
    sector: category.sector,
    value: Number.isFinite(amount) ? amount : null,
    currency: contract.value?.currency ?? "AUD",
    start: contract.period?.startDate ?? null,
    end: contract.period?.endDate ?? null,
    method: r.tender?.procurementMethodDetails ?? r.tender?.procurementMethod ?? null,
    amendment,
    agency: withRole("procuringEntity")[0]?.name?.trim() || "Unknown agency",
    suppliers: withRole("supplier").map((p) => ({
      name: p.name?.trim() ?? "",
      abn: p.additionalIdentifiers?.find((i) => i.scheme === "AU-ABN")?.id ?? null,
      region: p.address?.region ?? null,
      country: p.address?.countryName ?? null,
    })),
  };
}

/** Contract notices published in [from, to], following the API's cursor pagination. */
export async function fetchContractNotices({ from, to, maxPages = 80, onPage } = {}) {
  let url = `${API}/findByDates/contractPublished/${isoZ(from)}/${isoZ(to)}`;
  const byId = new Map();
  for (let page = 0; url && page < maxPages; page++) {
    const data = await fetchJson(url, { timeout: 30_000 });
    const releases = data.releases ?? [];
    for (const r of releases) {
      const cn = normalizeRelease(r);
      if (!cn) continue;
      const prev = byId.get(cn.cnId);
      if (!prev || cn.published > prev.published) byId.set(cn.cnId, cn);
    }
    onPage?.(page + 1, byId.size);
    url = releases.length && data.links?.next && data.links.next !== url ? data.links.next : null;
  }
  return [...byId.values()];
}
