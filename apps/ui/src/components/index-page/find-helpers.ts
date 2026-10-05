// apps/ui/src/components/index-page/find-helpers.ts
//
// Pure helpers for the Find-a-library page: URL state and its search query,
// the open-now badge and the POC's broad library-type groups.

import {
  type FindPlaceLevel,
  FIND_PLACE_LEVELS,
  nameFromSlug,
} from "@/lib/find-places"
import type { FindLocation, FindQuery } from "@/lib/find-search"
import { localDayMinute } from "@/lib/local-time"

// ── Broad type groups (POC sidebar) ─────────────────────────────────────────

export const TYPE_GROUPS = [
  {
    key: "national",
    label: "National",
    types: ["National", "Parliamentary", "State"],
  },
  { key: "public", label: "Public", types: ["Public", "Municipal", "Mobile"] },
  { key: "academic", label: "Academic", types: ["Academic", "University"] },
  {
    key: "special",
    label: "Special",
    types: [
      "Special",
      "Monastic",
      "Archive",
      "Private",
      "Cultural",
      "Digital",
      "Other",
    ],
  },
] as const

export type TypeGroupKey = (typeof TYPE_GROUPS)[number]["key"]

export function groupForLibraryType(libraryType?: string | null): TypeGroupKey {
  for (const g of TYPE_GROUPS) {
    if ((g.types as readonly string[]).includes(libraryType ?? "")) return g.key
  }

  return "special"
}

// ── Opening times ───────────────────────────────────────────────────────────

export interface OpeningTimeframe {
  startTime?: string | null
  endTime?: string | null
  staffing?: string | null
}

export interface OpeningDay {
  day?: string | null
  enabled?: boolean | null
  timeframes?: OpeningTimeframe[] | null
}

export interface OpeningTimes {
  days?: OpeningDay[] | null
}

export interface OpenStatus {
  /** false when the record has no usable opening-times data */
  known: boolean
  open: boolean
  /** "HH:mm" closing time of the current timeframe, when open */
  until?: string
}

