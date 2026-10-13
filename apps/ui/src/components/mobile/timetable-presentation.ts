import {
  addDays,
  cycleWeekOf,
  localDateTime,
  scheduleState,
  WEEKDAYS,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"

/** All timetable surfaces resolve their calendar from the same published recurrence rules. */
export function timetablePresentation(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  now: Date,
  timezone: string
) {
  const local = localDateTime(now, timezone)
  const state = scheduleState(tt, notices, now, timezone)
  const next = "nextService" in state ? state.nextService : null
  const nextDate = next?.date ?? local.date
  const week = cycleWeekOf(tt, nextDate)
  const monday = addDays(
    nextDate,
    -WEEKDAYS.indexOf(
      localDateTime(new Date(`${nextDate}T12:00:00Z`), "UTC").weekday
    )
  )
  const valid = tt.visits.filter(
    (visit) => !visit.validTo || visit.validTo >= local.date
  )
  const allFinite = valid.length > 0 && valid.every((visit) => visit.validTo)
  const end = allFinite
    ? valid
        .map((visit) => visit.validTo!)
        .sort()
        .at(-1)!
    : null
  const expired = tt.visits.length > 0 && valid.length === 0
  const warning = end && end <= addDays(local.date, 60) ? end : null

  return {
    local,
    state,
    next,
    week,
    monday,
    warning,
    expired,
    weekStart: (target: number) =>
      addDays(monday, ((target - week + tt.cycle.weeks) % tt.cycle.weeks) * 7),
  }
}
