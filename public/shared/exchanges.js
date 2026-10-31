// 88 active global stock markets, market identifier codes, and Google stock search helpers.

export const GLOBAL_EXCHANGES = [
  { name: "Abu Dhabi Securities Exchange", code: "ADX", country: "AE", yahoo: ".AD" },
  { name: "Amman Stock Exchange", code: "ASE", country: "JO", yahoo: ".AM" },
  { name: "Aquis Exchange", code: "AQU", country: "GB", yahoo: ".AQ" },
  { name: "Athens Stock Exchange", code: "ATH", country: "GR", yahoo: ".AT" },
  { name: "Australian Securities Exchange", code: "ASX", country: "AU", yahoo: ".AX" },
  { name: "B3 Brazil Stock Exchange", code: "BVMF", alt: ["B3"], country: "BR", yahoo: ".SA" },
  { name: "Bombay Stock Exchange", code: "BOM", alt: ["BSE"], country: "IN", yahoo: ".BO" },
  { name: "Borsa Italiana", code: "BIT", country: "IT", yahoo: ".MI" },
  { name: "Bucharest Stock Exchange", code: "BVB", country: "RO", yahoo: ".RO" },
  { name: "Budapest Stock Exchange", code: "BUD", country: "HU", yahoo: ".BD" },
  { name: "Buenos Aires Stock Exchange", code: "BCBA", country: "AR", yahoo: ".BA" },
  { name: "Bulgarian Stock Exchange", code: "BUL", country: "BG", yahoo: ".SO" },
  { name: "Bursa Malaysia", code: "KLSE", country: "MY", yahoo: ".KL" },
  { name: "Canadian Securities Exchange", code: "CSE", country: "CA", yahoo: ".CN" },
  { name: "Casablanca Stock Exchange", code: "CBSE", country: "MA", yahoo: ".CS" },
  { name: "Cboe Canada", code: "NEO", country: "CA", yahoo: ".NE" },
  { name: "Colombia Stock Exchange", code: "BVC", country: "CO", yahoo: ".CL" },
  { name: "Colombo Stock Exchange", code: "COSE", country: "LK", yahoo: ".CM" },
  { name: "Copenhagen Stock Exchange", code: "CPH", country: "DK", yahoo: ".CO" },
  { name: "Deutsche Börse Xetra", code: "ETR", alt: ["XETRA"], country: "DE", yahoo: ".DE" },
  { name: "Dhaka Stock Exchange", code: "DSE", country: "BD", yahoo: ".DH" },
  { name: "Dubai Financial Market", code: "DFM", country: "AE", yahoo: ".DU" },
  { name: "Dusseldorf Stock Exchange", code: "DUSE", country: "DE", yahoo: ".DU" },
  { name: "Egyptian Stock Exchange", code: "EGX", country: "EG", yahoo: ".CA" },
  { name: "Euronext Amsterdam", code: "AMS", country: "NL", yahoo: ".AS" },
  { name: "Euronext Brussels", code: "EBR", country: "BE", yahoo: ".BR" },
  { name: "Euronext Dublin", code: "DUB", country: "IE", yahoo: ".IR" },
  { name: "Euronext Paris", code: "EPA", country: "FR", yahoo: ".PA" },
  { name: "Frankfurt Stock Exchange", code: "FRA", country: "DE", yahoo: ".F" },
  { name: "Hamburg Stock Exchange", code: "HAM", country: "DE", yahoo: ".HM" },
  { name: "Hanoi Stock Exchange", code: "HNX", country: "VN", yahoo: ".HN" },
  { name: "Ho Chi Minh Stock Exchange", code: "HOSE", country: "VN", yahoo: ".VN" },
  { name: "Hong Kong Stock Exchange", code: "HKG", alt: ["HKEX"], country: "HK", yahoo: ".HK" },
  { name: "Indonesia Stock Exchange", code: "IDX", country: "ID", yahoo: ".JK" },
  { name: "Istanbul Stock Exchange", code: "IST", alt: ["BIST"], country: "TR", yahoo: ".IS" },
  { name: "Jamaica Stock Exchange", code: "JMSE", country: "JM", yahoo: ".JM" },
  { name: "Johannesburg Stock Exchange", code: "JSE", country: "ZA", yahoo: ".JO" },
  { name: "Kazakhstan Stock Exchange", code: "KASE", country: "KZ", yahoo: ".KZ" },
  { name: "Korea New Exchange", code: "XKON", country: "KR", yahoo: ".KN" },
  { name: "Korea Stock Exchange", code: "KRX", country: "KR", yahoo: ".KS" },
  { name: "KOSDAQ", code: "KOSDAQ", country: "KR", yahoo: ".KQ" },
  { name: "Kuwait Stock Exchange", code: "KWSE", country: "KW", yahoo: ".KW" },
  { name: "Lima Stock Exchange", code: "BVL", country: "PE", yahoo: ".LM" },
  { name: "London Stock Exchange AIM", code: "AIM", country: "GB", yahoo: ".L" },
  { name: "London Stock Exchange", code: "LON", alt: ["LSE"], country: "GB", yahoo: ".L" },
  { name: "Luxembourg Stock Exchange", code: "LUX", country: "LU", yahoo: ".LU" },
  { name: "Madrid Stock Exchange", code: "BME", country: "ES", yahoo: ".MC" },
  { name: "Mauritius Stock Exchange", code: "MUSE", country: "MU", yahoo: ".MU" },
  { name: "Mexican Stock Exchange", code: "BMV", country: "MX", yahoo: ".MX" },
  { name: "Moscow Stock Exchange", code: "MOEX", country: "RU", yahoo: ".ME" },
  { name: "Munich Stock Exchange", code: "MUN", country: "DE", yahoo: ".MU" },
  { name: "Muscat Securities Market", code: "MSM", country: "OM", yahoo: ".MS" },
  { name: "Nagoya Stock Exchange", code: "XNGO", country: "JP", yahoo: ".NG" },
  { name: "Nairobi Securities Exchange", code: "NASE", country: "KE", yahoo: ".NR" },
  { name: "Nasdaq Helsinki", code: "HEL", country: "FI", yahoo: ".HE" },
  { name: "Nasdaq Stock Market", code: "NASDAQ", country: "US", yahoo: "" },
  { name: "Nasdaq Stockholm", code: "STO", country: "SE", yahoo: ".ST" },
  { name: "National Stock Exchange of India", code: "NSE", country: "IN", yahoo: ".NS" },
  { name: "New York Stock Exchange", code: "NYSE", country: "US", yahoo: "" },
  { name: "New Zealand Stock Exchange", code: "NZE", alt: ["NZX"], country: "NZ", yahoo: ".NZ" },
  { name: "Nigerian Stock Exchange", code: "NGX", country: "NG", yahoo: ".LG" },
  { name: "Nordic Growth Market", code: "NGM", country: "SE", yahoo: ".NGM" },
  { name: "NYSE American", code: "AMEX", country: "US", yahoo: "" },
  { name: "Oslo Børs", code: "OSL", alt: ["OSE"], country: "NO", yahoo: ".OL" },
  { name: "Pakistan Stock Exchange", code: "PSX", country: "PK", yahoo: ".KA" },
  { name: "Philippine Stock Exchange", code: "PSE", country: "PH", yahoo: ".PS" },
  { name: "Prague Stock Exchange", code: "PRA", country: "CZ", yahoo: ".PR" },
  { name: "Qatar Stock Exchange", code: "QSE", country: "QA", yahoo: ".QA" },
  { name: "Santiago Stock Exchange", code: "SNSE", country: "CL", yahoo: ".SN" },
  { name: "Saudi Stock Exchange", code: "TADAWUL", country: "SA", yahoo: ".SR" },
  { name: "Shanghai Stock Exchange", code: "SHA", country: "CN", yahoo: ".SS" },
  { name: "Shenzhen Stock Exchange", code: "SHE", country: "CN", yahoo: ".SZ" },
  { name: "Singapore Exchange Catalist", code: "SGXC", country: "SG", yahoo: ".SI" },
  { name: "Singapore Exchange", code: "SGX", country: "SG", yahoo: ".SI" },
  { name: "SIX Swiss Exchange", code: "SWX", alt: ["SIX"], country: "CH", yahoo: ".SW" },
  { name: "Stock Exchange of Thailand", code: "BKK", country: "TH", yahoo: ".BK" },
  { name: "Stuttgart Stock Exchange", code: "BST", country: "DE", yahoo: ".SG" },
  { name: "Taipei Exchange", code: "TPEX", country: "TW", yahoo: ".TWO" },
  { name: "Taiwan Stock Exchange", code: "TPE", alt: ["TWSE"], country: "TW", yahoo: ".TW" },
  { name: "Tel Aviv Stock Exchange", code: "TLV", country: "IL", yahoo: ".TA" },
  { name: "Tokyo Stock Exchange", code: "TYO", country: "JP", yahoo: ".T" },
  { name: "Toronto Stock Exchange", code: "TSX", country: "CA", yahoo: ".TO" },
  { name: "TSX Venture Exchange", code: "TSXV", country: "CA", yahoo: ".V" },
  { name: "Tunis Stock Exchange", code: "BVMT", country: "TN", yahoo: ".TN" },
  { name: "US OTC", code: "OTC", country: "US", yahoo: "" },
  { name: "Vienna Stock Exchange", code: "VIE", country: "AT", yahoo: ".VI" },
  { name: "Warsaw Stock Exchange", code: "WSE", country: "PL", yahoo: ".WA" },
  { name: "Zagreb Stock Exchange", code: "ZSE", country: "HR", yahoo: ".ZG" },
];

export const EXCHANGES_BY_CODE = new Map();
for (const ex of GLOBAL_EXCHANGES) {
  EXCHANGES_BY_CODE.set(ex.code.toUpperCase(), ex);
  if (ex.alt) {
    for (const a of ex.alt) EXCHANGES_BY_CODE.set(a.toUpperCase(), ex);
  }
}

/**
 * Returns Google Search URL for stock pricing:
 * e.g. "https://www.google.com/search?q=ASX+NAB"
 */
export function googleStockSearchUrl(code, exchange = "ASX") {
  const ex = (exchange || "ASX").trim();
  const c = (code || "").trim();
  const query = `${ex} ${c}`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Resolves an exchange code or alias into canonical exchange metadata.
 */
export function resolveExchange(code) {
  if (!code) return null;
  return EXCHANGES_BY_CODE.get(String(code).trim().toUpperCase()) ?? null;
}

