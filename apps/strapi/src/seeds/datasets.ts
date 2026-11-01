import type { Core } from "@strapi/strapi"

import { EUROPE_LIBRARY_DATASETS } from "./europe-library-datasets"

import canadaOdcaf from "./canada-odcaf-dataset.json"
import mexicoSic from "./mexico-sic-dataset.json"
import openStreetMap from "./openstreetmap-dataset.json"

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
  ...EUROPE_LIBRARY_DATASETS,
  openStreetMap as DatasetSeed,
  mexicoSic as DatasetSeed,
  canadaOdcaf as DatasetSeed,
  {
    key: "openstreetmap-routing",
    name: "OpenStreetMap walking and cycling network",
    publisher: "OpenStreetMap contributors; extracts by Geofabrik",
    sourceUrl: "https://download.geofabrik.de",
    licence: "ODbL 1.0",
    licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Routing derived from © OpenStreetMap contributors, ODbL 1.0; regional extracts from Geofabrik.",
    coverage:
      "Configured regional routing extracts; the active analysis release defines origin coverage.",
    importMechanism:
      "Versioned OSM PBF snapshots and native Valhalla graph preparation through the Atlas data profile.",
    notes:
      "Network snapshots, engine/profile versions and coverage belong to immutable analysis releases. Walking estimates do not establish step-free access. Graphs are files, not CMS Library records.",
  },
  {
    key: "ghsl-population",
    name: "GHS-POP R2023A residential population grid",
    publisher: "European Commission Joint Research Centre",
    sourceUrl:
      "https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Schiavina M., Freire S., Carioli A., MacManus K. (2023), GHS-POP R2023A, European Commission Joint Research Centre. Data accessed through the JRC-managed AWS Open Data distribution, CC BY 4.0.",
    coverage:
      "Global source; active analysis releases prepare only the required regional windows.",
    importMechanism:
      "Bounded HTTP-range reads from the JRC population count raster; versioned regional files and validated population intersections.",
    notes:
      "The initial Reach surface uses native 2020 estimates at 100 m in Mollweide coordinates. It does not overwrite ONS/World Bank administrative totals. Later projected epochs must be labelled as projections. Zero and NoData are distinct.",
  },
  {
    key: "au-public-libraries",
    name: "Australian public lending library locations (2016–2018)",
    publisher: "Carl Higgs / RMIT University",
    sourceUrl: "https://doi.org/10.25439/rmt.21944840.v1",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Library locations adapted from Carl Higgs, Australian public lending library locations (2016–2018), RMIT University, DOI 10.25439/rmt.21944840.v1, CC BY-SA 4.0. Original data credited to Libraries ACT, State Library of NSW, Libraries Tasmania, Department of Premier and Cabinet (Victoria), and State Library of Western Australia.",
    coverage:
      "Historical public libraries in ACT, NSW, Tasmania, Victoria and Western Australia. Queensland is imported from its separate 2026 directory. South Australian and Northern Territory rows are excluded because upstream republication terms are not established.",
    importMechanism:
      "pnpm ingest --dataset=au-public-libraries; cached versioned CSV and publisher metadata, existing state/territory relations, resumable draft writes.",
    notes:
      "Locations describe 2016–2018 and do not establish present operation; every operational status is unknown. Individual source_licence values must explicitly state CC BY. Bookmobile base pins are omitted. Older Queensland rows are excluded to avoid duplicating the current directory. No opening schedules or personal contacts are imported.",
  },
  {
    key: "slq-directory",
    name: "Queensland public libraries directory (2026)",
    publisher: "State Library of Queensland",
    sourceUrl: "https://www.data.qld.gov.au/dataset/public-libraries",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Library directory information from the State Library of Queensland, Queensland Public Libraries 2026, CC BY 4.0. Libraries Global normalizes repeated URL prefixes and omits unsupported schedules and mobile base pins.",
    coverage:
      "Public-library branches in Queensland, from the 2026 published resource.",
    importMechanism:
      "pnpm ingest --dataset=slq-directory; complete CKAN datastore pagination, cached snapshot, stable directory paths as identities, existing Queensland placement.",
    notes:
      "The published CSV download currently returns no bytes, so the adapter reads the same resource through CKAN's structured API and verifies its total and unique row IDs. Directory paths identify records; datastore row numbers do not. Free-text hours are not interpreted as daily schedules; operational status remains unknown.",
  },
  {
    key: "fr-culture-libraries",
    name: "French public libraries: addresses and activity data",
    publisher: "Ministère de la Culture, Service du Livre et de la Lecture",
    sourceUrl:
      "https://www.data.gouv.fr/datasets/adresses-des-bibliotheques-publiques-2",
    licence: "Licence Ouverte / Open Licence 2.0",
    licenceUrl: "https://www.data.gouv.fr/pages/legal/licences/etalab-2.0",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Source: Ministère de la Culture, Les bibliothèques des collectivités territoriales : adresses et données d’activité, addresses at 5 June 2025 and activity data for 2023, Licence Ouverte 2.0. Libraries Global maps visitor buildings and bookmobiles to existing regions and departments.",
    coverage:
      "Metropolitan France. Administrative-only sites, closed-to-public reserves, unspecified sites and overseas atlas countries are excluded from this adapter.",
    importMechanism:
      "pnpm ingest --dataset=fr-culture-libraries; versioned complete JSON snapshot, stable code_bib IDs, existing region/department matching and resumable draft writes.",
    notes:
      "The dataset has 15,704 rows, including locations that are not visitor libraries. Only type_adresse Bâtiment ouvert and Bibliobus are imported. Status stays unknown because the address snapshot does not establish present operation. Weekly opening totals are not daily hours; activity statistics and commune populations are not transferred onto library records. Mobile base coordinates are omitted.",
  },
  {
    key: "nkp-cadr",
    name: "Central Directory of Libraries and Information Institutions in Czechia (CADR)",
    publisher: "Národní knihovna České republiky",
    sourceUrl:
      "https://www.nkp.cz/en/about-us/professional-activities/open-data",
    licence: "CC0 1.0",
    licenceUrl:
      "https://www.nkp.cz/en/about-us/professional-activities/open-data",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted",
    attribution:
      "Institutional facts from the National Library of the Czech Republic, Central Directory of Libraries and Information Institutions (CADR), CC0 1.0. Libraries Global maps SIGLA identities, types, addresses and geographic fields; personal contacts and free-text schedules are omitted.",
    coverage:
      "Active directory institutions in Czechia with a SIGLA identity, readable name and region. Entries marked closed or missing in STT are excluded.",
    importMechanism:
      "pnpm ingest --dataset=nkp-cadr; complete weekly MARC XML export parsed using Python 3's standard XML parser, cached institutional fields, region/district matching and resumable draft writes.",
    notes:
      "The publisher explicitly dedicates CADR to CC0. SIGLA, rather than an address or institution name, identifies each source record. Academic and other institutions may have separate departments or services at one address; full hierarchical names are retained. Multiple-address institutions have no inferred map pin. Existing contributor edits are preserved on replay, and present operational status remains unknown.",
  },
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
      "scripts/ingests/run.ts --dataset=libraryon --country=GB-ENG|GB-WLS|GB-SCT|GB-NIR: complete versioned API snapshots, current ONS district placement and reviewable refresh proposals. scripts/ingests/uk/libraryon-networks.ts adds sourced network memberships without replacing curated library facts.",
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
