import {
  addDays,
  occurrences,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"

const escape = (text: string) =>
  text
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r?\n/g, String.raw`\n`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll(";", String.raw`\;`)
const utc = (date: Date) =>
  date
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")

/** Convert a library-local calendar time without depending on the server's zone. */
export function localTimeToUtc(
  date: string,
  time: string,
  timezone: string
): Date {
  const desired = Date.parse(`${date}T${time}:00Z`)
  let instant = desired
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = format.formatToParts(new Date(instant)),
      get = (type: string) => parts.find((part) => part.type === type)?.value
    const represented = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
    )
    const correction = desired - represented
    if (!correction) break
    instant += correction
  }

  return new Date(instant)
}
/** RFC 5545 limits each content line to 75 UTF-8 octets. */
export function foldCalendarLine(line: string): string {
  let count = 0,
    output = ""
  for (const char of line) {
    const length = new TextEncoder().encode(char).length
    if (count + length > 75) {
      output += "\r\n "
      count = 1
    }
    output += char
    count += length
  }

  return output
}
export function mobileCalendar(input: {
  id: string
  name: string
  timetable: MobileTimetable
  notices: TimetableNotice[]
  stopId: string
  timezone: string
  from: string
  updatedAt: string
  url?: string
}): string {
  const { timetable: tt } = input
  const stop = tt.stops.find((row) => row.id === input.stopId)
  if (!stop) throw new Error("unknown_stop")
  const end = new Date(`${input.from}T12:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 6)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Libraries Global//Mobile library visits//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    `X-WR-CALNAME:${escape(`${input.name} · ${stop.name}`)}`,
  ]
  for (const visit of occurrences(
    tt,
    input.notices,
    input.from,
    addDays(end.toISOString().slice(0, 10), -1)
  ).filter((row) => row.stopId === stop.id)) {
    const notice = input.notices.find((row) => row.id === visit.cancelledBy)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${input.id}-${visit.visitId}-${visit.date}@libraries.global`,
      `DTSTAMP:${utc(new Date(input.updatedAt))}`,
      `DTSTART:${utc(localTimeToUtc(visit.date, visit.arrive, input.timezone))}`,
      `DTEND:${utc(localTimeToUtc(visit.date, visit.depart, input.timezone))}`,
      `SUMMARY:${escape(`${input.name} at ${stop.name}`)}`,
      `LOCATION:${escape([stop.name, stop.where].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${escape(notice?.message ?? "Check the library page for changes before travelling.")}`,
      `STATUS:${visit.cancelledBy ? "CANCELLED" : "CONFIRMED"}`,
      "SEQUENCE:0",
      ...(input.url ? [`URL:${input.url}`] : []),
      "END:VEVENT"
    )
  }
  lines.push("END:VCALENDAR")

  return lines.map(foldCalendarLine).join("\r\n") + "\r\n"
}
