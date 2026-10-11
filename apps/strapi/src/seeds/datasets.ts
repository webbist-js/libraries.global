import type { Core } from "@strapi/strapi"

/**
 * The datasets Libraries Global imports, so every imported record can be
 * traced to a publisher and a licence. A record points at its dataset through
 * its `sourceRecords[].dataset` key, which must equal a
 * dataset's `key`.
 *
 * Created only when the key is missing, so anything edited in the admin
 * (for example a licence confirmed in writing) is never overwritten.
 */

export type DatasetSeed = {
  key: string
  name: string
  publisher: string
  sourceUrl: string
  licence: string
  licenceUrl: string
  licenceStatus: "confirmed_in_writing" | "stated_by_publisher" | "unconfirmed"
  redistribution:
    | "permitted"
    | "permitted_with_attribution"
    | "not_permitted"
    | "unconfirmed"
  attribution: string
  coverage: string
  importMechanism: string
  notes: string
}

export const DATASET_SEED: DatasetSeed[] = [
  {
    key: "wikidata",
    name: "Wikidata library institutions",
    publisher: "Wikidata contributors",
    sourceUrl: "https://www.wikidata.org/wiki/Wikidata:WikiProject_Libraries",
    licence: "CC0 1.0",
    licenceUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted",
    attribution:
      "Library facts from Wikidata contributors, CC0 1.0. Libraries Global maps institution names, types, coordinates, addresses and current municipality codes; each library links to its original Wikidata entity.",
    coverage:
      "Partial baseline for Sweden, Norway and Denmark. Physical libraries with a readable name and either a current municipality code or usable coordinates; known dissolved institutions, digital libraries and library networks are excluded.",
    importMechanism:
      "pnpm ingest --dataset=wikidata --country=SE|NO|DK in apps/strapi. Cached SPARQL snapshots, official geographic and population validation, shared draft-write pipeline.",
    notes:
      "Wikidata structured data is CC0. This import does not use Wikipedia prose, images, personal contacts or data from unlicensed national directories. Wikidata is a knowledge graph, not a complete live national directory; all operational statuses remain unknown. Multiple rows are grouped by Q identifier; ambiguous current municipalities are reported and skipped. Geographic placement uses current official codes, without interpreting historical library identifiers as municipality codes.",
  },
  {
    key: "scb-population",
    name: "Statistics Sweden population and regional codes",
    publisher: "Statistics Sweden (SCB)",
    sourceUrl: "https://www.scb.se/en/services/open-data-api/",
    licence: "CC0 1.0",
    licenceUrl: "https://www.scb.se/en/services/open-data-api/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted",
    attribution:
      "Source: Statistics Sweden. Population table BefolkningCKM, CC0 1.0. Published country, county and municipality totals are retained; municipality name aliases come from Wikidata under CC0 1.0.",
    coverage:
      "Sweden, 21 counties and 290 municipalities. Population at 31 December 2025, with the table's current geographic codes.",
    importMechanism:
      "Swedish Wikidata ingest reads SCB PxWeb JSON-stat2, selecting total marital status, all ages, both sexes and Population only.",
    notes:
      "From 2025 SCB applies Cell Key Method disclosure control. Published totals can differ from component sums. The ingest verifies complete dimensions and geography, retains the source's published values, records discrepancies and carries the CKM note in population coverage. Existing document text, publication state and older observations are preserved.",
  },
  {
    key: "ssb-population",
    name: "Statistics Norway population and administrative classifications",
    publisher: "Statistics Norway (SSB)",
    sourceUrl: "https://www.ssb.no/en/statbank/table/07459/",
    licence: "CC BY 4.0",
    licenceUrl: "https://www.ssb.no/en/api/pxwebapiv2",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Source: Statistics Norway (SSB), table 07459 and Klass classifications 104 and 131, CC BY 4.0. Libraries Global sums all disjoint age categories for both sexes to calculate each geographic total.",
    coverage:
      "Norway's 15 current counties and 357 municipalities. Population on 1 January 2026; historic counties are retained separately for review.",
    importMechanism:
      "Norwegian Wikidata ingest reads SSB PxWeb and Klass codesAt snapshots dated 2026-01-01, then reconciles municipality, county and national totals.",
    notes:
      "Uses current four-digit municipality codes and their two-digit county prefixes. Expired or unspecified codes are not imported. All 106 age categories and both sexes must be present without suppressed cells; every geographic sum must reconcile before writes. This coverage excludes separately catalogued Svalbard and Jan Mayen.",
  },
  {
    key: "dst-population",
    name: "Statistics Denmark population and reporting areas",
    publisher: "Statistics Denmark",
    sourceUrl: "https://www.statbank.dk/FOLK1A",
    licence: "CC BY 4.0",
    licenceUrl:
      "https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Source: Statistics Denmark – https://www.statbank.dk/FOLK1A, CC BY 4.0. Municipality-to-region links from Wikidata contributors, CC0 1.0; Libraries Global validates the links against the published population totals.",
    coverage:
      "Denmark's five regions, 98 municipalities and Christiansø reporting area. Population on 1 January 2026 (2026Q1). Greenland and the Faroe Islands are separate atlas countries.",
    importMechanism:
      "Danish Wikidata ingest reads StatBank FOLK1A JSON-stat and the current CC0 municipal hierarchy, requiring all regional and national totals to reconcile.",
    notes:
      "Christiansø is outside the 98 municipalities and is retained as an administrative reporting area within Hovedstaden. Published totals are selected for all ages, sexes and marital statuses. The 2027 regional reform is not applied to the 2026 hierarchy. Source links and calculation coverage are retained on population observations.",
  },
  {
    key: "kirjastot-fi",
    name: "Finnish library directory (Kirkanta)",
    publisher: "Kirjastot.fi",
    sourceUrl: "https://api.kirjastot.fi/",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Contains data from Kirjastot.fi, licensed under CC BY 4.0. API documentation: https://api.kirjastot.fi/. Libraries Global maps names, contact details, types and geographic placement from the original records.",
    coverage:
      "Libraries in Finland and Åland: municipal, mobile, university, educational and special libraries. Home delivery services are excluded.",
    importMechanism:
      "pnpm ingest --dataset=kirjastot-fi in apps/strapi; reads complete paginated Kirkanta API v4 snapshots and matches official Statistics Finland municipality classifications.",
    notes:
      "The API documentation explicitly permits adaptation and redistribution under CC BY 4.0 and requires credit to Kirjastot.fi, the licence and a link to its API documentation. Finnish institution names are preserved. Records have source kirjastot-fi and the numeric Kirkanta library ID as their Source Record. Operational status is unknown because live opening status is not permanent operational status. Photos, descriptions, staff details and dated schedules are not imported.",
  },
  {
    key: "statfin-population",
    name: "Statistics Finland population and administrative classifications",
    publisher: "Statistics Finland",
    sourceUrl: "https://stat.fi/en/Statistics/Vaerak",
    licence: "CC BY 4.0",
    licenceUrl:
      "https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Source: Statistics Finland, population structure (table 11ra) and administrative classifications. CC BY 4.0. Libraries Global assigns municipalities to the atlas hierarchy; mainland Finland totals exclude separately catalogued Åland.",
    coverage:
      "Finland's current regions and municipalities; Åland's subregions and municipalities; population on 31 December of the selected year using the table's stated boundary vintage.",
    importMechanism:
      "Finland ingest: official municipality-to-region and municipality-to-subregion classification APIs, with PxWeb JSON-stat2 table 11ra. Population estimates are stored on geographic documents through the shared population storage.",
    notes:
      "The publisher's open-data terms permit copying, adapting and redistribution with attribution. Annual population and boundary vintage are recorded separately. Each region's municipality total and both country totals must reconcile before writes. Finland's atlas population is the complete sum of its mainland regions; Åland is a separate ISO country entry. Existing geographic text, draft edits and publication states are preserved.",
  },
  {
    key: "libraryon",
    name: "LibraryOn",
    publisher: "The British Library",
    sourceUrl: "https://libraryon.org",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Contains information from LibraryOn, published by the British Library under CC BY 4.0.",
    coverage:
      "Public libraries in England, Scotland, Wales and Northern Ireland",
    importMechanism:
      "apps/strapi/scripts/libraryon-ingest.ts, reading the public LibraryOn API (https://libraryon.org/cms/api) and mapping each record with scripts/field-mapper.ts",
    notes:
      'The licence is the one stated in the libraryon.org site footer ("Except where otherwise noted, content on this site is licensed under a Creative Commons Attribution 4.0 International license"). Written confirmation that it covers the API has been requested but not yet received. Imported records carry a sourceRecords entry with dataset "libraryon", role "origin" and the URL of their original LibraryOn page.',
  },
  {
    key: "imls-pls",
    name: "Public Libraries Survey",
    publisher: "Institute of Museum and Library Services",
    sourceUrl:
      "https://www.imls.gov/research-evaluation/surveys/public-libraries-survey-pls",
    licence: "Public domain (US federal government work)",
    licenceUrl: "https://www.usa.gov/government-copyright",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted",
    attribution:
      "Contains data from the Public Libraries Survey, published by the Institute of Museum and Library Services.",
    coverage:
      "Public library outlets (central libraries, branches and bookmobiles) in the 50 US states and the District of Columbia",
    importMechanism:
      "apps/strapi/scripts/ingests/usa/imls-pls/ingest.ts, reading the FY 2023 public-use outlet and administrative entity CSV files (pls_fy2023_csv.zip) and mapping each outlet with map.ts",
    notes:
      'Works of the US federal government have no copyright (17 U.S.C. § 105), and the FY 2023 data file documentation says "all information contained herein is in the public domain and may be used and reprinted without special permission". The FY 2023 file covers the year to mid-2023, so opening status reflects that year. Only values IMLS marks as reported are used; imputed values are dropped. Outlying areas and books-by-mail services are not imported. Records carry source "imls-pls" and a source record whose ID is FSCSKEY-FSCS_SEQ.',
  },
  {
    key: "geonames",
    name: "GeoNames administrative divisions",
    publisher: "GeoNames",
    sourceUrl: "https://www.geonames.org",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Contains place names from GeoNames (geonames.org), licensed under CC BY 4.0.",
    coverage:
      "First- and second-level administrative divisions of every country (third level for Germany)",
    importMechanism:
      "apps/strapi/scripts/ingests/gazetteer/import.ts, reading admin1CodesASCII.txt, admin2Codes.txt and, where a country's Areas are level 3, its country dump",
    notes:
      'Creates Regions and Areas only; libraries are not imported from GeoNames. Imported places carry a geonamesId and sourceAttribution "GeoNames (geonames.org), CC BY 4.0".',
  },
  {
    key: "ons-lad",
    name: "Local Authority Districts",
    publisher: "Office for National Statistics",
    sourceUrl: "https://geoportal.statistics.gov.uk",
    licence: "Open Government Licence v3.0",
    licenceUrl:
      "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Contains public sector information licensed under the Open Government Licence v3.0 (Office for National Statistics).",
    coverage:
      "England's local authority districts, filed under the 48 ceremonial counties",
    importMechanism:
      "apps/strapi/scripts/ingests/gazetteer/import.ts, reading the curated data/england.json",
    notes:
      "District names and GSS codes come from ONS; the district-to-county assignment follows the Lieutenancies Act 1997 as amended.",
  },
]

const UID = "api::dataset.dataset"

/** Create any dataset whose key is missing (idempotent). */
export async function seedDatasets(strapi: Core.Strapi) {
  let created = 0

  for (const seed of DATASET_SEED) {
    const existing = await strapi
      .documents(UID)
      .count({ filters: { key: seed.key } } as any)
    if (existing > 0) continue

    await strapi.documents(UID).create({ data: seed as any })
    created += 1
  }

  if (created > 0) {
    strapi.log.info(`[dataset] Registered ${created} imported dataset(s)`)
  }
}
