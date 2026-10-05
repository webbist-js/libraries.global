// Pure helpers for the library detail page (v2).
// No React imports — unit-testable.

import {
  completenessOf,
  type CompletenessSection as RegistrySection,
  type GapKey,
  type GapRecord,
} from "@repo/shared-data"

export const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type DayKey = (typeof DAY_ORDER)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

export interface OpeningTimeframe {
  startTime: string
  endTime: string
  staffing?: string | null
}

export interface OpeningTimesDay {
  day: DayKey
  enabled: boolean
  timeframes: OpeningTimeframe[]
}

export interface OpeningTimesValue {
  version?: number
  days: OpeningTimesDay[]
}

export type OpenState = "open" | "closed" | "unknown"

export interface OpenStatus {
  state: OpenState
  /** Human label, e.g. "Open until 20:00 today", "Closed · opens 09:00 Monday", "Hours not added yet" */
  label: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

/** Current [dayKey, minutesSinceMidnight] in the library's IANA timezone. */
function nowInZone(timezone: string | null | undefined, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone ?? undefined,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? ""
    const dayKey = get("weekday").toLowerCase() as DayKey
    const minutes =
      Number.parseInt(get("hour"), 10) * 60 + Number.parseInt(get("minute"), 10)

    return { dayKey, minutes }
  } catch {
    const jsDay = now.getDay()
    const dayKey = DAY_ORDER[jsDay === 0 ? 6 : jsDay - 1] as DayKey

    return { dayKey, minutes: now.getHours() * 60 + now.getMinutes() }
  }
}

/**
 * Compute the live open/closed status from the opening-times custom field.
 * Returns "unknown" when no usable hours exist.
 */
export function getOpenStatus(
  openingTimes: OpeningTimesValue | null | undefined,
  timezone: string | null | undefined,
  now: Date = new Date()
): OpenStatus {
  const days = openingTimes?.days
  if (!Array.isArray(days) || days.length === 0) {
    return { state: "unknown", label: "Hours not added yet" }
  }
  const hasAny = days.some((d) => d.enabled && d.timeframes?.length > 0)
  if (!hasAny) {
    return { state: "unknown", label: "Hours not added yet" }
  }

  const { dayKey, minutes } = nowInZone(timezone, now)
  const today = days.find((d) => d.day === dayKey)

  if (today?.enabled) {
    for (const tf of today.timeframes ?? []) {
      const start = timeToMinutes(tf.startTime)
      const end = timeToMinutes(tf.endTime)
      if (minutes >= start && minutes < end) {
        return { state: "open", label: `Open until ${tf.endTime} today` }
      }
    }
    // Not open now — is there a later timeframe today?
    const upcoming = (today.timeframes ?? [])
      .filter((tf) => timeToMinutes(tf.startTime) > minutes)
      .sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      )[0]
    if (upcoming) {
      return {
        state: "closed",
        label: `Closed · opens ${upcoming.startTime} today`,
      }
    }
  }

  // Find the next open day (up to a week ahead)
  const todayIndex = DAY_ORDER.indexOf(dayKey)
  for (let offset = 1; offset <= 7; offset++) {
    const key = DAY_ORDER[(todayIndex + offset) % 7] as DayKey
    const day = days.find((d) => d.day === key)
    const first = day?.enabled
      ? [...(day.timeframes ?? [])].sort(
          (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        )[0]
      : undefined
    if (first) {
      const dayLabel = offset === 1 ? "tomorrow" : DAY_LABELS[key]

      return {
        state: "closed",
        label: `Closed · opens ${first.startTime} ${dayLabel}`,
      }
    }
  }

  return { state: "closed", label: "Closed" }
}

/** Format one day's timeframes as "09:00–17:00" (multiple joined with ", "). */
export function formatDayTimes(day: OpeningTimesDay | undefined): string {
  if (!day?.enabled || !day.timeframes?.length) return "Closed"

  return day.timeframes.map((tf) => `${tf.startTime}–${tf.endTime}`).join(", ")
}

