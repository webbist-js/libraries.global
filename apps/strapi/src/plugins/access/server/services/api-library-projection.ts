import { libraryTypeName } from "@repo/shared-data"
import type { Core, UID } from "@strapi/strapi"

import type { DocumentStore } from "../../../../utils/document-store"

/**
 * The published-field projection for machine API Library records, shared by
 * the library, place and service-membership bridge routes. Only these fields
 * leave the CMS; source notes and private staff fields never do.
 */
export const API_LIBRARY_FIELDS = [
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "operationalStatus",
  "operatorType",
  "streetAddress",
  "city",
  "postalCode",
  "location",
  "timezone",
  "website",
  "phone",
  "email",
  "catalogueUrl",
  "updatedAt",
]
const SOURCE_FIELDS = [
  "dataset",
  "recordId",
  "retrievedAt",
  "url",
  "label",
  "role",
  "fields",
]

export const API_DATASET_FIELDS = [
  "key",
  "publisher",
  "licence",
  "licenceUrl",
  "attribution",
  "redistribution",
  "licenceStatus",
]
export const API_LIBRARY_POPULATE = {
  libraryType: { fields: ["name"] },
  country: { fields: ["name", "slug", "iso2"] },
  region: { fields: ["name", "slug"] },
  area: { fields: ["name", "slug"] },
  sourceRecords: true,
}

type ApiRecord = Record<string, unknown>
type ApiSourceRecord = ApiRecord & { dataset?: string | null }

export type ApiLibraryRow = ApiRecord & {
  documentId: string
  libraryType?: unknown
  country?: ApiRecord | null
  region?: ApiRecord | null
  area?: ApiRecord | null
  sourceRecords?: ApiSourceRecord[] | null
}
export type ApiDatasetRow = ApiRecord & {
  key: string
  publisher?: string | null
  licence?: string | null
  licenceUrl?: string | null
  attribution?: string | null
}

/** A Document Service store typed by the fields this projection reads. */
export const apiStore = <Row>(strapi: Core.Strapi, uid: UID.ContentType) =>
  strapi.documents(uid) as unknown as DocumentStore<Row>

export const pickFields = (
  row: ApiRecord | null | undefined,
  fields: string[]
) => Object.fromEntries(fields.map((field) => [field, row?.[field] ?? null]))

/** Project a page of library rows, crediting each source record's Dataset. */
export async function projectApiLibraries(
  strapi: Core.Strapi,
  rows: ApiLibraryRow[]
) {
  const datasetKeys = [
    ...new Set(
      rows.flatMap((row) =>
        (row.sourceRecords ?? [])
          .map((source) => source.dataset)
          .filter(Boolean)
      )
    ),
  ]
  const datasets = datasetKeys.length
    ? await apiStore<ApiDatasetRow>(strapi, "api::dataset.dataset").findMany({
        filters: { key: { $in: datasetKeys } },
        fields: API_DATASET_FIELDS,
        limit: 100,
      })
    : []
  const credits = new Map(
    datasets.map((dataset) => [
      dataset.key,
      pickFields(dataset, API_DATASET_FIELDS),
    ])
  )

  return rows.map((row) => ({
    documentId: row.documentId,
    ...pickFields(row, API_LIBRARY_FIELDS),
    libraryType: libraryTypeName(row.libraryType),
    country: row.country
      ? pickFields(row.country, ["name", "slug", "iso2"])
      : null,
    region: row.region ? pickFields(row.region, ["name", "slug"]) : null,
    area: row.area ? pickFields(row.area, ["name", "slug"]) : null,
    sourceRecords: (row.sourceRecords ?? []).map((source) => ({
      ...pickFields(source, SOURCE_FIELDS),
      datasetCredit: credits.get(source.dataset) ?? null,
    })),
  }))
}
