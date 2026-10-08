import { isCalendarDate } from "./dates"
import {
  WEEKDAYS,
  type MobileStop,
  type MobileTimetable,
  type MobileVisit,
  type VisitRepeat,
  type Weekday,
} from "./types"

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9]{10}$/.test(value)
const nullableDate = (value: unknown) =>
  value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value.trim()
      : null

export function newTimetableId(): string {
  const cryptoApi = (
    globalThis as {
      crypto?: { getRandomValues: (values: Uint8Array) => Uint8Array }
    }
  ).crypto
  if (!cryptoApi) throw new Error("Secure random generation is unavailable")
  let value = ""
  while (value.length < 10)
    for (const n of cryptoApi.getRandomValues(new Uint8Array(16))) {
      if (n < 252 && value.length < 10)
        value += "abcdefghijklmnopqrstuvwxyz0123456789"[n % 36]
    }

  return value
}
export function emptyTimetable(anchor: string): MobileTimetable {
  return { version: 1, cycle: { weeks: 1, anchor }, stops: [], visits: [] }
}
function stop(value: unknown): MobileStop | null {
  const r = record(value)
  if (
    !r ||
    !id(r.id) ||
    typeof r.name !== "string" ||
    typeof r.where !== "string"
  )
    return null
  const location = record(r.location)
  if (
    r.location != null &&
    (!location ||
      typeof location.lat !== "number" ||
      !Number.isFinite(location.lat) ||
      location.lat < -90 ||
      location.lat > 90 ||
      typeof location.lng !== "number" ||
      !Number.isFinite(location.lng) ||
      location.lng < -180 ||
      location.lng > 180)
  )
    return null
  if (
    r.areaDocumentId != null &&
    (typeof r.areaDocumentId !== "string" ||
      !/^[a-zA-Z0-9]{20,32}$/.test(r.areaDocumentId))
  )
    return null

  return {
    id: r.id,
    name: r.name.trim(),
    where: r.where.trim(),
    location: location
      ? { lat: location.lat as number, lng: location.lng as number }
      : null,
    areaDocumentId: (r.areaDocumentId as string | null) ?? null,
  }
}
function repeat(value: unknown): VisitRepeat | null {
  const r = record(value)
  if (!r) return null
  if (
    r.kind === "cycle" &&
    Array.isArray(r.weeks) &&
    r.weeks.every((w) => typeof w === "number" && Number.isInteger(w))
  )
    return {
      kind: "cycle",
      weeks: [...new Set(r.weeks as number[])].sort((a, b) => a - b),
    }
  if (r.kind === "monthly" && [1, 2, 3, 4, -1].includes(r.nth as number))
    return { kind: "monthly", nth: r.nth as 1 | 2 | 3 | 4 | -1 }
  if (
    r.kind === "dates" &&
    Array.isArray(r.dates) &&
    r.dates.every((d) => typeof d === "string")
  )
    return {
      kind: "dates",
      dates: [...new Set((r.dates as string[]).map((d) => d.trim()))].sort(),
    }

  return null
}
function visit(value: unknown): MobileVisit | null {
  const r = record(value)
  if (
    !r ||
    !id(r.id) ||
    !id(r.stopId) ||
    !WEEKDAYS.includes(r.day as Weekday) ||
    typeof r.arrive !== "string" ||
    typeof r.depart !== "string"
  )
    return null
  const repeating = repeat(r.repeat)
  if (!repeating) return null

  return {
    id: r.id,
    stopId: r.stopId,
    day: r.day as Weekday,
    arrive: r.arrive.trim(),
    depart: r.depart.trim(),
    repeat: repeating,
    termTimeOnly: r.termTimeOnly === true,
    validFrom: nullableDate(r.validFrom),
    validTo: nullableDate(r.validTo),
  }
}

export function normalizeMobileTimetable(
  value: unknown
): MobileTimetable | null {
  const r = record(value),
    cycle = record(r?.cycle)
  if (
    !r ||
    r.version !== 1 ||
    !cycle ||
    ![1, 2, 3, 4].includes(cycle.weeks as number) ||
    !isCalendarDate(cycle.anchor) ||
    !Array.isArray(r.stops) ||
    !Array.isArray(r.visits)
  )
    return null
  const stops = r.stops.map(stop),
    visits = r.visits.map(visit)
  if (stops.includes(null) || visits.includes(null)) return null
  if (
    new Set(stops.map((s) => s!.id)).size !== stops.length ||
    new Set(visits.map((v) => v!.id)).size !== visits.length
  )
    return null

  return {
    version: 1,
    cycle: { weeks: cycle.weeks as 1 | 2 | 3 | 4, anchor: cycle.anchor },
    stops: stops as MobileStop[],
    visits: (visits as MobileVisit[]).sort(
      (a, b) =>
        WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) ||
        a.arrive.localeCompare(b.arrive) ||
        a.id.localeCompare(b.id)
    ),
  }
}
