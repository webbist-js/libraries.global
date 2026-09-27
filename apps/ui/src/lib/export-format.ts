/**
 * Pure builders for the Pro Atlas export: CSV and GeoJSON. No Next or server
 * imports, so the route and the tests share them. The route supplies the rows
 * (read from our own dataset, never from the client) and the page-URL builder.
 */
import { buildLibraryPath } from "@/lib/library-helpers"

/** Sent with every export, as a header and on the GeoJSON collection. */
export const EXPORT_ATTRIBUTION =
  "libraries.global contributors; see /knowledge for licences"

/**
 * Most ids one export request may carry: the largest plan's row cap (Team).
 * Each plan's own, smaller cap is enforced separately from `limits.exportRows`.
 */
export const MAX_EXPORT_IDS = 50_000

export type Cell = string | number | null | undefined

/**
 * The export's columns, in file order.
 */
export const ATLAS_EXPORT_COLUMNS = [
  "name",
  "slug",
  "libraryType",
  "operationalStatus",
  "streetAddress",
  "city",
  "region",
  "country",
  "lat",
  "lng",
  "website",
  "phone",
  "email",
  "url",
] as const

export type AtlasExportColumn = (typeof ATLAS_EXPORT_COLUMNS)[number]
export type AtlasExportRow = Record<AtlasExportColumn, Cell>

/** One library row as the Strapi bridge (`POST /api/libraries/export`) returns it. */
export type LibraryExportSource = {
  name: string | null
  slug: string | null
  libraryType: string | null
  operationalStatus: string | null
  streetAddress: string | null
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  website: string | null
  phone: string | null
  email: string | null
  continentSlug: string | null
  countrySlug: string | null
  regionSlug: string | null
}

/**
 * One export row for a library; `pageUrl` makes its path absolute. `url` is
 * built from the three location slugs with the same helper the library
 * detail page uses, so it's null when any of them (or the slug) is missing.
 */
export function atlasExportRow(
  lib: LibraryExportSource,
  pageUrl: (path: string) => string
): AtlasExportRow {
  const path = buildLibraryPath({
    slug: lib.slug,
    continent: { slug: lib.continentSlug },
    country: { slug: lib.countrySlug },
    region: { slug: lib.regionSlug },
  })

  return {
    name: lib.name,
    slug: lib.slug,
    libraryType: lib.libraryType,
    operationalStatus: lib.operationalStatus,
    streetAddress: lib.streetAddress,
    city: lib.city,
    region: lib.region,
    country: lib.country,
    lat: lib.lat,
    lng: lib.lng,
    website: lib.website,
    phone: lib.phone,
    email: lib.email,
    url: path ? pageUrl(path) : null,
  }
}

// Spreadsheets run cells that start with these as formulas (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\r\n]/

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ""
  // A number can't carry a formula, and a quote would break negative
  // coordinates, so numbers are written as they are.
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : ""
  const safe = FORMULA_START.test(value) ? `'${value}` : value

  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** RFC 4180 CSV: a header row in `columns` order, then one row per record. */
export function toCsv<C extends string>(
  rows: readonly Partial<Record<C, Cell>>[],
  columns: readonly C[]
): string {
  const records = [
    columns.map((c) => csvCell(c)),
    ...rows.map((row) => columns.map((c) => csvCell(row[c]))),
  ]

  return records.map((cells) => `${cells.join(",")}\r\n`).join("")
}

export type ExportFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: Record<string, string | number | null>
}

export type ExportFeatureCollection = {
  type: "FeatureCollection"
  attribution: string
  features: ExportFeature[]
}

const isCoordinate = (v: Cell): v is number =>
  typeof v === "number" && Number.isFinite(v)

/** Point features at [lng, lat]; rows without both coordinates are skipped. */
export function toGeoJson(
  rows: readonly Record<string, Cell>[],
  attribution: string = EXPORT_ATTRIBUTION
): ExportFeatureCollection {
  const features = rows.flatMap((row): ExportFeature[] => {
    const { lat, lng, ...rest } = row
    if (!isCoordinate(lat) || !isCoordinate(lng)) return []
    const properties = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v ?? null])
    )

    return [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties,
      },
    ]
  })

  return { type: "FeatureCollection", attribution, features }
}
