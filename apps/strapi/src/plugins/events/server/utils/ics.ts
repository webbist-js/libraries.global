// apps/strapi/src/plugins/events/server/utils/ics.ts

interface IcsEvent {
  uid: string
  summary: string
  description?: string | null
  dtstart: string // ISO 8601
  dtend?: string | null
  allDay?: boolean
  url?: string | null
  location?: string | null
}

function toIcsDate(iso: string, allDay = false): string {
  const d = new Date(iso)
  if (allDay) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")

    return `${y}${m}${day}`
  }

  return d.toISOString().replaceAll(/[-:]/g, "").slice(0, 15) + "Z"
}

function escapeIcs(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll(";", String.raw`\;`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll("\n", String.raw`\n`)
}

function foldLine(line: string): string {
  // RFC 5545: fold lines longer than 75 octets
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  chunks.push(line.slice(0, 75))
  i = 75
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74))
    i += 74
  }

  return chunks.join("\r\n")
}

export function buildIcs(events: IcsEvent[], calName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//libraries.global//Events//EN",
    `X-WR-CALNAME:${escapeIcs(calName)}`,
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const e of events) {
    const startProp = e.allDay ? "DTSTART;VALUE=DATE" : "DTSTART"
    const endProp = e.allDay ? "DTEND;VALUE=DATE" : "DTEND"

    const eventLines = [
      "BEGIN:VEVENT",
      foldLine(`UID:${e.uid}@libraries.global`),
      foldLine(`SUMMARY:${escapeIcs(e.summary)}`),
      foldLine(`${startProp}:${toIcsDate(e.dtstart, e.allDay)}`),
      ...(e.dtend
        ? [foldLine(`${endProp}:${toIcsDate(e.dtend, e.allDay)}`)]
        : []),
      ...(e.description
        ? [foldLine(`DESCRIPTION:${escapeIcs(e.description)}`)]
        : []),
      ...(e.url ? [foldLine(`URL:${e.url}`)] : []),
      ...(e.location ? [foldLine(`LOCATION:${escapeIcs(e.location)}`)] : []),
      "END:VEVENT",
    ]
    lines.push(...eventLines)
  }

  lines.push("END:VCALENDAR")

  return lines.join("\r\n")
}
