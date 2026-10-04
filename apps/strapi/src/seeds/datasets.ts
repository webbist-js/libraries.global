import type { Core } from "@strapi/strapi"

/**
 * The datasets Libraries Global imports, so every imported record can be
 * traced to a publisher and a licence. A record points at its dataset through
 * its `source` string (library.source), which must equal a
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
      'The licence is the one stated in the libraryon.org site footer ("Except where otherwise noted, content on this site is licensed under a Creative Commons Attribution 4.0 International license"). Written confirmation that it covers the API has been requested but not yet received. Imported records carry source "libraryon" and a sourceUrl pointing at the LibraryOn page they came from.',
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
