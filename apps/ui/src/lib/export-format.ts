/**
 * Pure builders for the Pro Atlas export: CSV and GeoJSON. No Next or server
 * imports, so the route and the tests share them. The route supplies the rows
 * (read from our own dataset, never from the client) and the page-URL builder.
 */
import type { AtlasLibrary } from "@/components/atlas/atlas.logic"

/** Sent with every export, as a header and on the GeoJSON collection. */
export const EXPORT_ATTRIBUTION =
  "libraries.global contributors; see /knowledge for licences"

/** Most ids one export request may carry, whatever the plan's row cap. */
export const MAX_EXPORT_IDS = 10_000

export type Cell = string | number | null | undefined

/**
 * The export's columns, in file order. Only fields GET /api/libraries/atlas
 * returns: it has no street address, website, phone or email.
 */
export const ATLAS_EXPORT_COLUMNS = [
  "name",
  "slug",
  "libraryType",
  "operationalStatus",
  "city",
  "region",
  "country",
  "lat",
  "lng",
  "url",
] as const

export type AtlasExportColumn = (typeof ATLAS_EXPORT_COLUMNS)[number]
export type AtlasExportRow = Record<AtlasExportColumn, Cell>

/** One export row for an Atlas library; `pageUrl` makes its path absolute. */
export function atlasExportRow(
  lib: AtlasLibrary,
  pageUrl: (path: string) => string
): AtlasExportRow {
  return {
    name: lib.name,
    slug: lib.slug,
    libraryType: lib.type,
    operationalStatus: lib.status,
    city: lib.city,
    region: lib.region,
    country: lib.country,
    lat: lib.lat,
    lng: lib.lng,
    url: lib.path ? pageUrl(lib.path) : null,
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
