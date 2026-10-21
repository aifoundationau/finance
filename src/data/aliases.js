// Curated identities for frequent government suppliers.
//
// Covers names the live ASX list cannot resolve on its own: contracting subsidiaries and
// brands of ASX-listed parents, overseas-listed primes, and well-known private or
// government-owned suppliers.
//   asx:      ASX code of the listed parent; checked against the live ASX list at runtime.
//   exchange/ticker: overseas listing.
//   listing:  "Private" | "Government-owned" when unlisted.
//   strict:   names (as written) that only match in free text when they appear in exactly
//             this capitalisation, for short acronyms such as "SAP" or "EY".
export const ALIASES = [
  // ASX-listed parents with differently named subsidiaries or brands
  { names: ["downer", "downer edi", "downer group", "spotless"], asx: "DOW" },
  { names: ["ventia", "broadspectrum", "visionstream"], asx: "VNT" },
  { names: ["macquarie telecom", "macquarie government", "macquarie cloud services", "macquarie data centres"], asx: "MAQ" },
  { names: ["telstra", "telstra health", "telstra enterprise", "telstra purple"], asx: "TLS" },
  { names: ["seqirus", "csl seqirus", "csl behring"], asx: "CSL" },
  { names: ["austal", "austal ships", "austal defence shipbuilding"], asx: "ASB" },
  { names: ["transit systems"], asx: "KLS" },
  { names: ["technologyone", "technology one"], asx: "TNE" },
  { names: ["data#3", "data 3"], asx: "DTL" },
  { names: ["electro optic systems", "eos defence systems", "eos"], asx: "EOS", strict: ["EOS"] },
  { names: ["minelab"], asx: "CDA" },
  { names: ["primero group", "golding contractors"], asx: "NWH" },
  { names: ["virgin australia"], asx: "VGN" },
  { names: ["lend lease"], asx: "LLC" },
  { names: ["highcom technology", "highcom armor"], asx: "HCL" },
  { names: ["excite technology services", "cbit"], asx: "EXT" },

  // Defence primes and suppliers
  { names: ["lockheed martin", "sikorsky"], exchange: "NYSE", ticker: "LMT", display: "Lockheed Martin" },
  { names: ["boeing", "boeing defence australia", "insitu pacific"], exchange: "NYSE", ticker: "BA", display: "Boeing" },
  { names: ["raytheon", "rtx", "collins aerospace", "pratt & whitney"], exchange: "NYSE", ticker: "RTX", display: "RTX (Raytheon)", strict: ["RTX"] },
  { names: ["northrop grumman"], exchange: "NYSE", ticker: "NOC", display: "Northrop Grumman" },
  { names: ["general dynamics", "gdls"], exchange: "NYSE", ticker: "GD", display: "General Dynamics", strict: ["GDLS"] },
  { names: ["l3harris", "l3 harris"], exchange: "NYSE", ticker: "LHX", display: "L3Harris" },
  { names: ["bae systems"], exchange: "LSE", ticker: "BA.", display: "BAE Systems" },
  { names: ["thales"], exchange: "EPA", ticker: "HO", display: "Thales" },
  { names: ["saab"], exchange: "STO", ticker: "SAAB-B", display: "Saab" },
  { names: ["kongsberg"], exchange: "OSE", ticker: "KOG", display: "Kongsberg" },
  { names: ["rheinmetall"], exchange: "ETR", ticker: "RHM", display: "Rheinmetall" },
  { names: ["leonardo"], exchange: "BIT", ticker: "LDO", display: "Leonardo" },
  { names: ["airbus"], exchange: "EPA", ticker: "AIR", display: "Airbus" },
  { names: ["safran"], exchange: "EPA", ticker: "SAF", display: "Safran" },
  { names: ["hanwha aerospace", "hanwha defense", "hanwha defence"], exchange: "KRX", ticker: "012450", display: "Hanwha Aerospace" },
  { names: ["hanwha ocean"], exchange: "KRX", ticker: "042660", display: "Hanwha Ocean" },
  { names: ["mitsubishi heavy industries", "mhi"], exchange: "TYO", ticker: "7011", display: "Mitsubishi Heavy Industries", strict: ["MHI"] },
  { names: ["elbit systems", "elbit"], exchange: "NASDAQ", ticker: "ESLT", display: "Elbit Systems" },
  { names: ["babcock"], exchange: "LSE", ticker: "BAB", display: "Babcock International" },
  { names: ["leidos"], exchange: "NYSE", ticker: "LDOS", display: "Leidos" },
  { names: ["textron", "bell textron"], exchange: "NYSE", ticker: "TXT", display: "Textron" },
  { names: ["honeywell"], exchange: "NASDAQ", ticker: "HON", display: "Honeywell" },
  { names: ["ge aerospace"], exchange: "NYSE", ticker: "GE", display: "GE Aerospace" },
  { names: ["palantir"], exchange: "NASDAQ", ticker: "PLTR", display: "Palantir" },
  { names: ["thyssenkrupp marine systems", "tkms"], exchange: "ETR", ticker: "TKMS", display: "TKMS", strict: ["TKMS"] },
  { names: ["cae"], exchange: "NYSE", ticker: "CAE", display: "CAE", strict: ["CAE"] },
  { names: ["naval group"], listing: "Government-owned", display: "Naval Group", note: "French state-controlled" },
  { names: ["navantia"], listing: "Government-owned", display: "Navantia", note: "Spanish state-owned" },
  { names: ["asc pty", "asc shipbuilding", "asc"], listing: "Government-owned", display: "ASC", strict: ["ASC"] },
  { names: ["australian naval infrastructure"], listing: "Government-owned", display: "Australian Naval Infrastructure" },
  { names: ["anduril"], listing: "Private", display: "Anduril" },
  { names: ["shield ai"], listing: "Private", display: "Shield AI" },
  { names: ["general atomics"], listing: "Private", display: "General Atomics" },
  { names: ["ocius", "ocius technology"], listing: "Private", display: "Ocius Technology" },
  { names: ["cea technologies"], listing: "Private", display: "CEA Technologies" },
  { names: ["nova systems"], listing: "Private", display: "Nova Systems" },
  { names: ["gilmour space"], listing: "Private", display: "Gilmour Space" },
  { names: ["silentium defence"], listing: "Private", display: "Silentium Defence" },
  { names: ["sentient vision"], listing: "Private", display: "Sentient Vision Systems" },
  { names: ["ultra maritime", "ultra electronics"], listing: "Private", display: "Ultra" },

  // IT, telecoms and consulting
  { names: ["accenture"], exchange: "NYSE", ticker: "ACN", display: "Accenture" },
  { names: ["ibm"], exchange: "NYSE", ticker: "IBM", display: "IBM", strict: ["IBM"] },
  { names: ["microsoft"], exchange: "NASDAQ", ticker: "MSFT", display: "Microsoft" },
  { names: ["amazon web services", "aws", "amazon"], exchange: "NASDAQ", ticker: "AMZN", display: "Amazon (AWS)", strict: ["AWS"] },
  { names: ["google", "google cloud", "alphabet"], exchange: "NASDAQ", ticker: "GOOGL", display: "Alphabet (Google)" },
  { names: ["oracle"], exchange: "NYSE", ticker: "ORCL", display: "Oracle" },
  { names: ["salesforce"], exchange: "NYSE", ticker: "CRM", display: "Salesforce" },
  { names: ["servicenow"], exchange: "NYSE", ticker: "NOW", display: "ServiceNow" },
  { names: ["sap"], exchange: "ETR", ticker: "SAP", display: "SAP", strict: ["SAP"] },
  { names: ["cisco", "splunk"], exchange: "NASDAQ", ticker: "CSCO", display: "Cisco" },
  { names: ["dell technologies", "dell"], exchange: "NYSE", ticker: "DELL", display: "Dell Technologies" },
  { names: ["hewlett packard enterprise", "hpe"], exchange: "NYSE", ticker: "HPE", display: "Hewlett Packard Enterprise", strict: ["HPE"] },
  { names: ["hewlett packard", "hp inc", "hp pps"], exchange: "NYSE", ticker: "HPQ", display: "HP Inc." },
  { names: ["fujitsu"], exchange: "TYO", ticker: "6702", display: "Fujitsu" },
  { names: ["nec australia", "nec corporation"], exchange: "TYO", ticker: "6701", display: "NEC" },
  { names: ["unisys"], exchange: "NYSE", ticker: "UIS", display: "Unisys" },
  { names: ["dxc technology", "dxc"], exchange: "NYSE", ticker: "DXC", display: "DXC Technology", strict: ["DXC"] },
  { names: ["kyndryl"], exchange: "NYSE", ticker: "KD", display: "Kyndryl" },
  { names: ["capgemini"], exchange: "EPA", ticker: "CAP", display: "Capgemini" },
  { names: ["infosys"], exchange: "NYSE", ticker: "INFY", display: "Infosys" },
  { names: ["tata consultancy services", "tcs"], exchange: "NSE", ticker: "TCS", display: "Tata Consultancy Services", strict: ["TCS"] },
  { names: ["wipro"], exchange: "NYSE", ticker: "WIT", display: "Wipro" },
  { names: ["hcl technologies", "hcltech", "hcl australia"], exchange: "NSE", ticker: "HCLTECH", display: "HCLTech" },
  { names: ["cognizant"], exchange: "NASDAQ", ticker: "CTSH", display: "Cognizant" },
  { names: ["atos"], exchange: "EPA", ticker: "ATO", display: "Atos" },
  { names: ["cgi"], exchange: "NYSE", ticker: "GIB", display: "CGI", strict: ["CGI"] },
  { names: ["atlassian"], exchange: "NASDAQ", ticker: "TEAM", display: "Atlassian" },
  { names: ["palo alto networks"], exchange: "NASDAQ", ticker: "PANW", display: "Palo Alto Networks" },
  { names: ["crowdstrike"], exchange: "NASDAQ", ticker: "CRWD", display: "CrowdStrike" },
  { names: ["fortinet"], exchange: "NASDAQ", ticker: "FTNT", display: "Fortinet" },
  { names: ["okta"], exchange: "NASDAQ", ticker: "OKTA", display: "Okta" },
  { names: ["workday"], exchange: "NASDAQ", ticker: "WDAY", display: "Workday" },
  { names: ["snowflake"], exchange: "NYSE", ticker: "SNOW", display: "Snowflake" },
  { names: ["optus", "singtel"], exchange: "SGX", ticker: "Z74", display: "Optus (Singtel)" },
  { names: ["deloitte"], listing: "Private", display: "Deloitte" },
  { names: ["kpmg"], listing: "Private", display: "KPMG" },
  { names: ["pwc", "pricewaterhousecoopers"], listing: "Private", display: "PwC", strict: ["PwC", "PWC"] },
  { names: ["ernst & young", "ey"], listing: "Private", display: "EY", strict: ["EY"] },
  { names: ["mckinsey"], listing: "Private", display: "McKinsey & Company" },
  { names: ["boston consulting group", "bcg"], listing: "Private", display: "Boston Consulting Group", strict: ["BCG"] },
  { names: ["nous group"], listing: "Private", display: "Nous Group" },
  { names: ["cybercx"], listing: "Private", display: "CyberCX" },
  { names: ["vocus"], listing: "Private", display: "Vocus" },
  { names: ["datacom"], listing: "Private", display: "Datacom" },
  { names: ["thoughtworks"], listing: "Private", display: "Thoughtworks" },
  { names: ["canva"], listing: "Private", display: "Canva" },
  { names: ["openai"], listing: "Private", display: "OpenAI" },
  { names: ["anthropic"], listing: "Private", display: "Anthropic" },
  { names: ["databricks"], listing: "Private", display: "Databricks" },
  { names: ["epic systems"], listing: "Private", display: "Epic Systems" },

  // Construction, engineering and rail
  { names: ["cimic", "cpb contractors", "ugl", "pacific partnerships", "sedgman"], exchange: "ETR", ticker: "HOT", display: "CIMIC Group (Hochtief)", note: "CIMIC is wholly owned by Hochtief", strict: ["UGL"] },
  { names: ["john holland"], exchange: "HKEX", ticker: "1800", display: "John Holland", note: "Owned by China Communications Construction" },
  { names: ["acciona"], exchange: "BME", ticker: "ANA", display: "Acciona" },
  { names: ["ferrovial"], exchange: "NASDAQ", ticker: "FER", display: "Ferrovial" },
  { names: ["webuild", "clough"], exchange: "BIT", ticker: "WBD", display: "Webuild" },
  { names: ["besix", "besix watpac", "watpac"], listing: "Private", display: "BESIX Watpac" },
  { names: ["multiplex"], listing: "Private", display: "Multiplex" },
  { names: ["laing o'rourke"], listing: "Private", display: "Laing O'Rourke" },
  { names: ["fulton hogan"], listing: "Private", display: "Fulton Hogan" },
  { names: ["mcconnell dowell"], listing: "Private", display: "McConnell Dowell" },
  { names: ["hansen yuncken"], listing: "Private", display: "Hansen Yuncken" },
  { names: ["richard crookes"], listing: "Private", display: "Richard Crookes Constructions" },
  { names: ["seymour whyte"], exchange: "EPA", ticker: "DG", display: "Seymour Whyte (VINCI)", note: "VINCI subsidiary" },
  { names: ["jacobs"], exchange: "NYSE", ticker: "J", display: "Jacobs" },
  { names: ["aecom"], exchange: "NYSE", ticker: "ACM", display: "AECOM" },
  { names: ["wsp"], exchange: "TSX", ticker: "WSP", display: "WSP", strict: ["WSP"] },
  { names: ["arcadis"], exchange: "AMS", ticker: "ARCAD", display: "Arcadis" },
  { names: ["stantec", "cardno"], exchange: "TSX", ticker: "STN", display: "Stantec" },
  { names: ["tetra tech", "coffey"], exchange: "NASDAQ", ticker: "TTEK", display: "Tetra Tech" },
  { names: ["ghd"], listing: "Private", display: "GHD", strict: ["GHD"] },
  { names: ["aurecon"], listing: "Private", display: "Aurecon" },
  { names: ["smec"], listing: "Private", display: "SMEC", strict: ["SMEC"] },
  { names: ["arup"], listing: "Private", display: "Arup" },
  { names: ["mott macdonald"], listing: "Private", display: "Mott MacDonald" },
  { names: ["siemens healthineers"], exchange: "ETR", ticker: "SHL", display: "Siemens Healthineers" },
  { names: ["siemens", "siemens mobility"], exchange: "ETR", ticker: "SIE", display: "Siemens" },
  { names: ["alstom"], exchange: "EPA", ticker: "ALO", display: "Alstom" },
  { names: ["hitachi", "hitachi rail"], exchange: "TYO", ticker: "6501", display: "Hitachi" },
  { names: ["wabtec"], exchange: "NYSE", ticker: "WAB", display: "Wabtec" },
  { names: ["stadler"], exchange: "SIX", ticker: "SRAIL", display: "Stadler Rail" },

  // Facilities, workforce and outsourced services
  { names: ["serco"], exchange: "LSE", ticker: "SRP", display: "Serco" },
  { names: ["sodexo"], exchange: "EPA", ticker: "SW", display: "Sodexo" },
  { names: ["compass group", "ess support services"], exchange: "LSE", ticker: "CPG", display: "Compass Group" },
  { names: ["iss facility services", "iss"], exchange: "CPH", ticker: "ISS", display: "ISS", strict: ["ISS"] },
  { names: ["programmed facility management", "programmed maintenance services", "programmed skilled workforce"], exchange: "TYO", ticker: "2181", display: "Programmed (Persol)" },
  { names: ["chandler macleod"], exchange: "TYO", ticker: "6098", display: "Chandler Macleod (Recruit)" },
  { names: ["hays specialist recruitment", "hays"], exchange: "LSE", ticker: "HAS", display: "Hays" },
  { names: ["randstad"], exchange: "AMS", ticker: "RAND", display: "Randstad" },
  { names: ["adecco"], exchange: "SIX", ticker: "ADEN", display: "Adecco" },
  { names: ["manpowergroup"], exchange: "NYSE", ticker: "MAN", display: "ManpowerGroup" },
  { names: ["maximus"], exchange: "NYSE", ticker: "MMS", display: "Maximus" },
  { names: ["teleperformance"], exchange: "EPA", ticker: "TEP", display: "Teleperformance" },
  { names: ["concentrix"], exchange: "NASDAQ", ticker: "CNXC", display: "Concentrix" },
  { names: ["veolia"], exchange: "EPA", ticker: "VIE", display: "Veolia" },
  { names: ["wilson security"], listing: "Private", display: "Wilson Security" },
  { names: ["mss security"], listing: "Private", display: "MSS Security" },
  { names: ["certis"], listing: "Private", display: "Certis" },
  { names: ["sg fleet"], listing: "Private", display: "SG Fleet", note: "No longer ASX-listed" },
  { names: ["aspen medical"], listing: "Private", display: "Aspen Medical" },
  { names: ["hudson global", "hudson global resources"], listing: "Private", display: "Hudson" },

  // Health and pharmaceuticals
  { names: ["moderna"], exchange: "NASDAQ", ticker: "MRNA", display: "Moderna" },
  { names: ["pfizer"], exchange: "NYSE", ticker: "PFE", display: "Pfizer" },
  { names: ["astrazeneca"], exchange: "NASDAQ", ticker: "AZN", display: "AstraZeneca" },
  { names: ["novavax"], exchange: "NASDAQ", ticker: "NVAX", display: "Novavax" },
  { names: ["roche"], exchange: "SIX", ticker: "ROG", display: "Roche" },
  { names: ["johnson & johnson"], exchange: "NYSE", ticker: "JNJ", display: "Johnson & Johnson" },
  { names: ["medtronic"], exchange: "NYSE", ticker: "MDT", display: "Medtronic" },
  { names: ["philips"], exchange: "AMS", ticker: "PHIA", display: "Philips" },
  { names: ["ge healthcare"], exchange: "NASDAQ", ticker: "GEHC", display: "GE HealthCare" },
  { names: ["bupa"], listing: "Private", display: "Bupa" },
  { names: ["healthscope"], listing: "Private", display: "Healthscope" },

  // Transport, logistics and energy
  { names: ["toll group", "toll transport", "toll holdings"], exchange: "TYO", ticker: "6178", display: "Toll Group (Japan Post)" },
  { names: ["linfox"], listing: "Private", display: "Linfox" },
  { names: ["australia post", "startrack"], listing: "Government-owned", display: "Australia Post" },
  { names: ["transdev"], listing: "Private", display: "Transdev" },
  { names: ["keolis downer"], listing: "Private", display: "Keolis Downer", note: "Keolis / Downer joint venture" },
  { names: ["comfortdelgro"], exchange: "SGX", ticker: "C52", display: "ComfortDelGro" },
  { names: ["snowy hydro"], listing: "Government-owned", display: "Snowy Hydro" },
  { names: ["nbn co"], listing: "Government-owned", display: "NBN Co" },
  { names: ["iberdrola"], exchange: "BME", ticker: "IBE", display: "Iberdrola" },
  { names: ["energyaustralia"], exchange: "HKEX", ticker: "0002", display: "EnergyAustralia (CLP)" },
  { names: ["squadron energy"], listing: "Private", display: "Squadron Energy" },
  { names: ["neoen"], listing: "Private", display: "Neoen" },
  { names: ["alinta"], listing: "Private", display: "Alinta Energy" },
  { names: ["transgrid"], listing: "Private", display: "Transgrid" },
  { names: ["ausnet"], listing: "Private", display: "AusNet" },
  { names: ["akaysha"], listing: "Private", display: "Akaysha Energy" },
];

