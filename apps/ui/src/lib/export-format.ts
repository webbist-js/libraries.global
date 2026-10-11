/**
 * Pure encoders for the Pro Atlas export: CSV and GeoJSON, as generators of
 * text chunks the route streams. No Next or server imports, so the route and
 * the tests share them. The route supplies the rows (read from our own
 * dataset, never from the client) and the page-URL builder.
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

/** Rows per chunk the encoders yield, so a big file is written in pieces. */
export const EXPORT_CHUNK_ROWS = 500

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
  "sourceRecords",
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
  sourceRecords?: unknown[]
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
    sourceRecords: JSON.stringify(lib.sourceRecords ?? []),
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

const csvRecord = (cells: readonly Cell[]) =>
  `${cells.map((cell) => csvCell(cell)).join(",")}\r\n`

/**
 * The rows `encode`d and joined, EXPORT_CHUNK_ROWS at a time. Rows `encode`
 * turns into null are skipped. Rows are read only as chunks are asked for.
 */
function* batches<R>(
  rows: Iterable<R>,
  encode: (row: R) => string | null
): Generator<string, void, undefined> {
  let batch = ""
  let count = 0
  for (const row of rows) {
    const text = encode(row)
    if (text === null) continue
    batch += text
    count += 1
    if (count === EXPORT_CHUNK_ROWS) {
      yield batch
      batch = ""
      count = 0
    }
  }
  if (batch) yield batch
}

// A UTF-8 byte-order mark, so Excel on Windows reads non-ASCII names right.
const BOM = "\uFEFF"

/**
 * RFC 4180 CSV in chunks: the byte-order mark and a header row in `columns`
 * order, then the rows in batches.
 */
export function* csvChunks<C extends string>(
  rows: Iterable<Partial<Record<C, Cell>>>,
  columns: readonly C[]
): Generator<string, void, undefined> {
  yield BOM + csvRecord(columns)
  yield* batches(rows, (row) => csvRecord(columns.map((c) => row[c])))
}

type ExportFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: Record<string, string | number | null>
}

const isCoordinate = (v: Cell): v is number =>
  typeof v === "number" && Number.isFinite(v)

/** A point at [lng, lat], or null without both coordinates. */
function toFeature(row: Record<string, Cell>): ExportFeature | null {
  const { lat, lng, ...rest } = row
  if (!isCoordinate(lat) || !isCoordinate(lng)) return null
  const properties = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, v ?? null])
  )

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties,
  }
}

/**
 * A GeoJSON FeatureCollection in chunks: the opening with the attribution,
 * the features in batches, then the close. Rows without both coordinates are
 * skipped.
 */
export function* geoJsonChunks(
  rows: Iterable<Record<string, Cell>>
): Generator<string, void, undefined> {
  yield `{"type":"FeatureCollection","attribution":${JSON.stringify(EXPORT_ATTRIBUTION)},"features":[`
  let separator = ""
  yield* batches(rows, (row) => {
    const feature = toFeature(row)
    if (!feature) return null
    const text = separator + JSON.stringify(feature)
    separator = ","

    return text
  })
  yield "]}"
}
