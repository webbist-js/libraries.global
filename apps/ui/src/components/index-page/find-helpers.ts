// apps/ui/src/components/index-page/find-helpers.ts
//
// Pure helpers for the Find-a-library page: URL state, open-now computation,
// completeness scoring and the POC's broad library-type groups.

import type { LibrarySearchHitV2 } from "@/lib/meilisearch"

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

/** Compute whether a library is open right now in its own timezone. */
export function openStatus(
  openingTimes?: unknown,
  timezone?: string | null,
  now: Date = new Date()
): OpenStatus {
  const days = (openingTimes as OpeningTimes | null | undefined)?.days
  if (!Array.isArray(days) || days.length === 0) {
    return { known: false, open: false }
  }

  let weekday = ""
  let hm = ""
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now)
    weekday = (
      parts.find((p) => p.type === "weekday")?.value ?? ""
    ).toLowerCase()
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
    hm = `${hour}:${minute}`
  } catch {
    return { known: false, open: false }
  }

  const today = days.find((d) => (d.day ?? "").toLowerCase() === weekday)
  if (!today?.enabled || !Array.isArray(today.timeframes)) {
    return { known: true, open: false }
  }

  for (const tf of today.timeframes) {
    // "HH:mm" strings compare correctly lexicographically
    if (tf.startTime && tf.endTime && tf.startTime <= hm && hm < tf.endTime) {
      return { known: true, open: true, until: tf.endTime }
    }
  }

  return { known: true, open: false }
}

// ── Completeness ────────────────────────────────────────────────────────────

/** Rough record-completeness score used by the "Most complete first" sort. */
export function completenessScore(hit: LibrarySearchHitV2): number {
  let score = 0
  const days = (hit.openingTimes as OpeningTimes | null | undefined)?.days
  if (Array.isArray(days) && days.length > 0) score += 2
  if (hit.summary) score += 1
  if (hit.heroImage?.url) score += 1
  if (hit.accessibility_names?.length) score += 1
  if (hit.service_names?.length) score += 1
  if (hit.iiifEndpoint) score += 1
  if (hit._geo) score += 1
  if (hit.city) score += 1

  return score
}

/** Gaps a contributor can fill, as surfaced on the Contribute hub. */
export const NEED_KEYS = [
  { key: "hours", label: "Missing opening hours" },
  { key: "photo", label: "Missing photo" },
  { key: "facilities", label: "Missing accessibility & facilities" },
] as const

export type NeedKey = (typeof NEED_KEYS)[number]["key"]

export const ALL_NEED_KEYS: NeedKey[] = NEED_KEYS.map((n) => n.key)

export function hitNeeds(hit: LibrarySearchHitV2): NeedKey[] {
  const needs: NeedKey[] = []
  const days = (hit.openingTimes as OpeningTimes | null | undefined)?.days
  if (!days?.some((d) => d.enabled && d.timeframes?.length)) {
    needs.push("hours")
  }
  if (!hit.heroImage?.url) needs.push("photo")
  if (!hit.accessibility_names?.length && !hit.service_names?.length) {
    needs.push("facilities")
  }

  return needs
}

// ── URL state ───────────────────────────────────────────────────────────────

export type ViewMode = "grid" | "list" | "map"
export type SortKey = "complete" | "gaps" | "name" | "near"

export interface FindState {
  q: string
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
}

export const DEFAULT_FIND_STATE: FindState = {
  q: "",
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

  return {
    q: params.get("q") ?? "",
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
  }
}

export function findStateToParams(s: FindState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.q) p.set("q", s.q)
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

  return p
}

export function hasActiveFindFilters(s: FindState): boolean {
  return (
    s.q !== "" ||
    s.groups.length > 0 ||
    s.access.length > 0 ||
    s.services.length > 0 ||
    s.digital ||
    s.openNow ||
    s.needs.length > 0 ||
    s.nearLat != null
  )
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
