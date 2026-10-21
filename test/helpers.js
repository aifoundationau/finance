import { EntityResolver } from "../src/lib/entities.js";

// A small slice of the ASX list, with names exactly as the ASX publishes them.
export const COMPANIES = [
  { code: "TNE", name: "TECHNOLOGY ONE LIMITED", industry: "Software & Services", marketCap: 10e9 },
  { code: "ASB", name: "AUSTAL LIMITED", industry: "Capital Goods", marketCap: 1.5e9 },
  { code: "APZ", name: "ASPEN GROUP LIMITED", industry: "Real Estate", marketCap: 8e8 },
  { code: "MND", name: "MONADELPHOUS GROUP LIMITED", industry: "Capital Goods", marketCap: 2e9 },
  { code: "DOW", name: "DOWNER EDI LIMITED", industry: "Commercial & Professional Services", marketCap: 4e9 },
  { code: "EXT", name: "EXCITE TECHNOLOGY SERVICES LTD", industry: "Software & Services", marketCap: 1e7 },
  { code: "VNT", name: "VENTIA SERVICES GROUP LIMITED", industry: "Capital Goods", marketCap: 5e9 },
  { code: "NEC", name: "NINE ENTERTAINMENT CO. HOLDINGS LIMITED", industry: "Media & Entertainment", marketCap: 2e9 },
  { code: "TLS", name: "TELSTRA GROUP LIMITED", industry: "Telecommunication Services", marketCap: 5e10 },
  { code: "PME", name: "PRO MEDICUS LIMITED", industry: "Health Care Equipment & Services", marketCap: 1.9e10 },
  { code: "DRO", name: "DRONESHIELD LIMITED", industry: "Capital Goods", marketCap: 2e9 },
  { code: "ASX", name: "ASX LIMITED", industry: "Financial Services", marketCap: 1.2e10 },
  { code: "CDA", name: "CODAN LIMITED", industry: "Technology Hardware & Equipment", marketCap: 3e9 },
  { code: "VGN", name: "VIRGIN AUSTRALIA HOLDINGS LIMITED.", industry: "Transportation", marketCap: 3e9 },
];

export const resolver = () => new EntityResolver(COMPANIES);

export const NOW = new Date("2026-10-21T08:00:00Z");
export const SETTINGS = {
  includeLocalGovernment: false,
  sources: { readAnnouncementPdfs: true },
  thresholds: { austenderAsxMin: 100_000, austenderOverseasMin: 1_000_000, austenderMajorMin: 20_000_000 },
};
