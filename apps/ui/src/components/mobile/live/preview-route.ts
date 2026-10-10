import {
  addDays,
  dayRoute,
  type MobileTimetable,
  type Occurrence,
} from "@repo/shared-data"

/** A saved timetable route for the demonstration, never a live session. */
export function consolePreviewRoute(
  todayRoute: Occurrence[],
  timetable: MobileTimetable | null,
  today: string | undefined
): Occurrence[] {
  if (todayRoute.length) return todayRoute.filter((visit) => !visit.cancelledBy)
  if (!timetable || !today || !timetable.visits.length) return []
  // Match the timetable's two-year lookahead, including monthly/date repeats.
  for (let offset = 1; offset <= 730; offset++) {
    const route = dayRoute(timetable, [], addDays(today, offset))
    if (route.length) return route
  }

  return []
}
