import { test } from "node:test";
import assert from "node:assert/strict";
import { contractStatus, detectGov, exclusionReason, extractVendorNames, forwardWindow, sectorFor } from "../src/lib/classify.js";
import { NOW } from "./helpers.js";

test("confirmed versus forward-looking", () => {
  assert.equal(contractStatus("Ventia secures AUD 110 million contract").status, "confirmed");
  assert.equal(contractStatus("Defence signs $1b deal with Hanwha").status, "confirmed");
  assert.deepEqual(contractStatus("BESIX Watpac named preferred builder for new Hobart Stadium"), { status: "forward", stage: "preferred" });
  assert.equal(contractStatus("Four firms shortlisted for state gas power projects").stage, "shortlisted");
  assert.equal(contractStatus("Acciona Selected for Victoria's 2 GW Offshore Wind Transmission Project").stage, "selected");
  assert.equal(contractStatus("Construction tenders released to replace two bridges").stage, "tender");
  assert.equal(contractStatus("Stakk Extends Contract with Chime Financial").stage, "extension");
  assert.equal(contractStatus("Quarterly activities report").status, null);
});

test("topic exclusions from the brief", () => {
  assert.equal(exclusionReason("Artemis Awarded EIS Co-funding for Cassowary Drilling"), "grant");
  assert.equal(exclusionReason("Nurses accept pay rise under new enterprise agreement"), "wages");
  assert.equal(exclusionReason("Preferred Tenderer for Taroom Trough Block PLR2026-1-7"), "resource-permit");
  assert.equal(exclusionReason("Alstom Wins 2026 Australian Good Design Award"), "prize");
  assert.equal(exclusionReason("Conroy targets 'rot' in Defence after $15.6m bungle"), "policy");
  assert.equal(exclusionReason("Excite secures $2.9M contract with federal regulator"), null);
});

test("government counterparty detection, most specific first", () => {
  assert.equal(detectGov("contract with the Department of Defence and the Australian Government").agency, "Department of Defence");
  assert.equal(detectGov("Transport for NSW awards contract").jurisdiction, "NSW");
  assert.equal(detectGov("$245M from the National Reconstruction Fund Corporation").level, "gbe");
  assert.equal(detectGov("Builder chosen for Hobart's Macquarie Point stadium").jurisdiction, "TAS");
  assert.equal(detectGov("NT Govt announces contractor panels").agency, "NT Government");
  assert.equal(detectGov("City of Whittlesea awards asset contract").level, "local");
  assert.equal(detectGov("Defence Connect jobs board"), null);
  assert.equal(detectGov("Supply agreement with Umedica; TGA registration pending", { skipRegulators: true }), null);
});

test("state government inferred from a public-procurement headline", () => {
  assert.equal(detectGov("Acciona Selected for Victoria's 2 GW Offshore Wind Transmission Project"), null);
  const inferred = detectGov("Acciona Selected for Victoria's 2 GW Offshore Wind Transmission Project", { infer: true });
  assert.equal(inferred.agency, "Victorian Government");
  assert.equal(inferred.weak, true);
  assert.equal(detectGov("Sydney startup signs deal with Japanese buyer", { infer: true }), null); // not public procurement
});

test("sector follows the buyer for Defence, else the deliverable", () => {
  assert.equal(sectorFor("ICT equipment", detectGov("Department of Defence")), "Defence");
  assert.equal(sectorFor("digital forensics software and services"), "Cyber/IT");
  assert.equal(sectorFor("Water Infrastructure Projects"), "Infrastructure");
  assert.equal(sectorFor("2 GW offshore wind transmission"), "Energy");
});

test("vendor names come from the headline subject or object", () => {
  assert.deepEqual(extractVendorNames("Price still under wraps as BESIX Watpac named Macquarie Point stadium builder"), ["BESIX Watpac"]);
  assert.deepEqual(extractVendorNames("Australia's Cobalt Blue secures early offtake agreement"), ["Cobalt Blue"]);
  assert.deepEqual(extractVendorNames("Defence awards Leidos $500m contract"), ["Leidos"]);
  assert.deepEqual(extractVendorNames("Builder chosen for Hobart's Macquarie Point stadium"), []);
  assert.deepEqual(extractVendorNames("Queensland LNP gets excited as it shortlists companies"), []);
});

test("forward windows read dates and phrases", () => {
  assert.equal(forwardWindow("Bids close 27 October", NOW).to, "2026-10-27");
  assert.equal(forwardWindow("A decision is due next week", NOW).label, "Next week");
  assert.equal(forwardWindow("Shortlist announced", NOW).label, "Next 7 days (indicative)");
});
