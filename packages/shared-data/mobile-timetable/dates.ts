import { WEEKDAYS, type Weekday } from "./types"

const DAY_MS = 86_400_000

export function isCalendarDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false
  const parsed = new Date(`${date}T00:00:00Z`)

  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  )
}
function dateMillis(date: string): number {
  if (!isCalendarDate(date)) throw new RangeError("Invalid calendar date")

  return Date.parse(`${date}T00:00:00Z`)
}

export function epochWeek(date: string): number {
  return Math.floor((dateMillis(date) - Date.UTC(1970, 0, 5)) / (7 * DAY_MS))
}
export function addDays(date: string, n: number): string {
  return new Date(dateMillis(date) + Math.trunc(n) * DAY_MS)
    .toISOString()
    .slice(0, 10)
}
export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[(new Date(dateMillis(date)).getUTCDay() + 6) % 7]!
}
const formatters = new Map<string, Intl.DateTimeFormat>()

export function localDateTime(
  now: Date,
  tz: string
): { date: string; minute: number; weekday: Weekday } {
  let formatter = formatters.get(tz)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    if (formatters.size >= 100) formatters.clear()
    formatters.set(tz, formatter)
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value])
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`

  return {
    date,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdayOf(date),
  }
}
export function toMinutes(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm)

  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN
}
export function fromMinutes(m: number): string {
  return `${Math.floor(m / 60)
    .toString()
    .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`
}
export const positiveModulo = (n: number, modulus: number) =>
  ((n % modulus) + modulus) % modulus