// Single-word company names that are ordinary words. They still resolve as supplier names,
// but are ignored when scanning headlines, where they are usually just English.
export const COMMON_WORDS = new Set(`
ABACUS ACCENT ACTION ACUMEN ADVANCE AERIS AGENT ALLIANCE ALPHA ALTITUDE AMBITION ANCHOR APEX APOLLO
ARCADIA ARENA ARGO ARROW ASPIRE ASSET ATLAS AUGUST AURORA AVENUE AXIS BAILADOR BEACON BELL BIRD BLACK
BLAZE BLOCK BLOSSOM BLUE BOARD BOSS BRAVE BRIDGE BRIGHT BUILT CANVAS CAPE CAPITAL CARBON CASCADE
CASTLE CATALYST CENTRAL CENTURY CHALLENGER CHAMPION CHARTER CHORUS CIRCLE CITY CIVIC CLARITY CLEAR
CLIMATE CLOUD COAST COBALT COMET COMMAND COMPASS CONNECT CORE CORNERSTONE CORONA COSMOS CREST CROSS
CROWN CRYSTAL CURRENT CYBER DATA DAWN DELTA DIGITAL DIRECT DISCOVERY DOMAIN DREAM DYNAMIC EAGLE EARTH
ECHO ECLIPSE EDGE ELEMENT ELEVATE ELIXIR EMBER EMERALD EMPIRE ENERGY ENVIRO EPIC EQUITY ESSENTIAL EVOLUTION
EXCEL EXCITE EXPLORE FALCON FIRST FLAG FLIGHT FOCUS FORTUNE FORWARD FOUNDATION FRONTIER FUSION FUTURE
GALAXY GATEWAY GENESIS GLOBAL GOLD GOLDEN GRAND GREEN HALO HARBOUR HARMONY HAVEN HEALTH HERITAGE HIGHLAND
HORIZON HUB ICON IGNITE IMPACT INFINITY INSIGHT INTEGRATED IRON ISLAND JADE JUPITER KEY KINETIC KINGDOM
LANDMARK LEGACY LEGEND LIBERTY LIGHTHOUSE LINK LION LITHIUM LOTUS LUNA MAGELLAN MAGNET MAGNETIC MAJESTIC
MANTLE MATRIX MAVERICK MEDICAL MERCURY MERIDIAN METAL METALS METRO MIDAS MINERAL MINERALS MINING MIRACLE
MOMENTUM MONARCH MOSAIC MOTION NATIONAL NATIVE NAVIGATOR NEXUS NOBLE NORTH NORTHERN NOVA OASIS OCEAN
OCEANIA OMEGA ONYX OPTIMA ORBIT ORIGIN OUTBACK PACIFIC PALADIN PANORAMA PARAGON PATHWAY PEAK PEARL PHOENIX
PILOT PINNACLE PIONEER PLATINUM PLAYSIDE POLARIS PORTAL POWER PREMIER PRESTIGE PRIME PROGRAMMED PROPERTY
PROSPECT PULSE QUANTUM QUEST RADIANT RANGE RAPID REACH REGAL RELIANCE RENEW RESOLUTE RESOURCE RESOURCES
RIDGE RISE RIVER ROCKET ROYAL SAGE SAPPHIRE SCOUT SECURE SEEK SELECT SENTINEL SHIELD SIERRA SIGMA SIGNAL
SILVER SKY SMART SOLAR SONIC SOUTHERN SPARK SPECTRUM SPIRIT STAR STELLAR STRIDE SUMMIT SUN SUNRISE SUPERIOR
SUPPLY SWIFT SYNERGY TALON TARGET TERRA TITAN TOTAL TOWER TRANSFORM TREASURE TRIDENT TRINITY TRITON TRUST
UNION UNITY UNIVERSAL URANIUM VALLEY VALOR VANGUARD VAULT VECTOR VELOCITY VENTURE VERTEX VICTORY VISION
VITAL VIVA VOLT VORTEX WAVE WEST WESTERN WILD WISDOM WORLD XPLORE ZENITH ZEUS
`.trim().split(/\s+/));
