import {
  addDays,
  epochWeek,
  isCalendarDate,
  localDateTime,
  positiveModulo,
  toMinutes,
  weekdayOf,
} from "./dates"
import type { MobileTimetable, MobileVisit, TimetableNotice } from "./types"

export function cycleWeekOf(tt: MobileTimetable, date: string): number {
  return (
    positiveModulo(
      epochWeek(date) - epochWeek(tt.cycle.anchor),
      tt.cycle.weeks
    ) + 1
  )
}
export function visitRunsOn(
  tt: MobileTimetable,
  visit: MobileVisit,
  date: string
): boolean {
  if (
    !isCalendarDate(date) ||
    weekdayOf(date) !== visit.day ||
    (visit.validFrom && date < visit.validFrom) ||
    (visit.validTo && date > visit.validTo)
  )
    return false
  if (visit.repeat.kind === "cycle")
    return visit.repeat.weeks.includes(cycleWeekOf(tt, date))
  if (visit.repeat.kind === "dates") return visit.repeat.dates.includes(date)
  const day = Number(date.slice(-2))

  return visit.repeat.nth === -1
    ? addDays(date, 7).slice(0, 7) !== date.slice(0, 7)
    : Math.ceil(day / 7) === visit.repeat.nth
}
export function noticeMatches(
  tt: MobileTimetable,
  visit: MobileVisit,
  date: string,
  notice: TimetableNotice
): boolean {
  if (
    notice.type !== "not_running" ||
    notice.endedAt ||
    !isCalendarDate(notice.from) ||
    date < notice.from ||
    date > (notice.to ?? addDays(notice.from, 29))
  )
    return false
  if (notice.scope === "library" || notice.scope === "service") return true
  if (notice.scope === "term_time") return visit.termTimeOnly
  if (notice.scope === "stop") return notice.stopId === visit.stopId

  return (
    notice.scopeDay === visit.day &&
    (notice.scopeWeek === null || notice.scopeWeek === cycleWeekOf(tt, date))
  )
}
export interface Occurrence {
  date: string
  visitId: string
  stopId: string
  arrive: string
  depart: string
  cancelledBy: string | null
}
export function dayRoute(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  date: string
): Occurrence[] {
  return tt.visits
    .filter((v) => visitRunsOn(tt, v, date))
    .map((v) => ({
      date,
      visitId: v.id,
      stopId: v.stopId,
      arrive: v.arrive,
      depart: v.depart,
      cancelledBy:
        notices.find((n) => noticeMatches(tt, v, date, n))?.id ?? null,
    }))
    .sort(
      (a, b) =>
        a.arrive.localeCompare(b.arrive) || a.visitId.localeCompare(b.visitId)
    )
}
export function occurrences(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  from: string,
  to: string
): Occurrence[] {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return []
  const out: Occurrence[] = []
  for (let date = from; date <= to; date = addDays(date, 1))
    out.push(...dayRoute(tt, notices, date))

  return out
}
export function nextVisits(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  stopId: string,
  now: Date,
  tz: string,
  n: number
): Occurrence[] {
  const local = localDateTime(now, tz),
    out: Occurrence[] = []
  if (n <= 0) return out
  for (let i = 0; i <= 730 && out.length < n; i++)
    for (const occurrence of dayRoute(tt, notices, addDays(local.date, i))) {
      if (
        occurrence.stopId === stopId &&
        !occurrence.cancelledBy &&
        (i > 0 || toMinutes(occurrence.depart) > local.minute)
      )
        out.push(occurrence)
      if (out.length >= n) break
    }

  return out
}
export type ScheduleState =
  | { kind: "before_service"; next: Occurrence }
  | { kind: "at_stop"; current: Occurrence; next: Occurrence | null }
  | { kind: "between"; previous: Occurrence; next: Occurrence }
  | { kind: "finished"; nextService: Occurrence | null }
  | { kind: "not_running"; noticeId: string; nextService: Occurrence | null }
  | { kind: "no_service_today"; nextService: Occurrence | null }
export function scheduleState(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  now: Date,
  tz: string
): ScheduleState {
  const { date, minute } = localDateTime(now, tz),
    all = dayRoute(tt, notices, date),
    route = all.filter((o) => !o.cancelledBy)
  const nextService = () => {
    for (let i = 1; i <= 730; i++) {
      const next = dayRoute(tt, notices, addDays(date, i)).find(
        (o) => !o.cancelledBy
      )
      if (next) return next
    }

    return null
  }
  if (!route.length)
    return all.some((o) => o.cancelledBy)
      ? {
          kind: "not_running",
          noticeId: all.find((o) => o.cancelledBy)!.cancelledBy!,
          nextService: nextService(),
        }
      : { kind: "no_service_today", nextService: nextService() }
  if (minute < toMinutes(route[0]!.arrive))
    return { kind: "before_service", next: route[0]! }
  for (let i = 0; i < route.length; i++) {
    const current = route[i]!,
      next = route[i + 1] ?? null
    if (
      minute >= toMinutes(current.arrive) &&
      minute < toMinutes(current.depart)
    )
      return { kind: "at_stop", current, next }
    if (
      next &&
      minute >= toMinutes(current.depart) &&
      minute < toMinutes(next.arrive)
    )
      return { kind: "between", previous: current, next }
  }

  return { kind: "finished", nextService: nextService() }
}
export function cancelledDates(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  stopId: string,
  from: string,
  days: number
): string[] {
  return [
    ...new Set(
      occurrences(tt, notices, from, addDays(from, Math.max(0, days - 1)))
        .filter((o) => o.stopId === stopId && o.cancelledBy)
        .map((o) => o.date)
    ),
  ]
}
