import { createHash } from "node:crypto"

import {
  NETWORK_LIMITS,
  FACILITY_CHECKLIST,
  publicSourceUrl,
  type NetworkSummary,
  widgetText,
} from "@repo/shared-data"

import {
  NETWORK,
  networkLibraries,
  networkPopulate,
  networkStore,
  publicNetworkFilter,
  type NetworkRecord,
} from "./network-records"
import { projectWidgetLibrary } from "./widget-library-projection"
import type {
  RecordInput,
  DocumentRuntime,
} from "../../../../utils/document-store"
import { AccessError } from "../utils/admin"

export const membershipRevision = (ids: string[]) =>
  createHash("sha256")
    .update([...ids].sort().join("\n"))
    .digest("hex")
export const networkVisible = (row: NetworkRecord) =>
  !!row.publicPageEnabled && !!row.publicPageReviewedAt
export async function loadNetwork(
  strapi: DocumentRuntime,
  id: string,
  publicOnly = false
) {
  const row = await networkStore<NetworkRecord>(strapi, NETWORK).findFirst({
    filters: {
      $or: [{ documentId: id }, { slug: id }],
      ...(publicOnly ? publicNetworkFilter : {}),
    },
    populate: networkPopulate,
  })
  if (!row) throw new AccessError(404, "network_unavailable")

  return row
}
export async function memberIds(strapi: DocumentRuntime, networkId: string) {
  const rows = await networkLibraries(strapi).findMany({
    filters: { networks: { documentId: networkId } },
    status: "published",
    locale: "en",
    fields: ["documentId"],
    sort: "documentId:asc",
    limit: NETWORK_LIMITS.libraries + 1,
  })
  if (rows.length > NETWORK_LIMITS.libraries)
    throw new AccessError(422, "network_scope_too_large")

  return rows.map((row) => row.documentId)
}
export async function networkSummary(
  strapi: DocumentRuntime,
  row: NetworkRecord
): Promise<NetworkSummary> {
  const libraryCount = await networkLibraries(strapi).count({
    filters: { networks: { documentId: row.documentId } },
    status: "published",
    locale: "en",
  })

  return {
    documentId: row.documentId,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    description: row.description ?? "",
    website: publicSourceUrl(row.website),
    sourceUrl: publicSourceUrl(row.sourceUrl),
    lastVerifiedAt: row.lastVerifiedAt ?? null,
    countries: (row.countries ?? []).map((c) => ({
      documentId: c.documentId,
      name: c.name,
      slug: c.slug,
      continentSlug: c.continent?.slug ?? null,
    })),
    libraryCount,
  }
}
const pageNumber = (value: unknown) =>
  Math.max(1, Math.min(10000, Number.parseInt(String(value ?? 1), 10) || 1))

async function geographicFilters(strapi: DocumentRuntime, country: unknown) {
  type Place = { name: string; slug: string }
  const [countries, regions] = await Promise.all([
    networkStore<Place>(strapi, "api::country.country").findMany({
      locale: "en",
      status: "published",
      fields: ["name", "slug"],
      sort: "name:asc",
      limit: 512,
    }),
    country
      ? networkStore<Place>(strapi, "api::region.region").findMany({
          filters: { country: { slug: widgetText(country, 120) } },
          locale: "en",
          status: "published",
          fields: ["name", "slug"],
          sort: "name:asc",
          limit: 1000,
        })
      : Promise.resolve([]),
  ])

  return { countries, regions }
}

