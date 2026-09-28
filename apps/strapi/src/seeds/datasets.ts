import type { Core } from "@strapi/strapi"

/**
 * The datasets Libraries Global imports, so every imported record can be
 * traced to a publisher and a licence. A record points at its dataset through
 * its `source` string (library.source, catalogue.source), which must equal a
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
    key: "librarieshacked",
    name: "Libraries Hacked UK library service catalogues",
    publisher: "Libraries Hacked",
    sourceUrl: "https://github.com/LibrariesHacked/catalogues-library",
    licence: "MIT",
    licenceUrl: "https://opensource.org/license/mit",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Contains data from catalogues-library by Libraries Hacked, used under the MIT licence.",
    coverage: "UK public library services and their online catalogues",
    importMechanism:
      "packages/catalogues/src/data/librarieshacked-uk-services.json (upstream data/data.json, unmodified), imported on boot by seedCatalogues in apps/strapi/src/index.ts",
    notes:
      'Ported from upstream commit 443861d49c174f0dd181864d69be7b68f7686ff9; the full notice is in packages/catalogues/NOTICE. These records are catalogues (catalogue.source = "librarieshacked"), not libraries.',
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