/** Decimal coordinates → "51.5299° N, 0.1277° W" */
export function formatCoordinates(
  location: { lat?: unknown; lng?: unknown } | null | undefined
): string | null {
  const lat = typeof location?.lat === "number" ? location.lat : null
  const lng = typeof location?.lng === "number" ? location.lng : null
  if (lat == null || lng == null) return null
  const latLabel = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`
  const lngLabel = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`

  return `${latLabel}, ${lngLabel}`
}

/** The eight completeness sections, from the shared gap registry. */
export type CompletenessSection = RegistrySection

/**
 * Record completeness — how many of the core sections have data.
 * Mirrors the POC's "N of M sections documented". Reads the shared gap
 * registry (`@repo/shared-data`), so it agrees with the stored
 * `completeness` score and the search index's `needs`.
 */
export function computeCompleteness(library: GapRecord): {
  filled: number
  total: number
  sections: CompletenessSection[]
} {
  const { filled, total, sections } = completenessOf(library)

  return { filled, total, sections }
}

// ── Hours summaries (hero fact cards, timeline) ──────────────────────────────

export const DAY_SHORT: Record<DayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

/** Closing at or after this counts as "open late". */
const LATE_MINUTES = 19 * 60

const openFrames = (day: OpeningTimesDay | undefined) =>
  day?.enabled ? (day.timeframes ?? []) : []

/** Earliest opening and latest closing of one day, or null when closed. */
export function daySpan(
  day: OpeningTimesDay | undefined
): { start: string; end: string } | null {
  const frames = openFrames(day)
  if (frames.length === 0) return null
  const sorted = [...frames].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )
  const end = frames.reduce(
    (latest, tf) =>
      timeToMinutes(tf.endTime) > timeToMinutes(latest) ? tf.endTime : latest,
    frames[0]!.endTime
  )

  return { start: sorted[0]!.startTime, end }
}

/** "Mon–Fri", "Tue, Thu", "Every day" for a set of days in week order. */
export function formatDayList(days: readonly DayKey[]): string {
  const ordered = DAY_ORDER.filter((d) => days.includes(d))
  if (ordered.length === 7) return "Every day"
  const idx = ordered.map((d) => DAY_ORDER.indexOf(d))
  const runs: DayKey[][] = []
  idx.forEach((n, i) => {
    if (i > 0 && n === idx[i - 1]! + 1) runs.at(-1)!.push(DAY_ORDER[n]!)
    else runs.push([DAY_ORDER[n]!])
  })

  return runs
    .map((run) =>
      run.length >= 3
        ? `${DAY_SHORT[run[0]!]}–${DAY_SHORT[run.at(-1)!]}`
        : run.map((d) => DAY_SHORT[d]).join(", ")
    )
    .join(", ")
}

export interface HoursSummary {
  /** "Open late" when a day closes at 19:00 or after, else "Latest closing". */
  lateLabel: string
  /** "Every day until 20:00", "Tue, Thu until 19:00". */
  lateValue: string
  /** "Open 10:00–16:00" or "Closed". */
  sunday: string
}

/** The hero's hours facts, or null when no hours are recorded. */
export function summariseHours(
  openingTimes: OpeningTimesValue | null | undefined
): HoursSummary | null {
  const days = openingTimes?.days ?? []
  const spans = DAY_ORDER.map((key) => ({
    key,
    span: daySpan(days.find((d) => d.day === key)),
  })).filter((s): s is { key: DayKey; span: NonNullable<typeof s.span> } =>
    Boolean(s.span)
  )
  if (spans.length === 0) return null

  const latest = Math.max(...spans.map((s) => timeToMinutes(s.span.end)))
  const latestDays = spans.filter((s) => timeToMinutes(s.span.end) === latest)
  const latestTime = latestDays[0]!.span.end
  const sunday = spans.find((s) => s.key === "sunday")

  return {
    lateLabel: latest >= LATE_MINUTES ? "Open late" : "Latest closing",
    lateValue: `${formatDayList(latestDays.map((s) => s.key))} until ${latestTime}`,
    sunday: sunday ? `Open ${sunday.span.start}–${sunday.span.end}` : "Closed",
  }
}

