import { libraryTypeName } from "@repo/shared-data"

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
export const pickFields = (row: any, fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, row?.[field] ?? null]))

/** Project a page of library rows, crediting each source record's Dataset. */
export async function projectApiLibraries(strapi: any, rows: any[]) {
  const datasetKeys = [
    ...new Set(
      rows.flatMap((row: any) =>
        (row.sourceRecords ?? [])
          .map((source: any) => source.dataset)
          .filter(Boolean)
      )
    ),
  ]
  const datasets = datasetKeys.length
    ? await strapi.documents("api::dataset.dataset").findMany({
        filters: { key: { $in: datasetKeys } },
        fields: API_DATASET_FIELDS,
        limit: 100,
      })
    : []
  const credits = new Map(
    datasets.map((dataset: any) => [
      dataset.key,
      pickFields(dataset, API_DATASET_FIELDS),
    ])
  )

  return rows.map((row: any) => ({
    documentId: row.documentId,
    ...pickFields(row, API_LIBRARY_FIELDS),
    libraryType: libraryTypeName(row.libraryType),
    country: row.country
      ? pickFields(row.country, ["name", "slug", "iso2"])
      : null,
    region: row.region ? pickFields(row.region, ["name", "slug"]) : null,
    area: row.area ? pickFields(row.area, ["name", "slug"]) : null,
    sourceRecords: (row.sourceRecords ?? []).map((source: any) => ({
      ...pickFields(source, SOURCE_FIELDS),
      datasetCredit: credits.get(source.dataset) ?? null,
    })),
  }))
}
