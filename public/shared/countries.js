// Standard ISO 3166-1 alpha-2 country definitions and World Bank PPP helper

export const COUNTRY_NAME_MAP = {
  "AC": "Ascension Island",
  "AD": "Andorra",
  "AE": "United Arab Emirates",
  "AF": "Afghanistan",
  "AG": "Antigua & Barbuda",
  "AI": "Anguilla",
  "AL": "Albania",
  "AM": "Armenia",
  "AN": "Curaçao",
  "AO": "Angola",
  "AQ": "Antarctica",
  "AR": "Argentina",
  "AS": "American Samoa",
  "AT": "Austria",
  "AU": "Australia",
  "AW": "Aruba",
  "AX": "Åland Islands",
  "AZ": "Azerbaijan",
  "BA": "Bosnia & Herzegovina",
  "BB": "Barbados",
  "BD": "Bangladesh",
  "BE": "Belgium",
  "BF": "Burkina Faso",
  "BG": "Bulgaria",
  "BH": "Bahrain",
  "BI": "Burundi",
  "BJ": "Benin",
  "BL": "St. Barthélemy",
  "BM": "Bermuda",
  "BN": "Brunei",
  "BO": "Bolivia",
  "BQ": "Caribbean Netherlands",
  "BR": "Brazil",
  "BS": "Bahamas",
  "BT": "Bhutan",
  "BU": "Myanmar (Burma)",
  "BV": "Bouvet Island",
  "BW": "Botswana",
  "BY": "Belarus",
  "BZ": "Belize",
  "CA": "Canada",
  "CC": "Cocos (Keeling) Islands",
  "CD": "Congo - Kinshasa",
  "CF": "Central African Republic",
  "CG": "Congo - Brazzaville",
  "CH": "Switzerland",
  "CI": "Côte d’Ivoire",
  "CK": "Cook Islands",
  "CL": "Chile",
  "CM": "Cameroon",
  "CN": "China",
  "CO": "Colombia",
  "CP": "Clipperton Island",
  "CQ": "Sark",
  "CR": "Costa Rica",
  "CS": "Serbia",
  "CU": "Cuba",
  "CV": "Cape Verde",
  "CW": "Curaçao",
  "CX": "Christmas Island",
  "CY": "Cyprus",
  "CZ": "Czechia",
  "DD": "Germany",
  "DE": "Germany",
  "DG": "Diego Garcia",
  "DJ": "Djibouti",
  "DK": "Denmark",
  "DM": "Dominica",
  "DO": "Dominican Republic",
  "DY": "Benin",
  "DZ": "Algeria",
  "EA": "Ceuta & Melilla",
  "EC": "Ecuador",
  "EE": "Estonia",
  "EG": "Egypt",
  "EH": "Western Sahara",
  "ER": "Eritrea",
  "ES": "Spain",
  "ET": "Ethiopia",
  "EU": "European Union",
  "EZ": "Eurozone",
  "FI": "Finland",
  "FJ": "Fiji",
  "FK": "Falkland Islands",
  "FM": "Micronesia",
  "FO": "Faroe Islands",
  "FR": "France",
  "FX": "France",
  "GA": "Gabon",
  "GB": "United Kingdom",
  "GD": "Grenada",
  "GE": "Georgia",
  "GF": "French Guiana",
  "GG": "Guernsey",
  "GH": "Ghana",
  "GI": "Gibraltar",
  "GL": "Greenland",
  "GM": "Gambia",
  "GN": "Guinea",
  "GP": "Guadeloupe",
  "GQ": "Equatorial Guinea",
  "GR": "Greece",
  "GS": "South Georgia & South Sandwich Islands",
  "GT": "Guatemala",
  "GU": "Guam",
  "GW": "Guinea-Bissau",
  "GY": "Guyana",
  "HK": "Hong Kong SAR China",
  "HM": "Heard & McDonald Islands",
  "HN": "Honduras",
  "HR": "Croatia",
  "HT": "Haiti",
  "HU": "Hungary",
  "HV": "Burkina Faso",
  "IC": "Canary Islands",
  "ID": "Indonesia",
  "IE": "Ireland",
  "IL": "Israel",
  "IM": "Isle of Man",
  "IN": "India",
  "IO": "British Indian Ocean Territory",
  "IQ": "Iraq",
  "IR": "Iran",
  "IS": "Iceland",
  "IT": "Italy",
  "JE": "Jersey",
  "JM": "Jamaica",
  "JO": "Jordan",
  "JP": "Japan",
  "KE": "Kenya",
  "KG": "Kyrgyzstan",
  "KH": "Cambodia",
  "KI": "Kiribati",
  "KM": "Comoros",
  "KN": "St. Kitts & Nevis",
  "KP": "North Korea",
  "KR": "South Korea",
  "KW": "Kuwait",
  "KY": "Cayman Islands",
  "KZ": "Kazakhstan",
  "LA": "Laos",
  "LB": "Lebanon",
  "LC": "St. Lucia",
  "LI": "Liechtenstein",
  "LK": "Sri Lanka",
  "LR": "Liberia",
  "LS": "Lesotho",
  "LT": "Lithuania",
  "LU": "Luxembourg",
  "LV": "Latvia",
  "LY": "Libya",
  "MA": "Morocco",
  "MC": "Monaco",
  "MD": "Moldova",
  "ME": "Montenegro",
  "MF": "St. Martin",
  "MG": "Madagascar",
  "MH": "Marshall Islands",
  "MK": "North Macedonia",
  "ML": "Mali",
  "MM": "Myanmar (Burma)",
  "MN": "Mongolia",
  "MO": "Macao SAR China",
  "MP": "Northern Mariana Islands",
  "MQ": "Martinique",
  "MR": "Mauritania",
  "MS": "Montserrat",
  "MT": "Malta",
  "MU": "Mauritius",
  "MV": "Maldives",
  "MW": "Malawi",
  "MX": "Mexico",
  "MY": "Malaysia",
  "MZ": "Mozambique",
  "NA": "Namibia",
  "NC": "New Caledonia",
  "NE": "Niger",
  "NF": "Norfolk Island",
  "NG": "Nigeria",
  "NH": "Vanuatu",
  "NI": "Nicaragua",
  "NL": "Netherlands",
  "NO": "Norway",
  "NP": "Nepal",
  "NR": "Nauru",
  "NU": "Niue",
  "NZ": "New Zealand",
  "OM": "Oman",
  "PA": "Panama",
  "PE": "Peru",
  "PF": "French Polynesia",
  "PG": "Papua New Guinea",
  "PH": "Philippines",
  "PK": "Pakistan",
  "PL": "Poland",
  "PM": "St. Pierre & Miquelon",
  "PN": "Pitcairn Islands",
  "PR": "Puerto Rico",
  "PS": "Palestinian Territories",
  "PT": "Portugal",
  "PW": "Palau",
  "PY": "Paraguay",
  "QA": "Qatar",
  "QO": "Outlying Oceania",
  "RE": "Réunion",
  "RH": "Zimbabwe",
  "RO": "Romania",
  "RS": "Serbia",
  "RU": "Russia",
  "RW": "Rwanda",
  "SA": "Saudi Arabia",
  "SB": "Solomon Islands",
  "SC": "Seychelles",
  "SD": "Sudan",
  "SE": "Sweden",
  "SG": "Singapore",
  "SH": "St. Helena",
  "SI": "Slovenia",
  "SJ": "Svalbard & Jan Mayen",
  "SK": "Slovakia",
  "SL": "Sierra Leone",
  "SM": "San Marino",
  "SN": "Senegal",
  "SO": "Somalia",
  "SR": "Suriname",
  "SS": "South Sudan",
  "ST": "São Tomé & Príncipe",
  "SU": "Russia",
  "SV": "El Salvador",
  "SX": "Sint Maarten",
  "SY": "Syria",
  "SZ": "Eswatini",
  "TA": "Tristan da Cunha",
  "TC": "Turks & Caicos Islands",
  "TD": "Chad",
  "TF": "French Southern Territories",
  "TG": "Togo",
  "TH": "Thailand",
  "TJ": "Tajikistan",
  "TK": "Tokelau",
  "TL": "Timor-Leste",
  "TM": "Turkmenistan",
  "TN": "Tunisia",
  "TO": "Tonga",
  "TP": "Timor-Leste",
  "TR": "Türkiye",
  "TT": "Trinidad & Tobago",
  "TV": "Tuvalu",
  "TW": "Taiwan",
  "TZ": "Tanzania",
  "UA": "Ukraine",
  "UG": "Uganda",
  "UK": "United Kingdom",
  "UM": "U.S. Outlying Islands",
  "UN": "United Nations",
  "US": "United States",
  "UY": "Uruguay",
  "UZ": "Uzbekistan",
  "VA": "Vatican City",
  "VC": "St. Vincent & Grenadines",
  "VD": "Vietnam",
  "VE": "Venezuela",
  "VG": "British Virgin Islands",
  "VI": "U.S. Virgin Islands",
  "VN": "Vietnam",
  "VU": "Vanuatu",
  "WF": "Wallis & Futuna",
  "WS": "Samoa",
  "XA": "Pseudo-Accents",
  "XB": "Pseudo-Bidi",
  "XK": "Kosovo",
  "YD": "Yemen",
  "YE": "Yemen",
  "YT": "Mayotte",
  "YU": "Serbia",
  "ZA": "South Africa",
  "ZM": "Zambia",
  "ZR": "Congo - Kinshasa",
  "ZW": "Zimbabwe"
};

