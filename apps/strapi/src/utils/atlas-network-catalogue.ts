// Strapi supports documentId ordering; its generated sort keys omit that built-in field.
const documentOrder: Record<string, "asc"> = { documentId: "asc" }
import {
  atlasLocalGeography,
  type AtlasNetworkPage,
  type AtlasNetworkOption,
  type AtlasNetworkSelection,
  type AtlasProjection,
} from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

export interface NetworkLibrary {
  documentId: string
  location?: { lat: number; lng: number }
  libraryType?: { name: string }
  operationalStatus?: string
  country?: { documentId: string; name: string; iso2?: string }
  locale?: string
}
type NetworkProjection = Pick<
  AtlasProjection,
  | "documentId"
  | "original_lat"
  | "original_lng"
  | "local_area_version"
  | "local_area_code"
>
type GeographyFacet = { documentId: string; name: string }

const NETWORK = "api::library-network.library-network"
const LIBRARY = "api::library.library"
const canonicalLocale = () => process.env.ATLAS_CANONICAL_LOCALE ?? "en"
// Public geography facets are shared by every search string, with bounded retention.
const facets = new Map<
  string,
  { until: number; rows: Promise<GeographyFacet[]> }
>()
function facetRows(
  key: string,
  limit: number,
  load: () => Promise<GeographyFacet[]>
) {
  const known = facets.get(key)
  if (known && known.until > Date.now()) return known.rows
  if (facets.size >= 32) facets.delete(facets.keys().next().value!)
  const rows = load()
    .then((rows) => {
      if (rows.length > limit)
        throw new RangeError("Service geography requires a finer partition")

      return rows
    })
    .catch((error) => {
      facets.delete(key)
      throw error
    })
  facets.set(key, { until: Date.now() + 60000, rows })

  return rows
}

export function networkEligible(row: NetworkLibrary) {
  return (
    !["Mobile", "Digital"].includes(row.libraryType?.name) &&
    !["permanently_closed", "temporarily_closed", "planned"].includes(
      row.operationalStatus
    )
  )
}

/** Reporting units describe the service's mapped locations, not a camera viewport. */
export function describeNetwork(
  network: AtlasNetworkOption,
  rows: NetworkLibrary[],
  projections: NetworkProjection[]
): AtlasNetworkSelection {
  const indexed = new Map(projections.map((row) => [row.documentId, row]))
  const codes = new Set<string>()
  const bounds = { west: 180, east: -180, south: 90, north: -90 }
  let eligible = 0,
    excluded = 0,
    missing = 0
  for (const row of rows) {
    if (!networkEligible(row)) {
      excluded++
      continue
    }
    eligible++
    const { lat, lng } = row.location ?? {}
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      missing++
      continue
    }
    bounds.west = Math.min(bounds.west, lng)
    bounds.east = Math.max(bounds.east, lng)
    bounds.south = Math.min(bounds.south, lat)
    bounds.north = Math.max(bounds.north, lat)
    const projected = indexed.get(row.documentId)
    if (
      projected?.original_lat === lat &&
      projected.original_lng === lng &&
      projected.local_area_version === atlasLocalGeography.version &&
      projected.local_area_code
    ) {
      codes.add(projected.local_area_code)
    } else missing++
  }
  const areaCodes = [...codes]
    .filter((code) =>
      atlasLocalGeography.areas.some((area) => area.code === code)
    )
    .sort()
  const areas = atlasLocalGeography.areas.filter((area) => codes.has(area.code))
  const countries = [
    ...new Map(
      rows.flatMap((row) =>
        row.country?.documentId
          ? [
              [
                row.country.documentId,
                {
                  documentId: row.country.documentId,
                  name: row.country.name,
                },
              ] as const,
            ]
          : []
      )
    ).values(),
  ]

  return {
    documentId: network.documentId,
    name: network.name,
    kind: network.kind,
    bounds: bounds.west <= bounds.east ? bounds : null,
    areaCodes,
    areaName: areas.length === 1 ? areas[0]!.name : network.name,
    eligibleLibraries: eligible,
    excludedLibraries: excluded,
    available:
      eligible > 0 &&
      rows.length <= 250 &&
      missing === 0 &&
      areaCodes.length > 0,
    countries,
  }
}

