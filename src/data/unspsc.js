// UNSPSC segment (first two digits of an AusTender category code) -> label and sector.
const S = (label, sector) => ({ label, sector });

export const UNSPSC_SEGMENTS = {
  10: S("Live plant and animal material", "Other"),
  11: S("Mineral and textile materials", "Other"),
  12: S("Chemicals", "Other"),
  13: S("Resin, rubber and elastomers", "Other"),
  14: S("Paper materials and products", "Other"),
  15: S("Fuels and lubricants", "Energy"),
  20: S("Mining and well drilling machinery", "Other"),
  21: S("Farming and forestry machinery", "Other"),
  22: S("Building and construction machinery", "Infrastructure"),
  23: S("Industrial manufacturing machinery", "Other"),
  24: S("Material handling machinery", "Other"),
  25: S("Commercial, military and private vehicles", "Transport"),
  26: S("Power generation and distribution machinery", "Energy"),
  27: S("Tools and general machinery", "Other"),
  30: S("Structures and building components", "Infrastructure"),
  31: S("Manufacturing components", "Other"),
  32: S("Electronic components", "Cyber/IT"),
  39: S("Electrical systems and lighting", "Infrastructure"),
  40: S("Distribution and conditioning systems", "Infrastructure"),
  41: S("Laboratory and measuring equipment", "Other"),
  42: S("Medical equipment and supplies", "Health"),
  43: S("IT, broadcasting and telecommunications", "Cyber/IT"),
  44: S("Office equipment and supplies", "Other"),
  45: S("Printing and photographic equipment", "Other"),
  46: S("Defence, law enforcement and security equipment", "Defence"),
  47: S("Cleaning equipment and supplies", "Services"),
  48: S("Service industry machinery", "Other"),
  49: S("Sports and recreational equipment", "Other"),
  50: S("Food and beverage products", "Other"),
  51: S("Drugs and pharmaceuticals", "Health"),
  52: S("Domestic appliances", "Other"),
  53: S("Apparel and luggage", "Other"),
  55: S("Published products", "Other"),
  56: S("Furniture and furnishings", "Other"),
  60: S("Musical instruments, games and educational supplies", "Other"),
  70: S("Farming and fishing services", "Services"),
  71: S("Mining and oil and gas services", "Energy"),
  72: S("Building and construction services", "Infrastructure"),
  73: S("Industrial production services", "Services"),
  76: S("Industrial cleaning services", "Services"),
  77: S("Environmental services", "Services"),
  78: S("Transportation, storage and mail services", "Transport"),
  80: S("Management and business professional services", "Services"),
  81: S("Engineering, research and technology services", "Services"),
  82: S("Editorial, design and graphic services", "Services"),
  83: S("Public utilities and related services", "Energy"),
  84: S("Financial and insurance services", "Services"),
  85: S("Healthcare services", "Health"),
  86: S("Education and training services", "Services"),
  90: S("Travel, food and lodging services", "Services"),
  91: S("Personal and domestic services", "Services"),
  92: S("National defence, public order and security services", "Defence"),
  93: S("Politics and civic affairs services", "Services"),
  94: S("Organisations and clubs", "Other"),
  95: S("Land, buildings and structures", "Infrastructure"),
};

// Families that belong to a different sector than their segment.
const FAMILY_SECTOR = { 8111: "Cyber/IT", 8116: "Cyber/IT", 8112: "Services", 7210: "Infrastructure" };

export function unspscInfo(code) {
  const c = String(code ?? "");
  const seg = UNSPSC_SEGMENTS[c.slice(0, 2)];
  if (!seg) return { label: "Uncategorised", sector: "Other" };
  return { label: seg.label, sector: FAMILY_SECTOR[c.slice(0, 4)] ?? seg.sector };
}
