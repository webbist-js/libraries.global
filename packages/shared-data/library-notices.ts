export type LibraryNoticeType =
  | "closure"
  | "changed_hours"
  | "service"
  | "not_running"
  | "times_changed"
  | "stop_moved"
  | "extra_visit"
export type LibraryNotice = {
  id: string
  documentId?: string
  type: LibraryNoticeType
  scope: "library" | "service" | "day" | "stop" | "term_time"
  scopeWeek: number | null
  scopeDay: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" | null
  stopId: string | null
  from: string
  to: string | null
  endedAt: string | null
  message: string
  reason: string | null
  hours?: unknown
}
export const LIBRARY_NOTICE_LABELS: Record<LibraryNoticeType, string> = {
  closure: "Temporary closure",
  changed_hours: "Changed hours",
  service: "Service notice",
  not_running: "Not running",
  times_changed: "Times changed",
  stop_moved: "Stop moved",
  extra_visit: "Extra visit",
}
export const noticeAddDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
export const noticeEndDate = (
  notice: Pick<LibraryNotice, "from" | "to">
): string => notice.to ?? noticeAddDays(notice.from, 29)
export const noticeIsActive = (notice: LibraryNotice, date: string): boolean =>
  !notice.endedAt && notice.from <= date && noticeEndDate(notice) >= date
export const noticeIsUpcoming = (
  notice: LibraryNotice,
  date: string,
  withinDays = 14
): boolean =>
  !notice.endedAt &&
  notice.from > date &&
  notice.from <= noticeAddDays(date, withinDays)
export function noticeLocalDate(
  now: Date,
  timezone: string | null | undefined
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}
export function effectiveLibraryHours(
  hours: unknown,
  notices: readonly LibraryNotice[],
  date: string
): { closed: boolean; hours: unknown } {
  const active = notices.filter((n) => noticeIsActive(n, date))
  if (active.some((n) => n.type === "closure"))
    return { closed: true, hours: null }
  const changed = active
    .filter((n) => n.type === "changed_hours" && n.hours)
    .sort((a, b) => b.from.localeCompare(a.from) || b.id.localeCompare(a.id))[0]

  return { closed: false, hours: changed?.hours ?? hours }
}
/** A displayed/indexed week keeps each notice confined to its actual dates. */
export function effectiveLibraryWeekHours(
  hours: unknown,
  notices: readonly LibraryNotice[],
  monday: string
): unknown {
  const week = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]
  const original =
    hours && typeof hours === "object" ? (hours as Record<string, unknown>) : {}

  return {
    ...original,
    version: 1,
    days: week.map((day, offset) => {
      const effective = effectiveLibraryHours(
        hours,
        notices,
        noticeAddDays(monday, offset)
      )
      const source = effective.hours as {
        days?: { day?: string; [key: string]: unknown }[]
      } | null

      return (
        source?.days?.find((entry) => entry.day === day) ?? {
          day,
          enabled: false,
          timeframes: [],
        }
      )
    }),
  }
}
export function closedNoticeDates(
  notices: readonly LibraryNotice[],
  today: string,
  days = 60
): string[] {
  const dates: string[] = []
  for (let n = 0; n < days; n += 1) {
    const date = noticeAddDays(today, n)
    if (
      notices.some(
        (notice) => notice.type === "closure" && noticeIsActive(notice, date)
      )
    )
      dates.push(date)
  }

  return dates
}
