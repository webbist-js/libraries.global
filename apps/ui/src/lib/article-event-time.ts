import dayjs from "dayjs"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

dayjs.extend(utc)
dayjs.extend(timezone)

/** A contributor's local wall time becomes an explicit instant in their named IANA zone. */
export function articleEventTime(value: string, zone: string): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Invalid date")
  new Intl.DateTimeFormat("en", { timeZone: zone }).format()
  const date = dayjs.tz(value, zone)
  if (!date.isValid() || date.format("YYYY-MM-DDTHH:mm") !== value)
    throw new Error("Invalid local time")

  return date.toISOString()
}
