import type {
  AtlasDensityArchive,
  AtlasDensityDetail,
  AtlasLibraryDensity,
} from "./library-density"
import type { LibraryNotice } from "../library-notices"
import type { AtlasLibraryAccessResponse } from "./library-access"
import type { AtlasCountryTiles, AtlasPerCapitaResponse } from "./per-capita"

export const ATLAS_SCHEMA_VERSION = 1
export const ATLAS_PROJECTION_VERSION = 1
export const ATLAS_LIMITS = {
  points: 1000,
  cells: 1024,
  densityCells: 2048,
  facetValues: 2048,
  deltaIds: 2000,
  deltaBytes: 256 * 1024,
  listRows: 20,
  reachableDistanceRows: 1000,
  indexBatch: 500,
  exportBatch: 500,
  sourceBatch: 1000,
  projectionBatch: 200,
  backfillBatch: 500,
  selectedOptions: 100,
  optionNameLength: 200,
  searchLength: 80,
  previousPages: 100,
  cursorSeconds: 600,
  cursorBytes: 64 * 1024,
  queryBytes: 256 * 1024,
  placeKeyLength: 32 * 1024,
  maxCellZoom: 12,
  maxDensityCellZoom: 20,
  maxTileZoom: 16,
  tileBytes: 500 * 1024,
  decodedTileBytes: 4 * 1024 * 1024,
} as const

export const ATLAS_TYPE_GROUPS = {
  public: ["Public", "Municipal"],
  academic: ["Academic", "University"],
  national: ["National", "Parliamentary", "State"],
  special: ["Special", "Archive", "Private", "Cultural"],
  mobile: ["Mobile"],
  monastic: ["Monastic"],
  other: ["Digital", "Other"],
} as const

export const ATLAS_OPERATOR_GROUPS = {
  council: ["Municipality", "Regional Government"],
  government: ["National Government"],
  community: ["Community Managed", "Volunteer Managed"],
  university: ["University"],
  religious: ["Religious Institution"],
  charity: ["Private Foundation"],
  independent: ["Independent"],
} as const

export type AtlasTypeGroup = keyof typeof ATLAS_TYPE_GROUPS
export type AtlasOperatorGroup = keyof typeof ATLAS_OPERATOR_GROUPS
export type AtlasAccessibilityView = "matches" | "compare" | "gaps"
export type AtlasPopulation = "listed" | "closures" | "events" | "late"
export const ATLAS_LIST_SORTS = [
  "name",
  "name_desc",
  "place",
  "place_desc",
  "record",
  "record_desc",
  "distance",
] as const
export type AtlasSort = (typeof ATLAS_LIST_SORTS)[number]
export type AtlasPlaceLevel =
  | "continent"
  | "country"
  | "region"
  | "area"
  | "city"
export type AtlasOptionKind = "access" | "service" | "amenity"
export type AtlasRevision = string

export interface AtlasCoordinate {
  lat: number
  lng: number
}
export interface AtlasBounds {
  west: number
  south: number
  east: number
  north: number
}
export interface AtlasPlace {
  documentId: string
  slug: string
  name: string
}
export interface AtlasOption {
  documentId: string
  name: string
  aliases?: readonly string[]
}
export interface AtlasDictionaryEntry {
  code: string
  kind: AtlasOptionKind
  name: string
  aliases: readonly string[]
}
export interface AtlasDictionary {
  version: string
  entries: readonly AtlasDictionaryEntry[]
}

/** Source DTO from the authenticated CMS API, not a public query response. */
export interface AtlasLibrarySource {
  documentId: string
  locale: string
  published: boolean
  name: string
  slug: string
  libraryType?: string | null
  operationalStatus?: string | null
  operatorType?: string | null
  mobileTimetable?: unknown
  city?: string | null
  location?: unknown
  timezone?: string | null
  openingTimes?: unknown
  foundedYear?: string | number | null
  openedYear?: string | number | null
  completeness?: number | null
  hasActiveFeed?: boolean | null
  catalogueUrl?: string | null
  continent?: AtlasPlace | null
  country?: AtlasPlace | null
  region?: AtlasPlace | null
  area?: AtlasPlace | null
  accessibility?: readonly AtlasOption[]
  services?: readonly AtlasOption[]
  amenities?: readonly AtlasOption[]
  networks?: readonly AtlasPlace[]
  notices?: readonly LibraryNotice[]
}

export type AtlasDayShort =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun"
export type AtlasOpeningField =
  `${"open" | "regular_open" | "staff_open"}_${AtlasDayShort}_${number}_${"from" | "to"}`
export type AtlasCellZoom =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
export type AtlasOpeningFields = Partial<Record<AtlasOpeningField, number>>
export type AtlasCellFields = Record<
  `atlas_cell_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`,
  string
> &
  Partial<Record<`atlas_cell_${AtlasCellZoom}`, string>>