const minutesOf = (hm: string) => {
  const [h, m] = hm.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Whether a library is open right now in its own timezone. Reads the clock
 * the way the "Open now" filter does (`localDayMinute`), so a card's badge
 * agrees with the filter that found it.
 */
export function openStatus(
  openingTimes?: unknown,
  timezone?: string | null,
  now: Date = new Date()
): OpenStatus {
  const days = (openingTimes as OpeningTimes | null | undefined)?.days
  if (!Array.isArray(days) || days.length === 0) {
    return { known: false, open: false }
  }

  const local = localDayMinute(timezone || "UTC", now)
  if (!local) return { known: false, open: false }

  const today = days.find(
    (d) => (d.day ?? "").toLowerCase().slice(0, 3) === local.day
  )
  if (!today?.enabled || !Array.isArray(today.timeframes)) {
    return { known: true, open: false }
  }

  for (const tf of today.timeframes) {
    if (
      tf.startTime &&
      tf.endTime &&
      minutesOf(tf.startTime) <= local.minute &&
      local.minute < minutesOf(tf.endTime)
    ) {
      return { known: true, open: true, until: tf.endTime }
    }
  }

  return { known: true, open: false }
}

// ── Record gaps ─────────────────────────────────────────────────────────────

/** Gaps a contributor can fill, as surfaced on the Contribute hub. */
export const NEED_KEYS = [
  { key: "hours", label: "Missing opening hours" },
  { key: "photo", label: "Missing photo" },
  { key: "accessibility", label: "Missing accessibility details" },
  { key: "services", label: "Missing services and amenities" },
  { key: "contact", label: "Missing contact details" },
  { key: "address", label: "Missing address" },
] as const

export type NeedKey = (typeof NEED_KEYS)[number]["key"]

export const ALL_NEED_KEYS: NeedKey[] = NEED_KEYS.map((n) => n.key)

// ── URL state ───────────────────────────────────────────────────────────────

export type ViewMode = "grid" | "list" | "map"
export type SortKey = "complete" | "gaps" | "name" | "near"

/** Location scope, set by `?continent=` / `?country=` / `?region=` (slugs). */
export type PlaceLevel = FindPlaceLevel
export type FindPlace = {
  level: PlaceLevel
  slug: string
  /**
   * The parents' slugs when the place was picked in the Location filter,
   * so its selects hold still until the search names them. Never in the URL.
   */
  parents?: Partial<Record<PlaceLevel, string>>
}

// Narrowest first: a region link wins over its country.
const PLACE_LEVELS = [...FIND_PLACE_LEVELS].reverse()

export interface FindState {
  q: string
  place: FindPlace | null
  groups: TypeGroupKey[]
  access: string[]
  services: string[]
  digital: boolean
  openNow: boolean
  /** records missing any of these (OR) */
  needs: NeedKey[]
  nearLat?: number
  nearLng?: number
  /** km; 0 = any distance */
  radiusKm: number
  sort: SortKey
  view: ViewMode
  page: number
  /** URL-only dataset filter for drive links: no control sets it. */
  source: string | null
}

export const DEFAULT_FIND_STATE: FindState = {
  q: "",
  place: null,
  groups: [],
  access: [],
  services: [],
  digital: false,
  openNow: false,
  needs: [],
  nearLat: undefined,
  nearLng: undefined,
  radiusKm: 0,
  sort: "complete",
  view: "grid",
  page: 0,
  source: null,
}

export function findStateFromParams(params: URLSearchParams): FindState {
  const groupKeys = TYPE_GROUPS.map((g) => g.key) as string[]
  const groups = (params.get("tg") ?? "")
    .split(",")
    .filter((g): g is TypeGroupKey => groupKeys.includes(g))
  const needKeys = ALL_NEED_KEYS as string[]
  const needs = (params.get("needs") ?? "")
    .split(",")
    .filter((n): n is NeedKey => needKeys.includes(n))
  const sort = params.get("sort")
  const view = params.get("view")
  const placeLevel = PLACE_LEVELS.find((level) => params.get(level))

  return {
    q: params.get("q") ?? "",
    place: placeLevel
      ? { level: placeLevel, slug: params.get(placeLevel)! }
      : null,
    groups,
    access: (params.get("access") ?? "").split(",").filter(Boolean),
    services: (params.get("service") ?? "").split(",").filter(Boolean),
    digital: params.get("digital") === "1",
    openNow: params.get("open") === "1",
    needs,
    nearLat: params.get("nlat") ? Number(params.get("nlat")) : undefined,
    nearLng: params.get("nlng") ? Number(params.get("nlng")) : undefined,
    radiusKm: params.get("nr") ? Number(params.get("nr")) : 0,
    sort:
      sort === "name" ||
      sort === "near" ||
      sort === "complete" ||
      sort === "gaps"
        ? sort
        : "complete",
    view: view === "list" || view === "map" ? view : "grid",
    page: Math.max(0, Number(params.get("page") ?? "0") || 0),
    source: params.get("source") || null,
  }
}

export function findStateToParams(s: FindState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.q) p.set("q", s.q)
  if (s.place) p.set(s.place.level, s.place.slug)
  if (s.groups.length > 0) p.set("tg", s.groups.join(","))
  if (s.access.length > 0) p.set("access", s.access.join(","))
  if (s.services.length > 0) p.set("service", s.services.join(","))
  if (s.digital) p.set("digital", "1")
  if (s.openNow) p.set("open", "1")
  if (s.needs.length > 0) p.set("needs", s.needs.join(","))
  if (s.nearLat != null) p.set("nlat", s.nearLat.toFixed(4))
  if (s.nearLng != null) p.set("nlng", s.nearLng.toFixed(4))
  if (s.radiusKm > 0) p.set("nr", String(s.radiusKm))
  if (s.sort !== "complete") p.set("sort", s.sort)
  if (s.view !== "grid") p.set("view", s.view)
  if (s.page > 0) p.set("page", String(s.page))
  if (s.source) p.set("source", s.source)

  return p
}

export function hasActiveFindFilters(s: FindState): boolean {
  return (
    s.q !== "" ||
    s.place !== null ||
    s.groups.length > 0 ||
    s.access.length > 0 ||
    s.services.length > 0 ||
    s.digital ||
    s.openNow ||
    s.needs.length > 0 ||
    s.nearLat != null ||
    s.source != null
  )
}

