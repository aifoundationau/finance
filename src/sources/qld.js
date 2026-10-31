import { fetchJson } from "../lib/http.js";
import { parseMoney } from "../lib/text.js";

// Queensland Government contract disclosure via CKAN Action API on data.qld.gov.au
const BASE = "https://www.data.qld.gov.au/api/3/action";

/**
 * Searches Queensland Open Data for recently updated contract disclosure datasets
 * and retrieves contract award records.
 */
export async function fetchQueenslandContracts({ since, limit = 50 } = {}) {
  const token = process.env.QLD_API_KEY;
  const headers = token ? { Authorization: token } : {};

  try {
    const searchUrl = `${BASE}/package_search?q=contract+disclosure&sort=metadata_modified+desc&rows=10`;
    const searchRes = await fetchJson(searchUrl, { headers, timeout: 20_000 });
    if (!searchRes?.success || !searchRes.result?.results) return [];

    const packages = searchRes.result.results;
    const items = [];

    for (const pkg of packages) {
      // Find active datastore resources (CSV/XLSX loaded into datastore)
      const datastoreRes = pkg.resources?.find((r) => r.datastore_active);
      if (!datastoreRes?.id) continue;

      try {
        const dataUrl = `${BASE}/datastore_search?resource_id=${encodeURIComponent(datastoreRes.id)}&limit=${limit}`;
        const dataRes = await fetchJson(dataUrl, { headers, timeout: 20_000 });
        const records = dataRes?.result?.records ?? [];

        for (const row of records) {
          const supplier = (row["Supplier name"] || row["Supplier"] || row["Contractor"] || "").trim();
          const description = (row["Description"] || row["Contract description/name"] || row["Title"] || "").trim();
          const agency = (row["Agency (Dept or Stat Body)"] || row["Agency"] || pkg.organization?.title || "Queensland Government").trim();
          const dateStr = row["Award contract date"] || row["Contract award date"] || row["Date Awarded"];
          const rawVal = row["Contract value"] || row["Value"] || row["Total contract value"];
          const valObj = rawVal ? parseMoney(String(rawVal)) : null;

          if (!supplier || !description) continue;

          // Filter by date if valid date is present and `since` is supplied
          if (since && dateStr) {
            const parsed = Date.parse(dateStr);
            if (!Number.isNaN(parsed) && parsed < since.getTime()) continue;
          }

          items.push({
            id: `qld-${row._id || Math.random().toString(36).slice(2)}`,
            jurisdiction: "QLD",
            agency,
            supplier,
            description,
            value: valObj?.amount ?? null,
            currency: "AUD",
            date: dateStr ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10),
            url: `https://www.data.qld.gov.au/dataset/${pkg.name || pkg.id}`,
            datasetTitle: pkg.title,
            sourceType: "state-portal",
          });
        }
      } catch (err) {
        // Individual dataset fetch error, continue to next
      }
    }

    return items;
  } catch (err) {
    return [];
  }
}