/** Flat public read model. This contains no media, staff data or timetable. */
export type AtlasProjection = AtlasOpeningFields &
  AtlasCellFields & {
    atlas_id: number
    documentId: string
    locale: string
    name: string
    slug: string
    path: string | null
    type_group: AtlasTypeGroup
    network_ids?: string[]
    operator_group: AtlasOperatorGroup | null
    status: string
    listed: boolean
    access_listed?: boolean
    local_area_code?: string | null
    local_area_version?: string
    city: string | null
    city_key: string | null
    continent_id: string | null
    continent_slug: string | null
    continent_name: string | null
    country_id: string | null
    country_slug: string | null
    country_name: string | null
    region_id: string | null
    region_slug: string | null
    region_name: string | null
    area_id: string | null
    area_slug: string | null
    area_name: string | null
    latitude: number
    longitude: number
    original_lat: number
    original_lng: number
    _geo: AtlasCoordinate
    access_codes: string[]
    facility_codes: string[]
    has_access: boolean
    has_events: boolean
    has_catalogue: boolean
    founded: number | null
    completeness: number | null
    late_sunday: boolean
    open_tz: string
    has_hours: boolean
    has_effective_hours: boolean
    closed_dates: string[]
    effective_week_start: string
    clock_valid_until: string | null
    name_sort: string
    place_sort: string
  }

export interface AtlasFilters {
  networks?: string[]
  types: AtlasTypeGroup[]
  opening: "any" | "now" | "staff_now" | "at"
  atDay: number
  atMinutes: number
  operators: AtlasOperatorGroup[]
  facilities: string[]
  events: boolean
  catalogue: boolean
  founded: [number, number] | null
}
export interface AtlasScope {
  bbox?: AtlasBounds
  place?: { level: AtlasPlaceLevel; id: string }
  filters: AtlasFilters
  accessibility: {
    enabled: boolean
    selected: string[]
    view: AtlasAccessibilityView
  }
}
export function emptyAtlasFilters(): AtlasFilters {
  return {
    types: [],
    opening: "any",
    atDay: 6,
    atMinutes: 720,
    operators: [],
    facilities: [],
    events: false,
    catalogue: false,
    founded: null,
  }
}

export interface AtlasQueryMetadata {
  schemaVersion: typeof ATLAS_SCHEMA_VERSION
  dictionaryVersion: string
  fingerprint: string
  queryEpoch: string
  indexedThrough: AtlasRevision
  evaluatedAt: string
}
type RequestBase = {
  schemaVersion: typeof ATLAS_SCHEMA_VERSION
  scope: AtlasScope
}

export type AtlasQueryRequest = RequestBase &
  (
    | {
        purpose: "viewport"
        zoom: number
        width: number
        height: number
        centre: AtlasCoordinate
        populations: AtlasPopulation[]
        archiveBuildId?: string
        drawingPreference: "auto" | "current"
        quality?: boolean
        density?: boolean
        libraryDensity?: {
          detail: AtlasDensityDetail
          scale: "fixed" | "local"
        }
      }
    | { purpose: "counts"; facilityQuery?: string; facilityAfter?: string }
    | { purpose: "suggestions" }
    | { purpose: "perCapita" }
    | { purpose: "libraryAccess"; level: "countries" | "local" }
    | {
        purpose: "list"
        sort: AtlasSort
        centre: AtlasCoordinate
        cursor?: string
        page?: number
      }
    | { purpose: "search"; q: string }
    | { purpose: "extent"; centre: AtlasCoordinate }
  )
export interface AtlasCoverage {
  total: number
  matches: number
  partial: number
  unconfirmed: number
}
export interface AtlasCell {
  id: string
  bounds: AtlasBounds
  centre: AtlasCoordinate
}
export interface AtlasAggregateCell extends AtlasCell {
  /** Display anchor is a matching library coordinate; bounds still describe the cell. */
  centre: AtlasCoordinate
  total: number
  /** A cell containing one library remains directly selectable. */
  point?: AtlasPoint
  coverage?: AtlasCoverage
  completeness?: { unknown: number; low: number; medium: number; high: number }
}
export interface AtlasDensityGrid {
  /** Complete counts at a separate, bounded resolution; positions are cell centres. */
  cells: { id: string; total: number }[]
}
export interface AtlasTileProperties {
  nw?: string
  i: string
  s: string
  n: string
  t: AtlasTypeGroup
  o: AtlasOperatorGroup | null
  st: string
  v?: boolean
  ct: string | null
  co: string | null
  r: string | null
  ar: string | null
  ci: string | null
  a: string
  f: string
  e: boolean
  c: boolean
  l: boolean
  y: number | null
  p: number | null
}
export interface AtlasPoint {
  type: "Feature"
  id: number
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: AtlasTileProperties
}
export type AtlasViewportPopulation =
  | {
      mode: "aggregate"
      exactTotal: number
      complete: true
      cells: AtlasAggregateCell[]
      density?: AtlasDensityGrid
    }
  | { mode: "points"; exactTotal: number; complete: true; points: AtlasPoint[] }
  | {
      mode: "tiles"
      exactTotal: number
      complete: true
      archiveBuildId: string
    }