export async function networkSelection(
  strapi: Core.Strapi,
  network: AtlasNetworkOption,
  rows?: NetworkLibrary[]
) {
  rows ??= (await strapi.documents(LIBRARY).findMany({
    status: "published",
    locale: canonicalLocale(),
    fields: ["documentId", "location", "operationalStatus"],
    filters: { networks: { documentId: network.documentId } },
    limit: 251,
    populate: {
      libraryType: { fields: ["name"] },
      country: { fields: ["name"] },
    },
  })) as unknown as NetworkLibrary[]
  const records = await strapi.db
    .connection("atlas_records")
    .where({ active: true })
    .whereIn(
      "document_id",
      rows!.map((row) => row.documentId)
    )
    .select("projection")
    .limit(251)

  return describeNetwork(
    network,
    rows!,
    records.map((row: { projection: string | NetworkProjection }) =>
      typeof row.projection === "string"
        ? JSON.parse(row.projection)
        : row.projection
    )
  )
}

export function parseNetworkQuery(input: Record<string, unknown>) {
  if (
    Object.keys(input).some(
      (key) => !["q", "country", "region", "after", "selected"].includes(key)
    )
  )
    throw new RangeError("Invalid service search")
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value !== "string" ||
      value.length > (key === "after" ? 600 : key === "q" ? 80 : 100)
    )
      throw new RangeError("Invalid service search")
    values[key] = value.trim()
  }
  for (const key of ["country", "region", "selected"])
    if (values[key] && !/^[a-zA-Z0-9_-]{1,100}$/.test(values[key]!))
      throw new RangeError("Invalid service identity")
  if (values.region && !values.country)
    throw new RangeError("Choose a country first")
  const after = parseNetworkCursor(values.after)

  return {
    q: values.q,
    country: values.country,
    region: values.region,
    selected: values.selected,
    after,
  }
}

export async function atlasNetworkCatalogue(
  strapi: Core.Strapi,
  input: Record<string, unknown> = {}
): Promise<AtlasNetworkPage> {
  const query = parseNetworkQuery(input)
  const empty: AtlasNetworkPage = {
    networks: [],
    countries: [],
    regions: [],
    selected: null,
    next: null,
  }
  if (query.selected) {
    const network = await strapi.documents(NETWORK).findOne({
      documentId: query.selected,
      fields: ["name", "kind"],
    })

    return {
      ...empty,
      selected: network
        ? await networkSelection(strapi, network as AtlasNetworkOption)
        : null,
    }
  }
  const published = {
    publishedAt: { $notNull: true },
    locale: canonicalLocale(),
  }
  const membership = {
    ...published,
    networks: { documentId: { $notNull: true } },
  }
  const filters = {
    libraries: {
      ...published,
      ...(query.country ? { country: { documentId: query.country } } : {}),
      ...(query.region ? { region: { documentId: query.region } } : {}),
    },
    ...(query.q ? { name: { $containsi: query.q } } : {}),
    ...(query.after
      ? {
          $or: [
            { name: { $gt: query.after[0] } },
            { name: query.after[0], documentId: { $gt: query.after[1] } },
          ],
        }
      : {}),
  }
  const [rows, countries, regions] = await Promise.all([
    strapi.documents(NETWORK).findMany({
      fields: ["name", "kind"],
      filters,
      sort: [{ name: "asc" }, documentOrder],
      limit: 26,
    }),
    facetRows(
      `countries:${canonicalLocale()}`,
      512,
      () =>
        strapi.documents("api::country.country").findMany({
          status: "published",
          locale: canonicalLocale(),
          fields: ["name"],
          filters: { libraries: membership },
          sort: "name:asc",
          limit: 513,
        }) as Promise<GeographyFacet[]>
    ),
    query.country
      ? facetRows(
          `regions:${canonicalLocale()}:${query.country}`,
          1000,
          () =>
            strapi.documents("api::region.region").findMany({
              status: "published",
              locale: canonicalLocale(),
              fields: ["name"],
              filters: {
                country: { documentId: query.country },
                libraries: membership,
              },
              sort: "name:asc",
              limit: 1001,
            }) as Promise<GeographyFacet[]>
        )
      : [],
  ])
  if (countries.length > 512 || regions.length > 1000)
    throw new RangeError("Service geography requires a finer partition")
  const networks = rows.slice(0, 25) as AtlasNetworkOption[],
    last = networks.at(-1)

  return {
    ...empty,
    networks,
    countries,
    regions,
    next:
      rows.length > 25 ? JSON.stringify([last.name, last.documentId]) : null,
  }
}

function parseNetworkCursor(
  value: string | undefined
): [string, string] | undefined {
  let after: [string, string] | undefined
  if (value) {
    const decoded = JSON.parse(value)
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      decoded.some((value) => typeof value !== "string" || value.length > 240)
    )
      throw new RangeError("Invalid service cursor")
    after = decoded as [string, string]
  }

  return after
}
