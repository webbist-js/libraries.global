import { checkText } from "../content-safety"
import { addDays, isCalendarDate, toMinutes, weekdayOf } from "./dates"
import { cycleWeekOf, dayRoute, visitRunsOn } from "./recurrence"
import {
  MOBILE_TIMETABLE_LIMITS as LIMITS,
  WEEKDAYS,
  type MobileStop,
  type MobileTimetable,
  type MobileVisit,
} from "./types"

export type TimetableIssueCode =
  | "unknown_stop"
  | "bad_time"
  | "anchor_not_monday"
  | "valid_range"
  | "date_weekday"
  | "too_many_stops"
  | "too_many_visits"
  | "too_many_dates"
  | "too_large"
  | "unsafe_text"
  | "overlap"
  | "travel_time"
  | "stop_without_visits"
  | "stop_without_pin"
  | "cycle_weeks"
export type TimetableIssue = {
  level: "error" | "warning"
  code: TimetableIssueCode
  message: string
  stopIds: string[]
  visitIds: string[]
}
export const hasErrors = (issues: TimetableIssue[]) =>
  issues.some((i) => i.level === "error")
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
/** "on Tuesdays, Week 1" for cycle visits; the date itself otherwise. */
function overlapWhen(
  tt: MobileTimetable,
  a: MobileVisit,
  b: MobileVisit,
  date: string
): string {
  if (a.repeat.kind !== "cycle" || b.repeat.kind !== "cycle")
    return `on ${date}`
  const day = DAY_NAMES[WEEKDAYS.indexOf(a.day)] ?? a.day

  return tt.cycle.weeks > 1
    ? `on ${day}s, Week ${cycleWeekOf(tt, date)}`
    : `on ${day}s`
}
const goodTime = (time: string) =>
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) && toMinutes(time) % 5 === 0
function distance(a: MobileStop, b: MobileStop): number {
  if (!a.location || !b.location) return 0
  const radians = Math.PI / 180,
    lat = (b.location.lat - a.location.lat) * radians,
    lng = (b.location.lng - a.location.lng) * radians

  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(lat / 2) ** 2 +
          Math.cos(a.location.lat * radians) *
            Math.cos(b.location.lat * radians) *
            Math.sin(lng / 2) ** 2
      )
    )
  )
}
/** A concrete shared date; cycles are checked irrespective of today's date. */
function sharedDate(
  tt: MobileTimetable,
  a: MobileVisit,
  b: MobileVisit,
  today: string
): string | null {
  if (a.day !== b.day) return null
  const start = [today, a.validFrom, b.validFrom]
    .filter((x): x is string => Boolean(x && isCalendarDate(x)))
    .sort()
    .at(-1)!
  const end =
    [a.validTo, b.validTo]
      .filter((x): x is string => Boolean(x && isCalendarDate(x)))
      .sort()[0] ?? addDays(start, 366)
  const dates =
    a.repeat.kind === "dates"
      ? a.repeat.dates
      : b.repeat.kind === "dates"
        ? b.repeat.dates
        : null
  if (dates)
    return (
      dates.find((d) => visitRunsOn(tt, a, d) && visitRunsOn(tt, b, d)) ?? null
    )
  const scanEnd = [end, addDays(start, 366)].sort()[0]!
  for (let date = start; date <= scanEnd; date = addDays(date, 1))
    if (visitRunsOn(tt, a, date) && visitRunsOn(tt, b, date)) return date

  return null
}