export const GLOBAL_COUNTRIES = [
  {
    "code": "AF",
    "name": "Afghanistan"
  },
  {
    "code": "AX",
    "name": "Åland Islands"
  },
  {
    "code": "AL",
    "name": "Albania"
  },
  {
    "code": "DZ",
    "name": "Algeria"
  },
  {
    "code": "AS",
    "name": "American Samoa"
  },
  {
    "code": "AD",
    "name": "Andorra"
  },
  {
    "code": "AO",
    "name": "Angola"
  },
  {
    "code": "AI",
    "name": "Anguilla"
  },
  {
    "code": "AQ",
    "name": "Antarctica"
  },
  {
    "code": "AG",
    "name": "Antigua & Barbuda"
  },
  {
    "code": "AR",
    "name": "Argentina"
  },
  {
    "code": "AM",
    "name": "Armenia"
  },
  {
    "code": "AW",
    "name": "Aruba"
  },
  {
    "code": "AC",
    "name": "Ascension Island"
  },
  {
    "code": "AU",
    "name": "Australia"
  },
  {
    "code": "AT",
    "name": "Austria"
  },
  {
    "code": "AZ",
    "name": "Azerbaijan"
  },
  {
    "code": "BS",
    "name": "Bahamas"
  },
  {
    "code": "BH",
    "name": "Bahrain"
  },
  {
    "code": "BD",
    "name": "Bangladesh"
  },
  {
    "code": "BB",
    "name": "Barbados"
  },
  {
    "code": "BY",
    "name": "Belarus"
  },
  {
    "code": "BE",
    "name": "Belgium"
  },
  {
    "code": "BZ",
    "name": "Belize"
  },
  {
    "code": "BJ",
    "name": "Benin"
  },
  {
    "code": "DY",
    "name": "Benin"
  },
  {
    "code": "BM",
    "name": "Bermuda"
  },
  {
    "code": "BT",
    "name": "Bhutan"
  },
  {
    "code": "BO",
    "name": "Bolivia"
  },
  {
    "code": "BA",
    "name": "Bosnia & Herzegovina"
  },
  {
    "code": "BW",
    "name": "Botswana"
  },
  {
    "code": "BV",
    "name": "Bouvet Island"
  },
  {
    "code": "BR",
    "name": "Brazil"
  },
  {
    "code": "IO",
    "name": "British Indian Ocean Territory"
  },
  {
    "code": "VG",
    "name": "British Virgin Islands"
  },
  {
    "code": "BN",
    "name": "Brunei"
  },
  {
    "code": "BG",
    "name": "Bulgaria"
  },
  {
    "code": "BF",
    "name": "Burkina Faso"
  },
  {
    "code": "HV",
    "name": "Burkina Faso"
  },
  {
    "code": "BI",
    "name": "Burundi"
  },
  {
    "code": "KH",
    "name": "Cambodia"
  },
  {
    "code": "CM",
    "name": "Cameroon"
  },
  {
    "code": "CA",
    "name": "Canada"
  },
  {
    "code": "IC",
    "name": "Canary Islands"
  },
  {
    "code": "CV",
    "name": "Cape Verde"
  },
  {
    "code": "BQ",
    "name": "Caribbean Netherlands"
  },
  {
    "code": "KY",
    "name": "Cayman Islands"
  },
  {
    "code": "CF",
    "name": "Central African Republic"
  },
  {
    "code": "EA",
    "name": "Ceuta & Melilla"
  },
  {
    "code": "TD",
    "name": "Chad"
  },
  {
    "code": "CL",
    "name": "Chile"
  },
  {
    "code": "CN",
    "name": "China"
  },
  {
    "code": "CX",
    "name": "Christmas Island"
  },
  {
    "code": "CP",
    "name": "Clipperton Island"
  },
  {
    "code": "CC",
    "name": "Cocos (Keeling) Islands"
  },
  {
    "code": "CO",
    "name": "Colombia"
  },
  {
    "code": "KM",
    "name": "Comoros"
  },
  {
    "code": "CG",
    "name": "Congo - Brazzaville"
  },
  {
    "code": "CD",
    "name": "Congo - Kinshasa"
  },
  {
    "code": "ZR",
    "name": "Congo - Kinshasa"
  },
  {
    "code": "CK",
    "name": "Cook Islands"
  },
  {
    "code": "CR",
    "name": "Costa Rica"
  },
  {
    "code": "CI",
    "name": "Côte d’Ivoire"
  },
  {
    "code": "HR",
    "name": "Croatia"
  },
  {
    "code": "CU",
    "name": "Cuba"
  },
  {
    "code": "AN",
    "name": "Curaçao"
  },
  {
    "code": "CW",
    "name": "Curaçao"
  },
  {
    "code": "CY",
    "name": "Cyprus"
  },
  {
    "code": "CZ",
    "name": "Czechia"
  },
  {
    "code": "DK",
    "name": "Denmark"
  },
  {
    "code": "DG",
    "name": "Diego Garcia"
  },
  {
    "code": "DJ",
    "name": "Djibouti"
  },
  {
    "code": "DM",
    "name": "Dominica"
  },
  {
    "code": "DO",
    "name": "Dominican Republic"
  },
  {
    "code": "EC",
    "name": "Ecuador"
  },
  {
    "code": "EG",
    "name": "Egypt"
  },
  {
    "code": "SV",
    "name": "El Salvador"
  },
  {
    "code": "GQ",
    "name": "Equatorial Guinea"
  },
  {
    "code": "ER",
    "name": "Eritrea"
  },
  {
    "code": "EE",
    "name": "Estonia"
  },
  {
    "code": "SZ",
    "name": "Eswatini"
  },
  {
    "code": "ET",
    "name": "Ethiopia"
  },
  {
    "code": "EU",
    "name": "European Union"
  },
  {
    "code": "EZ",
    "name": "Eurozone"
  },
  {
    "code": "FK",
    "name": "Falkland Islands"
  },
  {
    "code": "FO",
    "name": "Faroe Islands"
  },
  {
    "code": "FJ",
    "name": "Fiji"
  },
  {
    "code": "FI",
    "name": "Finland"
  },
  {
    "code": "FR",
    "name": "France"
  },
  {
    "code": "FX",
    "name": "France"
  },
  {
    "code": "GF",
    "name": "French Guiana"
  },
  {
    "code": "PF",
    "name": "French Polynesia"
  },
  {
    "code": "TF",
    "name": "French Southern Territories"
  },
  {
    "code": "GA",
    "name": "Gabon"
  },
  {
    "code": "GM",
    "name": "Gambia"
  },
  {
    "code": "GE",
    "name": "Georgia"
  },
  {
    "code": "DD",
    "name": "Germany"
  },
  {
    "code": "DE",
    "name": "Germany"
  },
  {
    "code": "GH",
    "name": "Ghana"
  },
  {
    "code": "GI",
    "name": "Gibraltar"
  },
  {
    "code": "GR",
    "name": "Greece"
  },
  {
    "code": "GL",
    "name": "Greenland"
  },
  {
    "code": "GD",
    "name": "Grenada"
  },
  {
    "code": "GP",
    "name": "Guadeloupe"
  },
  {
    "code": "GU",
    "name": "Guam"
  },
  {
    "code": "GT",
    "name": "Guatemala"
  },
  {
    "code": "GG",
    "name": "Guernsey"
  },
  {
    "code": "GN",
    "name": "Guinea"
  },
  {
    "code": "GW",
    "name": "Guinea-Bissau"
  },
  {
    "code": "GY",
    "name": "Guyana"
  },
  {
    "code": "HT",
    "name": "Haiti"
  },
  {
    "code": "HM",
    "name": "Heard & McDonald Islands"
  },
  {
    "code": "HN",
    "name": "Honduras"
  },
  {
    "code": "HK",
    "name": "Hong Kong SAR China"
  },
  {
    "code": "HU",
    "name": "Hungary"
  },
  {
    "code": "IS",
    "name": "Iceland"
  },
  {
    "code": "IN",
    "name": "India"
  },
  {
    "code": "ID",
    "name": "Indonesia"
  },
  {
    "code": "IR",
    "name": "Iran"
  },
  {
    "code": "IQ",
    "name": "Iraq"
  },
  {
    "code": "IE",
    "name": "Ireland"
  },
  {
    "code": "IM",
    "name": "Isle of Man"
  },
  {
    "code": "IL",
    "name": "Israel"
  },
  {
    "code": "IT",
    "name": "Italy"
  },
  {
    "code": "JM",
    "name": "Jamaica"
  },
  {
    "code": "JP",
    "name": "Japan"
  },
  {
    "code": "JE",
    "name": "Jersey"
  },
  {
    "code": "JO",
    "name": "Jordan"
  },
  {
    "code": "KZ",
    "name": "Kazakhstan"
  },
  {
    "code": "KE",
    "name": "Kenya"
  },
  {
    "code": "KI",
    "name": "Kiribati"
  },
  {
    "code": "XK",
    "name": "Kosovo"
  },
  {
    "code": "KW",
    "name": "Kuwait"
  },
  {
    "code": "KG",
    "name": "Kyrgyzstan"
  },
  {
    "code": "LA",
    "name": "Laos"
  },
  {
    "code": "LV",
    "name": "Latvia"
  },
  {
    "code": "LB",
    "name": "Lebanon"
  },
  {
    "code": "LS",
    "name": "Lesotho"
  },
  {
    "code": "LR",
    "name": "Liberia"
  },
  {
    "code": "LY",
    "name": "Libya"
  },
  {
    "code": "LI",
    "name": "Liechtenstein"
  },
  {
    "code": "LT",
    "name": "Lithuania"
  },
  {
    "code": "LU",
    "name": "Luxembourg"
  },
  {
    "code": "MO",
    "name": "Macao SAR China"
  },
  {
    "code": "MG",
    "name": "Madagascar"
  },
  {
    "code": "MW",
    "name": "Malawi"
  },
  {
    "code": "MY",
    "name": "Malaysia"
  },
  {
    "code": "MV",
    "name": "Maldives"
  },
  {
    "code": "ML",
    "name": "Mali"
  },
  {
    "code": "MT",
    "name": "Malta"
  },
  {
    "code": "MH",
    "name": "Marshall Islands"
  },
  {
    "code": "MQ",
    "name": "Martinique"
  },
  {
    "code": "MR",
    "name": "Mauritania"
  },
  {
    "code": "MU",
    "name": "Mauritius"
  },
  {
    "code": "YT",
    "name": "Mayotte"
  },
  {
    "code": "MX",
    "name": "Mexico"
  },
  {
    "code": "FM",
    "name": "Micronesia"
  },
  {
    "code": "MD",
    "name": "Moldova"
  },
  {
    "code": "MC",
    "name": "Monaco"
  },
  {
    "code": "MN",
    "name": "Mongolia"
  },
  {
    "code": "ME",
    "name": "Montenegro"
  },
  {
    "code": "MS",
    "name": "Montserrat"
  },
  {
    "code": "MA",
    "name": "Morocco"
  },
  {
    "code": "MZ",
    "name": "Mozambique"
  },
  {
    "code": "BU",
    "name": "Myanmar (Burma)"
  },
  {
    "code": "MM",
    "name": "Myanmar (Burma)"
  },
  {
    "code": "NA",
    "name": "Namibia"
  },
  {
    "code": "NR",
    "name": "Nauru"
  },
  {
    "code": "NP",
    "name": "Nepal"
  },
  {
    "code": "NL",
    "name": "Netherlands"
  },
  {
    "code": "NC",
    "name": "New Caledonia"
  },
  {
    "code": "NZ",
    "name": "New Zealand"
  },
  {
    "code": "NI",
    "name": "Nicaragua"
  },
  {
    "code": "NE",
    "name": "Niger"
  },
  {
    "code": "NG",
    "name": "Nigeria"
  },
  {
    "code": "NU",
    "name": "Niue"
  },
  {
    "code": "NF",
    "name": "Norfolk Island"
  },
  {
    "code": "KP",
    "name": "North Korea"
  },
  {
    "code": "MK",
    "name": "North Macedonia"
  },
  {
    "code": "MP",
    "name": "Northern Mariana Islands"
  },
  {
    "code": "NO",
    "name": "Norway"
  },
  {
    "code": "OM",
    "name": "Oman"
  },
  {
    "code": "QO",
    "name": "Outlying Oceania"
  },
  {
    "code": "PK",
    "name": "Pakistan"
  },
  {
    "code": "PW",
    "name": "Palau"
  },
  {
    "code": "PS",
    "name": "Palestinian Territories"
  },
  {
    "code": "PA",
    "name": "Panama"
  },
  {
    "code": "PG",
    "name": "Papua New Guinea"
  },
  {
    "code": "PY",
    "name": "Paraguay"
  },
  {
    "code": "PE",
    "name": "Peru"
  },
  {
    "code": "PH",
    "name": "Philippines"
  },
  {
    "code": "PN",
    "name": "Pitcairn Islands"
  },
  {
    "code": "PL",
    "name": "Poland"
  },
  {
    "code": "PT",
    "name": "Portugal"
  },
  {
    "code": "XA",
    "name": "Pseudo-Accents"
  },
  {
    "code": "XB",
    "name": "Pseudo-Bidi"
  },
  {
    "code": "PR",
    "name": "Puerto Rico"
  },
  {
    "code": "QA",
    "name": "Qatar"
  },
  {
    "code": "RE",
    "name": "Réunion"
  },
  {
    "code": "RO",
    "name": "Romania"
  },
  {
    "code": "RU",
    "name": "Russia"
  },
  {
    "code": "SU",
    "name": "Russia"
  },
  {
    "code": "RW",
    "name": "Rwanda"
  },
  {
    "code": "WS",
    "name": "Samoa"
  },
  {
    "code": "SM",
    "name": "San Marino"
  },
  {
    "code": "ST",
    "name": "São Tomé & Príncipe"
  },
  {
    "code": "CQ",
    "name": "Sark"
  },
  {
    "code": "SA",
    "name": "Saudi Arabia"
  },
  {
    "code": "SN",
    "name": "Senegal"
  },
  {
    "code": "CS",
    "name": "Serbia"
  },
  {
    "code": "RS",
    "name": "Serbia"
  },
  {
    "code": "YU",
    "name": "Serbia"
  },
  {
    "code": "SC",
    "name": "Seychelles"
  },
  {
    "code": "SL",
    "name": "Sierra Leone"
  },
  {
    "code": "SG",
    "name": "Singapore"
  },
  {
    "code": "SX",
    "name": "Sint Maarten"
  },
  {
    "code": "SK",
    "name": "Slovakia"
  },
  {
    "code": "SI",
    "name": "Slovenia"
  },
  {
    "code": "SB",
    "name": "Solomon Islands"
  },
  {
    "code": "SO",
    "name": "Somalia"
  },
  {
    "code": "ZA",
    "name": "South Africa"
  },
  {
    "code": "GS",
    "name": "South Georgia & South Sandwich Islands"
  },
  {
    "code": "KR",
    "name": "South Korea"
  },
  {
    "code": "SS",
    "name": "South Sudan"
  },
  {
    "code": "ES",
    "name": "Spain"
  },
  {
    "code": "LK",
    "name": "Sri Lanka"
  },
  {
    "code": "BL",
    "name": "St. Barthélemy"
  },
  {
    "code": "SH",
    "name": "St. Helena"
  },
  {
    "code": "KN",
    "name": "St. Kitts & Nevis"
  },
  {
    "code": "LC",
    "name": "St. Lucia"
  },
  {
    "code": "MF",
    "name": "St. Martin"
  },
  {
    "code": "PM",
    "name": "St. Pierre & Miquelon"
  },
  {
    "code": "VC",
    "name": "St. Vincent & Grenadines"
  },
  {
    "code": "SD",
    "name": "Sudan"
  },
  {
    "code": "SR",
    "name": "Suriname"
  },
  {
    "code": "SJ",
    "name": "Svalbard & Jan Mayen"
  },
  {
    "code": "SE",
    "name": "Sweden"
  },
  {
    "code": "CH",
    "name": "Switzerland"
  },
  {
    "code": "SY",
    "name": "Syria"
  },
  {
    "code": "TW",
    "name": "Taiwan"
  },
  {
    "code": "TJ",
    "name": "Tajikistan"
  },
  {
    "code": "TZ",
    "name": "Tanzania"
  },
  {
    "code": "TH",
    "name": "Thailand"
  },
  {
    "code": "TL",
    "name": "Timor-Leste"
  },
  {
    "code": "TP",
    "name": "Timor-Leste"
  },
  {
    "code": "TG",
    "name": "Togo"
  },
  {
    "code": "TK",
    "name": "Tokelau"
  },
  {
    "code": "TO",
    "name": "Tonga"
  },
  {
    "code": "TT",
    "name": "Trinidad & Tobago"
  },
  {
    "code": "TA",
    "name": "Tristan da Cunha"
  },
  {
    "code": "TN",
    "name": "Tunisia"
  },
  {
    "code": "TR",
    "name": "Türkiye"
  },
  {
    "code": "TM",
    "name": "Turkmenistan"
  },
  {
    "code": "TC",
    "name": "Turks & Caicos Islands"
  },
  {
    "code": "TV",
    "name": "Tuvalu"
  },
  {
    "code": "UM",
    "name": "U.S. Outlying Islands"
  },
  {
    "code": "VI",
    "name": "U.S. Virgin Islands"
  },
  {
    "code": "UG",
    "name": "Uganda"
  },
  {
    "code": "UA",
    "name": "Ukraine"
  },
  {
    "code": "AE",
    "name": "United Arab Emirates"
  },
  {
    "code": "GB",
    "name": "United Kingdom"
  },
  {
    "code": "UK",
    "name": "United Kingdom"
  },
  {
    "code": "UN",
    "name": "United Nations"
  },
  {
    "code": "US",
    "name": "United States"
  },
  {
    "code": "UY",
    "name": "Uruguay"
  },
  {
    "code": "UZ",
    "name": "Uzbekistan"
  },
  {
    "code": "NH",
    "name": "Vanuatu"
  },
  {
    "code": "VU",
    "name": "Vanuatu"
  },
  {
    "code": "VA",
    "name": "Vatican City"
  },
  {
    "code": "VE",
    "name": "Venezuela"
  },
  {
    "code": "VD",
    "name": "Vietnam"
  },
  {
    "code": "VN",
    "name": "Vietnam"
  },
  {
    "code": "WF",
    "name": "Wallis & Futuna"
  },
  {
    "code": "EH",
    "name": "Western Sahara"
  },
  {
    "code": "YD",
    "name": "Yemen"
  },
  {
    "code": "YE",
    "name": "Yemen"
  },
  {
    "code": "ZM",
    "name": "Zambia"
  },
  {
    "code": "RH",
    "name": "Zimbabwe"
  },
  {
    "code": "ZW",
    "name": "Zimbabwe"
  }
];