export type AtlasChangesResponse =
  | {
      status: "complete"
      schemaVersion: typeof ATLAS_SCHEMA_VERSION
      buildId: string
      since: AtlasRevision
      throughRevision: AtlasRevision
      upserts: AtlasPoint[]
      removedIds: string[]
    }
  | {
      status: "overflow" | "expired"
      schemaVersion: typeof ATLAS_SCHEMA_VERSION
    }

export interface AtlasManifest {
  countryTiles?: AtlasCountryTiles
  densityTiles?: AtlasDensityArchive
  schemaVersion: typeof ATLAS_SCHEMA_VERSION
  projectionVersion: typeof ATLAS_PROJECTION_VERSION
  dictionaryVersion: string
  buildId: string
  url: string
  builtAt: string
  sourceStartRevision: AtlasRevision
  sourceEndRevision: AtlasRevision
  builtAgainstQueryEpoch: string
  canonicalLocale: string
  sourceLayer: "libraries"
  detailZoom: number
  maxZoom: 16
  count: number
  bounds: AtlasBounds
  archiveBytes: number
  sha256: string
  attribution: string
}

export function atlasRevision(value: unknown): AtlasRevision {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value))
    throw new RangeError("Atlas revision must be a nonnegative decimal string")

  return value
}

/** The backend signs this payload. A cursor never supplies a raw search filter. */
export interface AtlasCursorPayload {
  schemaVersion: typeof ATLAS_SCHEMA_VERSION
  fingerprint: string
  queryEpoch: string
  dictionaryVersion: string
  sort: Exclude<AtlasSort, "distance">
  lastKey: AtlasProjection["name_sort" | "place_sort" | "completeness"]
  lastId: number
  evaluatedAt: string
  expiresAt: string
}
export interface AtlasListRow {
  documentId: string
  name: string
  slug: string
  path: string | null
  type: AtlasTypeGroup
  city: string | null
  country: string | null
  region: string | null
  coordinate: AtlasCoordinate
  distanceMetres?: number
  status: string
  timezone: string
  hours: [number, number][][] | null
  openNow: "open" | "closed" | "unknown"
  accessibility: string[]
  completeness: number | null
}
export interface AtlasViewportResponse extends AtlasQueryMetadata {
  libraryDensity?: AtlasLibraryDensity
  populations: Partial<Record<AtlasPopulation, AtlasViewportPopulation>>
  coverage?: AtlasCoverage
}
export interface AtlasListResponse extends AtlasQueryMetadata {
  rows: AtlasListRow[]
  exactTotal: number
  reachableTotal: number
  hasMore: boolean
  nextCursor?: string
  nextPage?: number
}
export interface AtlasCountsResponse extends AtlasQueryMetadata {
  exactTotal: number
  typeGroups: Partial<Record<AtlasTypeGroup, number>>
  operatorGroups: Partial<Record<AtlasOperatorGroup, number>>
  facilities: { name: string; count: number }[]
  accessibility: { name: string; count: number }[]
  presets: { label: string; patch: Partial<AtlasFilters>; exactTotal: number }[]
  events: number
  catalogue: number
  foundedRange: [number, number] | null
  facilitiesHasMore: boolean
  facilitiesNext?: string
}
export interface AtlasSuggestion {
  patch: Partial<AtlasFilters>
  exactTotal: number
}
export interface AtlasSuggestionsResponse extends AtlasQueryMetadata {
  exactTotal: number
  suggestions: AtlasSuggestion[]
}
export interface AtlasSearchResponse extends AtlasQueryMetadata {
  libraries: AtlasListRow[]
  places: {
    level: AtlasPlaceLevel
    id: string
    name: string
    exactTotal: number
  }[]
  stops: { serviceDocumentId: string; stopId: string; name: string }[]
}
export interface AtlasExtentResponse extends AtlasQueryMetadata {
  exactTotal: number
  bounds: AtlasBounds | null
}
export interface AtlasExportRequest {
  schemaVersion: typeof ATLAS_SCHEMA_VERSION
  scope: AtlasScope
  sort: AtlasSort
  centre: AtlasCoordinate
}
export type AtlasQueryResponse =
  | AtlasPerCapitaResponse
  | AtlasLibraryAccessResponse
  | AtlasViewportResponse
  | AtlasListResponse
  | AtlasCountsResponse
  | AtlasSuggestionsResponse
  | AtlasSearchResponse
  | AtlasExtentResponse