export function validateMobileTimetable(
  tt: MobileTimetable,
  opts: { today?: string; isSafeText?: (s: string) => boolean } = {}
): TimetableIssue[] {
  const issues: TimetableIssue[] = [],
    stops = new Map(tt.stops.map((s) => [s.id, s]))
  const issue = (
    level: TimetableIssue["level"],
    code: TimetableIssueCode,
    message: string,
    stopIds: string[] = [],
    visitIds: string[] = []
  ): void => {
    issues.push({ level, code, message, stopIds, visitIds })
  }
  const today = isCalendarDate(opts.today)
    ? opts.today
    : new Date().toISOString().slice(0, 10)
  if (!isCalendarDate(tt.cycle.anchor) || weekdayOf(tt.cycle.anchor) !== "mon")
    issue(
      "error",
      "anchor_not_monday",
      "Choose a Monday for the start of Week 1."
    )
  if (![1, 2, 3, 4].includes(tt.cycle.weeks))
    issue("error", "cycle_weeks", "A cycle must have one to four weeks.")
  if (tt.stops.length > LIMITS.stops)
    issue("error", "too_many_stops", `Use at most ${LIMITS.stops} stops.`)
  if (tt.visits.length > LIMITS.visits)
    issue("error", "too_many_visits", `Use at most ${LIMITS.visits} visits.`)
  if (new TextEncoder().encode(JSON.stringify(tt)).length > LIMITS.bytes)
    issue("error", "too_large", "The timetable exceeds 200 KB.")
  const safe = opts.isSafeText ?? ((text: string) => checkText(text) === null)
  for (const stop of tt.stops) {
    if (
      !stop.name ||
      stop.name.length > LIMITS.nameMax ||
      stop.where.length > LIMITS.whereMax ||
      !safe(stop.name) ||
      !safe(stop.where)
    )
      issue(
        "error",
        "unsafe_text",
        `Check the name and landmark for ${stop.name || "this stop"}. Names can have 80 characters; landmarks 140.`,
        [stop.id]
      )
    if (!tt.visits.some((v) => v.stopId === stop.id))
      issue(
        "warning",
        "stop_without_visits",
        `${stop.name} has no visits and will not be shown.`,
        [stop.id]
      )
    if (!stop.location)
      issue(
        "warning",
        "stop_without_pin",
        `${stop.name} has no pin and will not be mapped.`,
        [stop.id]
      )
  }
  for (const visit of tt.visits) {
    if (!stops.has(visit.stopId))
      issue(
        "error",
        "unknown_stop",
        "Choose an existing stop for this visit.",
        [visit.stopId],
        [visit.id]
      )
    if (
      !goodTime(visit.arrive) ||
      !goodTime(visit.depart) ||
      toMinutes(visit.arrive) >= toMinutes(visit.depart)
    )
      issue(
        "error",
        "bad_time",
        "Arrival and departure must be on the five-minute grid, with departure later the same day.",
        [visit.stopId],
        [visit.id]
      )
    if (
      (visit.validFrom && !isCalendarDate(visit.validFrom)) ||
      (visit.validTo && !isCalendarDate(visit.validTo)) ||
      (visit.validFrom && visit.validTo && visit.validFrom > visit.validTo)
    )
      issue(
        "error",
        "valid_range",
        "From must be on or before Until.",
        [visit.stopId],
        [visit.id]
      )
    if (
      visit.repeat.kind === "cycle" &&
      (!visit.repeat.weeks.length ||
        visit.repeat.weeks.some(
          (w) => !Number.isInteger(w) || w < 1 || w > tt.cycle.weeks
        ))
    )
      issue(
        "error",
        "cycle_weeks",
        "Choose weeks within this cycle.",
        [visit.stopId],
        [visit.id]
      )
    if (visit.repeat.kind === "dates") {
      if (visit.repeat.dates.length > LIMITS.datesPerVisit)
        issue(
          "error",
          "too_many_dates",
          "Use at most 52 specific dates for a visit.",
          [visit.stopId],
          [visit.id]
        )
      if (
        !visit.repeat.dates.length ||
        visit.repeat.dates.some(
          (d) => !isCalendarDate(d) || weekdayOf(d) !== visit.day
        )
      )
        issue(
          "error",
          "date_weekday",
          "Every specific date must fall on the visit's weekday.",
          [visit.stopId],
          [visit.id]
        )
    }
  }
  // Invalid values must never reach recurrence, which deliberately works only on valid calendar dates.
  if (hasErrors(issues) || tt.visits.length > LIMITS.visits) return issues
  for (let i = 0; i < tt.visits.length; i++)
    for (let j = i + 1; j < tt.visits.length; j++) {
      const a = tt.visits[i]!,
        b = tt.visits[j]!
      if (
        a.day !== b.day ||
        toMinutes(a.arrive) >= toMinutes(b.depart) ||
        toMinutes(b.arrive) >= toMinutes(a.depart)
      )
        continue
      const date = sharedDate(tt, a, b, today)
      if (date)
        issue(
          "error",
          "overlap",
          `The vehicle can't be in two places at once: ${stops.get(a.stopId)!.name} ${a.arrive}–${a.depart} overlaps ${stops.get(b.stopId)!.name} ${b.arrive}–${b.depart} ${overlapWhen(tt, a, b, date)}.`,
          [a.stopId, b.stopId],
          [a.id, b.id]
        )
    }
  const warned = new Set<string>()
  for (let day = 0; day < 366; day++) {
    const route = dayRoute(tt, [], addDays(today, day))
    for (let i = 1; i < route.length; i++) {
      const previous = route[i - 1]!,
        next = route[i]!,
        key = `${previous.visitId}:${next.visitId}`
      if (warned.has(key)) continue
      const minutes = toMinutes(next.arrive) - toMinutes(previous.depart),
        km = distance(stops.get(previous.stopId)!, stops.get(next.stopId)!)
      if (
        km > 0 &&
        minutes >= 0 &&
        (minutes === 0 || km / (minutes / 60) > 40)
      ) {
        warned.add(key)
        issue(
          "warning",
          "travel_time",
          `${minutes} minutes between stops ${Math.round(km)} km apart. Is that enough time?`,
          [previous.stopId, next.stopId],
          [previous.visitId, next.visitId]
        )
      }
    }
  }

  return issues
}