export function getCountryName(code) {
  if (!code) return "";
  const c = String(code).trim().toUpperCase();
  if (COUNTRY_NAME_MAP[c]) return COUNTRY_NAME_MAP[c];
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(c);
    if (name && name !== c && !name.includes("Unknown")) return name;
  } catch {}
  return c;
}

/**
 * Fetch latest World Bank Purchasing Power Parity (PPP) conversion factor and official exchange rate.
 * Calculates whole integer tokens per USD $1 = Math.round(exchangeRate / pppFactor).
 * Returns null on timeout or network unavailability so fallback is always seamless.
 */
export async function fetchWorldBankPpp(code) {
  const c = String(code).trim().toUpperCase();
  if (!c || c.length !== 2) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const [pppRes, fxRes] = await Promise.all([
      fetch(`https://api.worldbank.org/v2/country/${c}/indicator/PA.NUS.PPP?format=json`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.worldbank.org/v2/country/${c}/indicator/PA.NUS.FCRF?format=json`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
    ]);
    clearTimeout(timeout);
    const pppEntry = pppRes?.[1]?.find((x) => typeof x.value === "number" && x.value > 0);
    const fxEntry = fxRes?.[1]?.find((x) => typeof x.value === "number" && x.value > 0);
    if (!pppEntry || !fxEntry) return null;
    const ratio = fxEntry.value / pppEntry.value;
    const multiplier = Math.max(1, Math.round(ratio));
    return {
      countryCode: c,
      countryName: pppEntry.country?.value || getCountryName(c),
      tokensPerUsd: multiplier,
      pppFactor: pppEntry.value,
      exchangeRate: fxEntry.value,
      year: pppEntry.date || fxEntry.date,
    };
  } catch {
    return null;
  }
}