/** How many filter chips/badges this state should show (excludes `q`). */
export function activeFilterCount(s: FindState): number {
  return (
    s.groups.length +
    s.access.length +
    s.services.length +
    (s.openNow ? 1 : 0) +
    (s.digital ? 1 : 0) +
    s.needs.length +
    (s.nearLat != null ? 1 : 0) +
    (s.place ? 1 : 0) +
    (s.source ? 1 : 0)
  )
}

// ── Location filter ─────────────────────────────────────────────────────────

const PLACE_LISTS = {
  continent: "continents",
  country: "countries",
  region: "regions",
  area: "areas",
} as const

export type PlaceChoice = { slug: string; name: string; count?: number }
export type PlacePath = Record<PlaceLevel, string>

/**
 * The slug each Location select shows: the chosen place, its parents (as the
 * search named them, else as they were picked) and nothing below it.
 */
export function placePath(
  place: FindPlace | null,
  location?: FindLocation
): PlacePath {
  const path: PlacePath = { continent: "", country: "", region: "", area: "" }
  if (!place) return path
  const named = location?.[place.level]?.slug === place.slug ? location : null
  for (const level of FIND_PLACE_LEVELS) {
    if (level === place.level) {
      path[level] = place.slug
      break
    }
    path[level] = named?.[level]?.slug ?? place.parents?.[level] ?? ""
  }

  return path
}

/** The place once a Location select changes; "" steps back up a level. */
export function pickPlace(
  path: PlacePath,
  level: PlaceLevel,
  slug: string
): FindPlace | null {
  const above = FIND_PLACE_LEVELS.slice(
    0,
    FIND_PLACE_LEVELS.indexOf(level)
  ).filter((l) => path[l] !== "")
  const parentsOf = (levels: PlaceLevel[]) =>
    Object.fromEntries(levels.map((l) => [l, path[l]]))
  if (slug) return { level, slug, parents: parentsOf(above) }
  const up = above.at(-1)

  return up
    ? { level: up, slug: path[up], parents: parentsOf(above.slice(0, -1)) }
    : null
}

/** The chosen place's name, as the search knows it, else from its slug. */
export function placeName(
  place: Pick<FindPlace, "level" | "slug">,
  location?: FindLocation
): string {
  const named = location?.[place.level]
  if (named?.slug === place.slug) return named.name

  return (
    location?.[PLACE_LISTS[place.level]].find((o) => o.slug === place.slug)
      ?.name ?? nameFromSlug(place.slug)
  )
}

/**
 * A Location select's options: the search's list when it was made for the
 * parent now chosen, and always the chosen place.
 */
export function placeChoices(
  level: PlaceLevel,
  path: PlacePath,
  location?: FindLocation
): PlaceChoice[] {
  const parent = FIND_PLACE_LEVELS[FIND_PLACE_LEVELS.indexOf(level) - 1]
  const current = !parent || location?.[parent]?.slug === path[parent]
  const choices: PlaceChoice[] = current
    ? [...(location?.[PLACE_LISTS[level]] ?? [])]
    : []
  const chosen = path[level]
  if (chosen && !choices.some((c) => c.slug === chosen)) {
    choices.unshift({
      slug: chosen,
      name: placeName({ level, slug: chosen }, location),
    })
  }

  return choices
}

/** The page state as a search: the one mapping the server and browser share. */
export function findQueryOf(state: FindState, locale: string): FindQuery {
  return {
    query: state.q,
    place: state.place
      ? { level: state.place.level, slug: state.place.slug }
      : undefined,
    libraryTypes: state.groups.flatMap(
      (key) => TYPE_GROUPS.find((g) => g.key === key)?.types ?? []
    ),
    accessibilityNames: state.access,
    serviceNames: state.services,
    digital: state.digital,
    openNow: state.openNow,
    needs: state.needs,
    nearLat: state.nearLat,
    nearLng: state.nearLng,
    nearRadius:
      state.nearLat != null && state.radiusKm > 0
        ? state.radiusKm * 1000
        : undefined,
    sort: state.sort,
    page: state.page,
    hitsPerPage: 24,
    locale,
    source: state.source ?? undefined,
  }
}

/** Haversine distance in km. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(s))
}
