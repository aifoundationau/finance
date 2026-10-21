// Australian government counterparties, ordered from most to least specific: the first
// pattern that matches anywhere in a text wins. Levels:
//   defence | federal | gbe (Commonwealth corporate/business enterprise)
//   state   | soc (state-owned corporation) | local
// name: null means "use the text that matched" (for lists of bodies in one pattern).
// weak: generic mentions that often appear as boilerplate; they only count without foreign context.
// regulator: usually mentioned as a regulator (approvals, filings), not as a customer.
const A = (re, name, jur, level, weak = false, regulator = false) => ({ re, name, jur, level, weak, regulator });
const GOVT = "Gov(?:ernmen)?t";

export const AGENCY_PATTERNS = [
  // Defence portfolio
  A(/\bAustralian Submarine Agency\b/i, "Australian Submarine Agency", "Federal", "defence"),
  A(/\bAustralian Signals Directorate\b|\bASD\b/, "Australian Signals Directorate", "Federal", "defence"),
  A(/\bCapability Acquisition and Sustainment Group\b|\bCASG\b/, "Department of Defence (CASG)", "Federal", "defence"),
  A(/\bGuided Weapons and Explosive Ordnance\b|\bGWEO\b/, "Department of Defence (GWEO)", "Federal", "defence"),
  A(/\bDefence Digital Group\b/i, "Department of Defence (Defence Digital Group)", "Federal", "defence"),
  A(/\bAdvanced Strategic Capabilities Accelerator\b|\bASCA\b/, "Department of Defence (ASCA)", "Federal", "defence"),
  A(/\bDefence Science and Technology Group\b|\bDSTG\b/, "Defence Science and Technology Group", "Federal", "defence"),
  A(/\bDefence Housing Australia\b/i, "Defence Housing Australia", "Federal", "defence"),
  A(/\bDepartment of Defence\b|\bDefence Department\b/i, "Department of Defence", "Federal", "defence"),
  A(/\bRoyal Australian Navy\b/i, "Royal Australian Navy", "Federal", "defence"),
  A(/\bRoyal Australian Air Force\b|\bRAAF\b/, "Royal Australian Air Force", "Federal", "defence"),
  A(/\bAustralian Army\b/i, "Australian Army", "Federal", "defence"),
  A(/\bAustralian Defence Force\b|\bADF\b/, "Australian Defence Force", "Federal", "defence"),
  A(/\bAUKUS\b/, "Department of Defence (AUKUS)", "Federal", "defence", true),
  A(/\bDefence (?:Minister|Industry Minister|Industry and Capability Delivery)\b/, "Department of Defence", "Federal", "defence"),

  // Commonwealth corporate entities and business enterprises
  A(/\bNational Reconstruction Fund(?: Corporation)?\b|\bNRFC?\b/, "National Reconstruction Fund Corporation", "Federal", "gbe"),
  A(/\bClean Energy Finance Corporation\b|\bCEFC\b/, "Clean Energy Finance Corporation", "Federal", "gbe"),
  A(/\bExport Finance Australia\b/i, "Export Finance Australia", "Federal", "gbe"),
  A(/\bNBN Co\b|\bNBN\b/, "NBN Co", "Federal", "gbe"),
  A(/\bAustralia Post\b/i, "Australia Post", "Federal", "gbe"),
  A(/\bSnowy Hydro\b/i, "Snowy Hydro", "Federal", "gbe"),
  A(/\bAustralian Rail Track Corporation\b|\bARTC\b|\bInland Rail\b/, "Australian Rail Track Corporation", "Federal", "gbe"),
  A(/\bAustralian Naval Infrastructure\b/i, "Australian Naval Infrastructure", "Federal", "gbe"),
  A(/\bWestern Sydney (?:International )?Airport\b/i, "Western Sydney Airport", "Federal", "gbe"),
  A(/\bHousing Australia\b/, "Housing Australia", "Federal", "gbe"),

  // Commonwealth departments and agencies
  A(/\bServices Australia\b/i, "Services Australia", "Federal", "federal"),
  A(/\bDepartment of Home Affairs\b|\bHome Affairs\b/i, "Department of Home Affairs", "Federal", "federal"),
  A(/\bAustralian Border Force\b/i, "Australian Border Force", "Federal", "federal"),
  A(/\bAustralian Taxation Office\b|\bATO\b/, "Australian Taxation Office", "Federal", "federal"),
  A(/\bDepartment of Health, Disability and Ageing\b|\bDepartment of Health and Aged Care\b/i, "Department of Health, Disability and Ageing", "Federal", "federal"),
  A(/\bDepartment of Finance\b/i, "Department of Finance", "Federal", "federal"),
  A(/\bDepartment of Foreign Affairs and Trade\b|\bDFAT\b/, "Department of Foreign Affairs and Trade", "Federal", "federal"),
  A(/\bDepartment of Infrastructure, Transport\b/i, "Department of Infrastructure, Transport, Regional Development, Communications, Sport and the Arts", "Federal", "federal"),
  A(/\bDepartment of Employment and Workplace Relations\b|\bDEWR\b/, "Department of Employment and Workplace Relations", "Federal", "federal"),
  A(/\bDepartment of Social Services\b/i, "Department of Social Services", "Federal", "federal"),
  A(/\bNational Disability Insurance Agency\b|\bNDIA\b|\bNDIS\b/, "National Disability Insurance Agency", "Federal", "federal"),
  A(/\bDepartment of Veterans' Affairs\b|\bDVA\b/, "Department of Veterans' Affairs", "Federal", "federal"),
  A(/\bAttorney-General's Department\b/i, "Attorney-General's Department", "Federal", "federal"),
  A(/\bAustralian Federal Police\b/i, "Australian Federal Police", "Federal", "federal"),
  A(/\bASIO\b|\bASIS\b|\bAustralian Criminal Intelligence Commission\b|\bAUSTRAC\b/, null, "Federal", "federal"),
  A(/\bAustralian Securities and Investments Commission\b|\bASIC\b|\bAPRA\b|\bACCC\b/, null, "Federal", "federal", false, true),
  A(/\bAustralian Bureau of Statistics\b|\bBureau of Meteorology\b/i, null, "Federal", "federal"),
  A(/\bCSIRO\b/, "CSIRO", "Federal", "federal"),
  A(/\bGeoscience Australia\b/i, "Geoscience Australia", "Federal", "federal"),
  A(/\bDigital Transformation Agency\b|\bDTA\b/, "Digital Transformation Agency", "Federal", "federal"),
  A(/\bAustralian Electoral Commission\b/i, "Australian Electoral Commission", "Federal", "federal"),
  A(/\bDepartment of Climate Change, Energy, the Environment and Water\b|\bDCCEEW\b/, "Department of Climate Change, Energy, the Environment and Water", "Federal", "federal"),
  A(/\bDepartment of Industry, Science and Resources\b/i, "Department of Industry, Science and Resources", "Federal", "federal"),
  A(/\bDepartment of Agriculture, Fisheries and Forestry\b/i, "Department of Agriculture, Fisheries and Forestry", "Federal", "federal"),
  A(/\bDepartment of the Prime Minister and Cabinet\b/i, "Department of the Prime Minister and Cabinet", "Federal", "federal"),
  A(/\bNational Indigenous Australians Agency\b|\bNIAA\b/, "National Indigenous Australians Agency", "Federal", "federal"),
  A(/\bAirservices Australia\b|\bCivil Aviation Safety Authority\b|\bAustralian Maritime Safety Authority\b/i, null, "Federal", "federal"),
  A(/\bTherapeutic Goods Administration\b|\bTGA\b/, "Therapeutic Goods Administration", "Federal", "federal", false, true),
  A(/\bAustralian Antarctic Division\b/i, "Australian Antarctic Division", "Federal", "federal"),
  A(/\bIP Australia\b/, "IP Australia", "Federal", "federal"),

  // States and territories: named agencies and state-owned corporations
  A(/\bTransport for NSW\b|\bTfNSW\b/i, "Transport for NSW", "NSW", "state"),
  A(/\bSydney Metro\b/i, "Sydney Metro", "NSW", "state"),
  A(/\bNSW Health\b|\beHealth NSW\b|\bHealth Infrastructure NSW\b|\bHealthShare NSW\b/i, null, "NSW", "state"),
  A(/\bService NSW\b|\bInfrastructure NSW\b|\bNSW Police(?: Force)?\b/i, null, "NSW", "state"),
  A(/\bSydney Water\b|\bHunter Water\b|\bWaterNSW\b|\bEssential Energy\b|\bLandcom\b|\bPort Authority of NSW\b/i, null, "NSW", "soc"),
  A(/\bVictorian Infrastructure Delivery Authority\b|\bMajor Transport Infrastructure Authority\b|\bLevel Crossing Removal\b|\bSuburban Rail Loop\b|\bNorth East Link\b|\bMetro Tunnel\b|\bBig Build\b|\bMelbourne Airport Rail\b/i, "Victorian Infrastructure Delivery Authority", "VIC", "state"),
  A(/\bVicGrid\b|\bVictoria Police\b|\bV\/Line\b|\bVicTrack\b|\bVicRoads\b|\bAmbulance Victoria\b|\bDigital Victoria\b|\bService Victoria\b|\bDevelopment Victoria\b|\bHomes Victoria\b/i, null, "VIC", "state"),
  A(/\bMelbourne Water\b|\bYarra Valley Water\b|\bSouth East Water\b|\bGreater Western Water\b/i, null, "VIC", "soc"),
  A(/\bQueensland Health\b|\bQueensland Police(?: Service)?\b|\bCross River Rail\b/i, null, "QLD", "state"),
  A(/\bDepartment of Transport and Main Roads\b/i, "Department of Transport and Main Roads (QLD)", "QLD", "state"),
  A(/\bQueensland Rail\b|\bPowerlink\b|\bEnergy Queensland\b|\bErgon\b|\bEnergex\b|\bStanwell\b|\bCS Energy\b|\bCleanCo\b|\bSunwater\b|\bSeqwater\b|\bQueensland Hydro\b/i, null, "QLD", "soc"),
  A(/\bGames Independent Infrastructure and Coordination Authority\b|\bGIICA\b/i, "Games Independent Infrastructure and Coordination Authority", "QLD", "state"),
  A(/\bMain Roads (?:WA|Western Australia)\b|\bMETRONET\b|\bPublic Transport Authority\b|\bWA Health\b|\bWA Police\b|\bDevelopment ?WA\b/i, null, "WA", "state"),
  A(/\bWater Corporation\b|\bWestern Power\b|\bFremantle Ports\b|\bPilbara Ports\b|\bSouthern Ports\b/i, null, "WA", "soc"),
  A(/\bSA Water\b/i, "SA Water", "SA", "soc"),
  A(/\bSA Health\b|\bSA Police\b|\bRenewal SA\b|\bDepartment for Infrastructure and Transport\b/i, null, "SA", "state"),
  A(/\bMacquarie Point\b|\bStadiums Tasmania\b/i, "Macquarie Point Development Corporation", "TAS", "soc"),
  A(/\bHydro Tasmania\b|\bTasNetworks\b|\bTT-Line\b/i, null, "TAS", "soc"),
  A(/\bTasmanian Health Service\b/i, "Tasmanian Health Service", "TAS", "state"),
  A(/\bTransport Canberra\b|\bMajor Projects Canberra\b|\bInfrastructure Canberra\b|\bCanberra Health Services\b/i, null, "ACT", "state"),
  A(/\bPower and Water Corporation\b|\bTerritory Generation\b/i, null, "NT", "soc"),

  // Commonwealth, generic ("Defence" with a capital D is the department in Australian usage)
  A(/\bDefence\b(?! Connect)/, "Department of Defence", "Federal", "defence", true),
  A(/\bCommonwealth of Australia\b|\bCommonwealth Government\b|\bthe Commonwealth\b(?! Bank| Games)/i, "Commonwealth of Australia", "Federal", "federal", true),
  A(new RegExp(`\\b(?:Australian|Albanese|Federal) ${GOVT}\\b`, "i"), "Australian Government", "Federal", "federal", true),
  A(/\bfederal (?:agency|department|regulator)\b|\bFederal Government Regulator\b/i, "Australian Government", "Federal", "federal", true),

  // States, generic
  A(new RegExp(`\\b(?:NSW|New South Wales)(?: State)? ${GOVT}\\b|\\bMinns ${GOVT}\\b|\\bNSW Department\\b`, "i"), "NSW Government", "NSW", "state"),
  A(new RegExp(`\\b(?:Victorian|Vic)(?: State)? ${GOVT}\\b|\\bState of Victoria\\b|\\bAllan ${GOVT}\\b|\\bVictorian Department\\b`, "i"), "Victorian Government", "VIC", "state"),
  A(new RegExp(`\\b(?:Queensland|Qld)(?: State)? ${GOVT}\\b|\\bState of Queensland\\b|\\bCrisafulli ${GOVT}\\b|\\bQueensland Department\\b`, "i"), "Queensland Government", "QLD", "state"),
  A(new RegExp(`\\b(?:WA|Western Australian?)(?: State)? ${GOVT}\\b|\\bState of Western Australia\\b|\\bCook ${GOVT}\\b`, "i"), "WA Government", "WA", "state"),
  A(new RegExp(`\\b(?:SA|South Australian?)(?: State)? ${GOVT}\\b|\\bState of South Australia\\b|\\bMalinauskas ${GOVT}\\b`, "i"), "SA Government", "SA", "state"),
  A(new RegExp(`\\bTasmanian(?: State)? ${GOVT}\\b|\\bState of Tasmania\\b|\\bRockliff ${GOVT}\\b`, "i"), "Tasmanian Government", "TAS", "state"),
  A(new RegExp(`\\bACT ${GOVT}\\b`), "ACT Government", "ACT", "state"),
  A(new RegExp(`\\b(?:NT|Northern Territory) ${GOVT}\\b`, "i"), "NT Government", "NT", "state"),
  A(/\bstate government\b|\bstate-owned\b|\bstate agency\b/i, "State Government", null, "state", true),
  A(/\bgov(?:ernmen)?t (?:regulator|agency|department|client|customer)\b/i, "Government agency (unnamed)", null, "federal", true),

  // Local government (out of scope by default)
  A(/\b(?:City|Shire|Municipality|Town) of [A-Z][a-z]+|\b[A-Z][a-z]+(?: [A-Z][a-z]+)? (?:City|Shire|Regional|District|Municipal) Council\b|\bMunicipal Association of Victoria\b|\bMAV\b/, "Local council", "Local", "local"),
  A(/\blocal government\b|\bcouncils?\b/i, "Local council", "Local", "local"),
];

export const STATE_HINTS = [
  ["NSW", /\b(?:New South Wales|NSW|Sydney|Newcastle|Wollongong)\b/],
  ["VIC", /\b(?:Victoria|Victorian|Melbourne|Geelong)\b/],
  ["QLD", /\b(?:Queensland|Qld|QLD|Brisbane|Townsville|Gold Coast|CQ|SEQ|FNQ)\b/],
  ["WA", /\b(?:Western Australia|WA|Perth|Pilbara|Fremantle|Henderson)\b/],
  ["SA", /\b(?:South Australia|SA|Adelaide|Osborne|Whyalla)\b/],
  ["TAS", /\b(?:Tasmania|Tasmanian|Hobart|Launceston)\b/],
  ["ACT", /\b(?:ACT|Australian Capital Territory)\b/],
  ["NT", /\b(?:Northern Territory|NT|Darwin)\b/],
];

export const AU_CONTEXT_RE =
  /\b(?:Australia|Australian|Aussie|Commonwealth|ASX|NSW|Victoria|Victorian|Queensland|Tasmania|Tasmanian|Canberra|Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|ADF|RAAF|AUKUS)\b/;

export const AU_HOSTS = new Set([
  "innovationaus.com", "asiapacificdefencereporter.com", "defenceconnect.com.au", "itnews.com.au",
  "governmentnews.com.au", "stockhead.com.au", "themarketonline.com.au", "businessnews.com.au",
  "afr.com", "theaustralian.com.au", "abc.net.au", "smh.com.au", "theage.com.au", "marketindex.com.au",
  "kalkine.com.au", "kalkinemedia.com", "smallcaps.com.au", "proactiveinvestors.com.au", "reneweconomy.com.au",
]);

export const FOREIGN_RE =
  /\b(?:India|Indian|crore|lakh|Rs\.?\s?\d|₹|Pentagon|U\.?S\.? (?:Army|Navy|Air Force|Marine Corps|Department of Defense|DoD)|US Defense|Department of Defense|DoD\b|UK MoD|British Army|Royal Navy|Ministry of Defence|MoD\b|Philippines?|Philippine|Indonesia|Indonesian|Canada|Canadian|New Zealand|NZ\$|Ukraine|Ukrainian|Taiwan|DAPA|MINDEF|Malaysia|Malaysian|Bundeswehr|NATO|United States|US Navy|Virginia[- ]class|Huntington Ingalls|HII|Electric Boat|Sweden|Swedish|Nigeria|Vietnam|Bangladesh|South Africa|South African|Chile|Chilean|Brazil|Brazilian|Mozambique|Alabama|National Defence|Nova Scotia|Spaceport)\b/;