/** Whether the library opens at all on this day of the week. */
export function opensOn(
  openingTimes: OpeningTimesValue | null | undefined,
  day: DayKey
): boolean {
  return openFrames(openingTimes?.days?.find((d) => d.day === day)).length > 0
}

/**
 * Whole-hour window for the hours timeline: the week's earliest opening
 * rounded down and latest closing rounded up, at least 8 hours wide.
 */
export function timelineWindow(
  openingTimes: OpeningTimesValue | null | undefined
): { startHour: number; endHour: number } {
  const frames = (openingTimes?.days ?? []).flatMap(openFrames)
  if (frames.length === 0) return { startHour: 8, endHour: 18 }
  let startHour = Math.floor(
    Math.min(...frames.map((tf) => timeToMinutes(tf.startTime))) / 60
  )
  let endHour = Math.ceil(
    Math.max(...frames.map((tf) => timeToMinutes(tf.endTime))) / 60
  )
  while (endHour - startHour < 8) {
    if (startHour > 0) startHour -= 1
    if (endHour - startHour < 8 && endHour < 24) endHour += 1
  }

  return { startHour, endHour: Math.min(endHour, 24) }
}

/** A time's position along the timeline window, 0–100. */
export function timelinePercent(
  time: string,
  window: { startHour: number; endHour: number }
): number {
  const span = (window.endHour - window.startHour) * 60
  const at = timeToMinutes(time) - window.startHour * 60

  return Math.min(100, Math.max(0, (at / span) * 100))
}

/** Whether any timeframe says if it's staffed or self-service. */
export function hasStaffingDetail(
  openingTimes: OpeningTimesValue | null | undefined
): boolean {
  return (openingTimes?.days ?? []).some((d) =>
    openFrames(d).some((tf) => tf.staffing === "self_service")
  )
}

// ── Distances ────────────────────────────────────────────────────────────────

export type LatLng = { lat: number; lng: number }

/** A usable {lat, lng} from a location-picker value, or null. */
export function toLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null
  const { lat, lng } = value as { lat?: unknown; lng?: unknown }
  const la = typeof lat === "string" ? Number.parseFloat(lat) : lat
  const ln = typeof lng === "string" ? Number.parseFloat(lng) : lng
  if (typeof la !== "number" || typeof ln !== "number") return null
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null

  return { lat: la, lng: ln }
}

/** Straight-line (great-circle) distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** "650 m", "2.9 km", "38 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
  if (km < 10) return `${km.toFixed(1)} km`

  return `${Math.round(km)} km`
}

// ── Record checklist (sidebar) ───────────────────────────────────────────────

/** The eight completeness sections, for the sidebar's checklist and tasks. */
export type ChecklistKey = Extract<
  GapKey,
  | "photo"
  | "hours"
  | "address"
  | "location"
  | "facilities"
  | "about"
  | "history"
  | "contact"
>

export interface ChecklistItem {
  key: ChecklistKey
  label: string
  done: boolean
}

/**
 * The sidebar's "Completeness" checklist: the eight parts a reader looks
 * for, in the order they're shown (two columns, read across). Reads the
 * shared gap registry, so it matches the stored completeness score.
 */
export function recordChecklist(library: GapRecord): {
  done: number
  total: number
  items: ChecklistItem[]
} {
  const { filled, total, sections } = completenessOf(library)
  const items: ChecklistItem[] = sections.map((s) => ({
    key: s.key as ChecklistKey,
    label: s.label,
    done: s.filled,
  }))

  return { done: filled, total, items }
}

// ── Citation ─────────────────────────────────────────────────────────────────

/** "Nailsea Library." Libraries Global, record GB-…, updated 19 May 2026. URL */
export function buildCitation({
  name,
  entityRef,
  updatedAt,
  url,
}: {
  name: string
  entityRef?: string | null
  updatedAt?: string | null
  url: string
}): string {
  const date = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null
  const parts = [
    entityRef ? `record ${entityRef}` : null,
    date ? `updated ${date}` : null,
  ].filter(Boolean)

  return `“${name}.” Libraries Global${parts.length ? `, ${parts.join(", ")}` : ""}. ${url}`
}