export async function listNetworks(
  strapi: DocumentRuntime,
  query: RecordInput,
  publicOnly = true
) {
  const page = pageNumber(query.page),
    q = widgetText(query.q ?? "", 120),
    filters: RecordInput = publicOnly ? { ...publicNetworkFilter } : {}
  if (q) filters.name = { $containsi: q }
  if (query.kind) filters.kind = widgetText(query.kind, 50)
  if (query.country)
    filters.countries = { slug: widgetText(query.country, 120) }
  if (query.libraryId)
    filters.libraries = { documentId: widgetText(query.libraryId, 32) }
  if (query.region)
    filters.libraries = { region: { slug: widgetText(query.region, 120) } }
  const rows = await networkStore<NetworkRecord>(strapi, NETWORK).findMany({
    filters,
    populate: networkPopulate,
    sort: ["name:asc", "documentId:asc"],
    start: (page - 1) * 24,
    limit: 24,
  })
  const total = await networkStore<NetworkRecord>(strapi, NETWORK).count({
    filters,
  })

  return {
    ...(await geographicFilters(strapi, query.country)),
    networks: await Promise.all(rows.map((row) => networkSummary(strapi, row))),
    page,
    total,
    pageSize: 24,
  }
}
export async function networkDetail(
  strapi: DocumentRuntime,
  id: string,
  query: RecordInput,
  publicOnly = true
) {
  const row = await loadNetwork(strapi, id, publicOnly),
    page = pageNumber(query.page)
  const base = { networks: { documentId: row.documentId } }
  const filters: RecordInput = { ...base }
  const q = widgetText(query.q ?? "", 120).trim()
  if (q)
    filters.$or = ["name", "city", "streetAddress"].map((field) => ({
      [field]: { $containsi: q },
    }))
  if (query.country) filters.country = { slug: widgetText(query.country, 120) }
  if (query.region) filters.region = { slug: widgetText(query.region, 120) }
  if (query.type) filters.libraryType = { name: widgetText(query.type, 80) }
  const requested = new Set(String(query.facility ?? "").split(","))
  const facilities = FACILITY_CHECKLIST.filter((item) =>
    requested.has(item.label)
  )
  if (facilities.length)
    filters.$and = facilities.map((item) => ({
      [{
        amenity: "amenities",
        service: "services",
        accessibility: "accessibility",
      }[item.collection]]: { name: item.name },
    }))
  const sort =
    query.sort === "name-desc"
      ? ["name:desc", "documentId:asc"]
      : query.sort === "updated"
        ? ["updatedAt:desc", "documentId:asc"]
        : ["name:asc", "documentId:asc"]
  // Facets belong to the whole network, independently of page and active filters.
  const [total, facetRows, libraries] = await Promise.all([
    networkLibraries(strapi).count({
      filters,
      status: "published",
      locale: "en",
    }),
    networkLibraries(strapi).findMany({
      filters: base,
      status: "published",
      locale: "en",
      fields: ["documentId"],
      populate: {
        country: { fields: ["name", "slug"] },
        region: { fields: ["name", "slug"] },
        libraryType: { fields: ["name"] },
      },
      limit: NETWORK_LIMITS.libraries,
    }),
    networkLibraries(strapi).findMany({
      filters,
      status: "published",
      locale: "en",
      populate: {
        country: { fields: ["name", "slug"] },
        continent: { fields: ["slug"] },
        region: { fields: ["name", "slug"] },
        libraryType: { fields: ["name"] },
        accessibility: { fields: ["name"] },
        amenities: { fields: ["name"] },
        services: { fields: ["name"] },
      },
      sort,
      start: (page - 1) * 48,
      limit: 48,
    }),
  ])
  const places = (key: "country" | "region") =>
    [
      ...new Map(
        facetRows.flatMap((library) => {
          const place = library[key] as
            | { name?: string; slug: string }
            | undefined

          return place?.slug
            ? [
                [
                  place.slug,
                  { slug: place.slug, name: place.name || place.slug },
                ] as const,
              ]
            : []
        })
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name))

  return {
    network: await networkSummary(strapi, row),
    total,
    facets: {
      countries: places("country"),
      regions: places("region"),
      types: [
        ...new Set(
          facetRows.flatMap((library) =>
            library.libraryType?.name ? [library.libraryType.name] : []
          )
        ),
      ].sort(),
    },
    libraries: libraries.map((library) =>
      projectWidgetLibrary(library, [row.name])
    ),
    page,
    pageSize: 48,
  }
}
