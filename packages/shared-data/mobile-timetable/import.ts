import { newTimetableId } from "./normalize"
import {
  WEEKDAYS,
  type MobileTimetable,
  type MobileVisit,
  type Weekday,
} from "./types"

/** RFC 4180 CSV or tab-separated clipboard text, including quoted landmarks. */
export function spreadsheetRows(text: string): string[][] {
  const delimiter = text.split(/\r?\n/, 1)[0]?.includes("\t") ? "\t" : ","
  const rows: string[][] = [],
    row: string[] = []
  let cell = "",
    quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (!quoted && char === delimiter) {
      row.push(cell.trim())
      cell = ""
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push([...row])
      row.length = 0
      cell = ""
    } else cell += char
  }
  if (quoted) throw new Error("A quoted cell has no closing quote.")
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)

  return rows
}
const key = (s: string) => s.toLowerCase().replaceAll(/[^a-z0-9]/g, "")

export const TIMETABLE_IMPORT_COLUMNS = [
  "name",
  "where",
  "day",
  "arrive",
  "depart",
  "weeks",
  "dates",
  "frequency",
  "lat",
  "lng",
] as const
export type TimetableImportColumn = (typeof TIMETABLE_IMPORT_COLUMNS)[number]
const aliases: Record<TimetableImportColumn, string[]> = {
  name: ["stop", "stopname", "name", "village", "location"],
  where: ["where", "landmark", "address", "description"],
  day: ["day", "weekday", "dayofweek"],
  arrive: [
    "arrive",
    "arrival",
    "arrivaltime",
    "start",
    "starttime",
    "timefrom",
  ],
  depart: [
    "depart",
    "departure",
    "departuretime",
    "leave",
    "leaving",
    "end",
    "endtime",
    "timeto",
  ],
  weeks: ["weeks", "week", "cycleweek", "weeknumber"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
  dates: ["dates", "date", "specificdates"],
  frequency: ["howoften", "frequency", "repeat", "repeats"],
}

export function matchTimetableColumns(
  headers: string[]
): Record<TimetableImportColumn, number> {
  return Object.fromEntries(
    Object.entries(aliases).map(([field, options]) => [
      field,
      headers.findIndex((h) => options.includes(key(h))),
    ])
  ) as Record<TimetableImportColumn, number>
}
export function importTimetableSpreadsheet(
  tt: MobileTimetable,
  text: string,
  mapping: Partial<Record<TimetableImportColumn, number>> = {}
): { timetable: MobileTimetable; imported: number; errors: string[] } {
  if (new TextEncoder().encode(text).length > 200_000)
    return {
      timetable: tt,
      imported: 0,
      errors: ["Use a spreadsheet smaller than 200 KB."],
    }
  let rows: string[][]
  try {
    rows = spreadsheetRows(text)
  } catch (error) {
    return { timetable: tt, imported: 0, errors: [(error as Error).message] }
  }
  const headers = rows.shift() ?? [],
    columns = { ...matchTimetableColumns(headers), ...mapping }
  if (
    (["name", "day", "arrive", "depart"] as const).some(
      (field) => columns[field] < 0
    )
  )
    return {
      timetable: tt,
      imported: 0,
      errors: ["Include Stop, Day, Arrival and Departure column headings."],
    }
  if (rows.length > 600)
    return { timetable: tt, imported: 0, errors: ["Import at most 600 rows."] }
  const next: MobileTimetable = {
      ...tt,
      stops: [...tt.stops],
      visits: [...tt.visits],
    },
    errors: string[] = []
  let imported = 0
  for (const [i, row_] of rows.entries()) {
    const row = row_!,
      get = (field: TimetableImportColumn) =>
        columns[field] < 0 ? "" : (row[columns[field]] ?? "")
    const name = get("name"),
      day = get("day").slice(0, 3).toLowerCase() as Weekday
    if (!name || !WEEKDAYS.includes(day)) {
      errors.push(`Row ${i + 2}: add a stop name and weekday.`)
      continue
    }
    let stop = next.stops.find(
      (s) => s.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
    if (!stop) {
      const lat = get("lat"),
        lng = get("lng")
      const location =
        lat &&
        lng &&
        Number.isFinite(Number(lat)) &&
        Number.isFinite(Number(lng)) &&
        Math.abs(Number(lat)) <= 90 &&
        Math.abs(Number(lng)) <= 180
          ? { lat: Number(lat), lng: Number(lng) }
          : null
      stop = {
        id: newTimetableId(),
        name,
        where: get("where"),
        location,
        areaDocumentId: null,
      }
      next.stops.push(stop)
    }
    const hm = (s: string) => (s.length === 4 && s[1] === ":" ? `0${s}` : s)
    const weeks = get("weeks")
      .split(/[\s,;|]+/)
      .filter(Boolean)
      .map(Number)
    const dates = get("dates")
      .split(/[\s,;|]+/)
      .filter(Boolean)
    let repeat: MobileVisit["repeat"] = dates.length
      ? { kind: "dates", dates }
      : {
          kind: "cycle",
          weeks: weeks.length
            ? weeks
            : Array.from({ length: tt.cycle.weeks }, (_, w) => w + 1),
        }
    const frequency = get("frequency").toLowerCase().trim(),
      ordinal = frequency.match(/^(1st|2nd|3rd|4th|last)\b/),
      cycle = frequency.match(/^(?:week\s*)?([1-4])\s*(?:only)?$/)
    if (
      frequency &&
      !weeks.length &&
      !dates.length &&
      !["weekly", "every week", "term time only"].includes(frequency)
    ) {
      if (ordinal)
        repeat = {
          kind: "monthly",
          nth:
            ordinal[1] === "last"
              ? -1
              : (Number(ordinal[1]?.[0]) as 1 | 2 | 3 | 4),
        }
      else if (cycle) repeat = { kind: "cycle", weeks: [Number(cycle[1])] }
      else if (
        frequency === `every ${tt.cycle.weeks} weeks` ||
        (frequency === "fortnightly" && tt.cycle.weeks === 2)
      )
        repeat = { kind: "cycle", weeks: [1] }
      else {
        errors.push(
          `Row ${i + 2}: match “${get("frequency")}” using Weeks or Dates, or set the matching cycle length.`
        )
        continue
      }
    }
    const visit: MobileVisit = {
      id: newTimetableId(),
      stopId: stop.id,
      day,
      arrive: hm(get("arrive")),
      depart: hm(get("depart")),
      repeat,
      termTimeOnly: frequency === "term time only",
      validFrom: null,
      validTo: null,
    }
    next.visits.push(visit)
    imported++
  }

  return { timetable: next, imported, errors }
}
