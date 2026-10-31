import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBAL_EXCHANGES, EXCHANGES_BY_CODE, googleStockSearchUrl, resolveExchange } from "../public/shared/exchanges.js";
import { yahooSymbol } from "../src/sources/history.js";

test("GLOBAL_EXCHANGES contains all 88 active global stock markets", () => {
  assert.equal(GLOBAL_EXCHANGES.length, 88);
  const codes = new Set(GLOBAL_EXCHANGES.map((e) => e.code));
  assert.equal(codes.size, 88);

  // Key global markets from the list
  const required = [
    "ADX", "ASE", "AQU", "ATH", "ASX", "BVMF", "BOM", "BIT", "BVB", "BUD",
    "BCBA", "BUL", "KLSE", "CSE", "CBSE", "NEO", "BVC", "COSE", "CPH", "ETR",
    "DSE", "DFM", "DUSE", "EGX", "AMS", "EBR", "DUB", "EPA", "FRA", "HAM",
    "HNX", "HOSE", "HKG", "IDX", "IST", "JMSE", "JSE", "KASE", "XKON", "KRX",
    "KOSDAQ", "KWSE", "BVL", "AIM", "LON", "LUX", "BME", "MUSE", "BMV", "MOEX",
    "MUN", "MSM", "XNGO", "NASE", "HEL", "NASDAQ", "STO", "NSE", "NYSE", "NZE",
    "NGX", "NGM", "AMEX", "OSL", "PSX", "PSE", "PRA", "QSE", "SNSE", "TADAWUL",
    "SHA", "SHE", "SGXC", "SGX", "SWX", "BKK", "BST", "TPEX", "TPE", "TLV",
    "TYO", "TSX", "TSXV", "BVMT", "OTC", "VIE", "WSE", "ZSE"
  ];
  for (const r of required) {
    assert.ok(codes.has(r), `Missing market code: ${r}`);
  }
});

test("googleStockSearchUrl formats query for universal Google stock search", () => {
  assert.equal(googleStockSearchUrl("NAB", "ASX"), "https://www.google.com/search?q=ASX%20NAB");
  assert.equal(googleStockSearchUrl("LMT", "NYSE"), "https://www.google.com/search?q=NYSE%20LMT");
  assert.equal(googleStockSearchUrl("BA.", "LON"), "https://www.google.com/search?q=LON%20BA.");
  assert.equal(googleStockSearchUrl("7011", "TYO"), "https://www.google.com/search?q=TYO%207011");
  assert.equal(googleStockSearchUrl("BHP"), "https://www.google.com/search?q=ASX%20BHP");
});

test("resolveExchange identifies exchanges by code and alias", () => {
  assert.equal(resolveExchange("ASX")?.name, "Australian Securities Exchange");
  assert.equal(resolveExchange("LON")?.name, "London Stock Exchange");
  assert.equal(resolveExchange("LSE")?.name, "London Stock Exchange");
  assert.equal(resolveExchange("TYO")?.name, "Tokyo Stock Exchange");
  assert.equal(resolveExchange("B3")?.name, "B3 Brazil Stock Exchange");
  assert.equal(resolveExchange("TADAWUL")?.name, "Saudi Stock Exchange");
  assert.equal(resolveExchange("invalid"), null);
});

test("yahooSymbol maps symbols across global exchanges", () => {
  assert.equal(yahooSymbol("NAB", "ASX"), "NAB.AX");
  assert.equal(yahooSymbol("LMT", "NYSE"), "LMT");
  assert.equal(yahooSymbol("BA.", "LON"), "BA.L");
  assert.equal(yahooSymbol("BA", "LSE"), "BA.L");
  assert.equal(yahooSymbol("7011", "TYO"), "7011.T");
  assert.equal(yahooSymbol("RHM", "ETR"), "RHM.DE");
  assert.equal(yahooSymbol("SAAB-B", "STO"), "SAAB-B.ST");
  assert.equal(yahooSymbol("012450", "KRX"), "012450.KS");
});

