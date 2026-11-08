import type { ExpansionFeed } from "./expansion-contract"

export const EXPANSION_FEEDS: ExpansionFeed[] = [
  {
    key: "lv-kisc-libraries",
    country: "LV",
    folder: "latvia/kisc",
    format: "csv",
    pins: true,
    download:
      "https://data.gov.lv/dati/lv/dataset/6d564a05-1d8c-49b8-835f-c969c61da182/resource/92af15f3-9674-426e-925c-86c6254baa0d/download/objektusaraksts.csv",
    coverage:
      "Latvian cultural institutions filtered to Bibliotēkas; includes public, school, academic and special libraries.",
  },
  {
    key: "tw-nlpi-libraries",
    country: "TW",
    folder: "taiwan/nlpi",
    format: "json",
    pins: true,
    download: "https://plisnet.nlpi.edu.tw/api/API/LibraryInfoData",
    coverage:
      "Taiwan public libraries, grouped by source county/city; not all library types.",
  },
  {
    key: "sg-nlb-libraries",
    country: "SG",
    folder: "singapore/nlb",
    format: "json",
    pins: true,
    download:
      "https://api-open.data.gov.sg/v1/public/api/datasets/d_27b8dae65d9ca1539e14d09578b17cbf/poll-download",
    coverage:
      "NLB library locations; download the GeoJSON at the poll response URL, not the poll response itself.",
  },
  {
    key: "be-fwb-libraries",
    country: "BE",
    folder: "belgium/fwb",
    format: "json",
    pins: true,
    download:
      "https://www.odwb.be/api/explore/v2.1/catalog/datasets/les-bibliotheques-publiques-en-federation-wallonie-bruxelles/exports/json",
    coverage:
      "Recognised French-community libraries and branches; regional Belgian coverage only.",
  },
  {
    key: "at-vienna-libraries",
    country: "AT",
    folder: "austria/vienna",
    format: "json",
    pins: true,
    download:
      "https://data.wien.gv.at/daten/geo?service=WFS&version=1.1.0&request=GetFeature&typeName=ogdwien:BUECHEREIOGD&outputFormat=json&srsName=EPSG:4326",
    coverage: "Vienna municipal library locations only.",
  },
  {
    key: "at-graz-libraries",
    country: "AT",
    folder: "austria/graz",
    format: "json",
    pins: true,
    download:
      "https://geodaten.graz.at/arcgis/rest/services/OGD/OGD_WFS/MapServer/23/query?where=1%3D1&outFields=*&outSR=4326&f=json",
    coverage:
      "Graz library layer, including university libraries; not restricted to municipal branches.",
  },
  {
    key: "br-snbp-cadastro",
    country: "BR",
    folder: "brazil/snbp-cadastro",
    format: "xlsx",
    pins: false,
    download:
      "https://dados.cultura.gov.br/dataset/7d493fc6-e9b0-42d2-862b-161a9a0dd78d/resource/c8d4adaa-63fb-40f1-b9a5-0aebd07af280/download/cadastrodebibliotecas-snbp2025-2026.xlsx",
    coverage:
      "SNBP 2025–2026 public and community library register; incomplete national coverage and no coordinates.",
  },
  {
    key: "nl-wikidata-libraries",
    country: "NL",
    folder: "netherlands/wikidata",
    format: "json",
    pins: false,
    download: "https://query.wikidata.org/sparql",
    coverage:
      "Wikidata library institutions in the Netherlands; incomplete, potentially stale branch records.",
  },
  {
    key: "nz-wikidata-libraries",
    country: "NZ",
    folder: "new-zealand/wikidata",
    format: "json",
    pins: false,
    download: "https://query.wikidata.org/sparql",
    coverage:
      "Wikidata library institutions in New Zealand; incomplete national coverage. No Wikidata coordinates imported.",
  },
  {
    key: "ke-alva",
    country: "KE",
    folder: "kenya/alva",
    format: "csv",
    pins: false,
    download: "https://osf.io/download/tz59a/",
    coverage:
      "Kenya subset of ALVA library20220428.csv; historical public/community and other libraries, not a census.",
  },
]

/** No LIMIT: operators must save the complete JSON result, not a UI preview. */
export function expansionWikidataQuery(country: "NL" | "NZ") {
  const entity = country === "NL" ? "Q55" : "Q664"
  const language = country === "NL" ? "nl,en" : "en,mi"

  return `SELECT ?library ?country ?libraryLabel ?address ?website ?placeLabel ?kind WHERE {
  VALUES ?country { wd:${entity} }
  ?library wdt:P17 ?country; wdt:P31/wdt:P279* wd:Q7075.
  FILTER NOT EXISTS { ?library wdt:P576 ?end }
  FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q212805 }
  FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q28324850 }
  FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q720920 }
  OPTIONAL { ?library wdt:P6375 ?address }
  OPTIONAL { ?library wdt:P856 ?website }
  OPTIONAL { ?library wdt:P131 ?place }
  OPTIONAL { VALUES ?kind { wd:Q28564 wd:Q1622062 wd:Q856234 wd:Q22806 } ?library wdt:P31/wdt:P279* ?kind }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${language}" }
} ORDER BY ?library`
}
