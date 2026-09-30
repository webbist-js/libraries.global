// apps/strapi/src/plugins/events/server/utils/ics.ts
import { createHash } from "node:crypto"

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

const MAX_LINE_OCTETS = 75

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

/**
 * RFC 5545 TEXT escaping. Line breaks become the literal `\n` sequence and a
 * bare CR is dropped, so a value can never start a new content line (CRLF
 * injection) whatever the contributor or provider put in it.
 */
export function escapeIcs(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll(";", String.raw`\;`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "")
    .replaceAll("\n", String.raw`\n`)
}

/**
 * RFC 5545 §3.1: content lines longer than 75 **octets** are folded with
 * CRLF + one space. Counted in UTF-8 bytes (not characters) and only split
 * between code points, so multibyte text never ends up with a broken
 * character at a fold.
 */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= MAX_LINE_OCTETS) return line

  const chunks: string[] = []
  let current = ""
  let currentBytes = 0
  // The first physical line holds 75 octets; continuation lines start with
  // a space, which counts, so they hold 74.
  let budget = MAX_LINE_OCTETS
  for (const ch of line) {
    const bytes = Buffer.byteLength(ch, "utf8")
    if (currentBytes + bytes > budget) {
      chunks.push(current)
      current = ""
      currentBytes = 0
      budget = MAX_LINE_OCTETS - 1
    }
    current += ch
    currentBytes += bytes
  }
  if (current) chunks.push(current)

  return chunks.map((c, i) => (i === 0 ? c : ` ${c}`)).join("\r\n")
}

/** Only `[A-Za-z0-9_-]` survives, so an entity ref can't smuggle quotes or path separators into Content-Disposition. */
export function safeIcsFilename(name: string): string {
  const safe = String(name ?? "").replaceAll(/[^A-Za-z0-9_-]/g, "")

  return safe || "events"
}

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url.trim())

/** A UID that is never `null@…`: the documentId when present, else a stable hash of the event's identity. */
function icsUid(e: IcsEvent): string {
  const given = String(e.uid ?? "").replaceAll(/[^A-Za-z0-9-]/g, "")
  if (given) return given

  return createHash("sha256")
    .update(`${e.summary}|${e.dtstart}|${e.dtend ?? ""}|${e.url ?? ""}`)
    .digest("hex")
    .slice(0, 24)
}

export function buildIcs(events: IcsEvent[], calName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//libraries.global//Events//EN",
    foldLine(`X-WR-CALNAME:${escapeIcs(calName)}`),
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  const seen = new Set<string>()
  for (const e of events) {
    const startProp = e.allDay ? "DTSTART;VALUE=DATE" : "DTSTART"
    const endProp = e.allDay ? "DTEND;VALUE=DATE" : "DTEND"
    let uid = icsUid(e)
    // Two events without a documentId and identical content still need
    // distinct UIDs, or calendar clients collapse them.
    while (seen.has(uid)) uid = `${uid}-${seen.size}`
    seen.add(uid)

    const eventLines = [
      "BEGIN:VEVENT",
      foldLine(`UID:${uid}@libraries.global`),
      foldLine(`SUMMARY:${escapeIcs(e.summary ?? "")}`),
      foldLine(`${startProp}:${toIcsDate(e.dtstart, e.allDay)}`),
      ...(e.dtend
        ? [foldLine(`${endProp}:${toIcsDate(e.dtend, e.allDay)}`)]
        : []),
      ...(e.description
        ? [foldLine(`DESCRIPTION:${escapeIcs(e.description)}`)]
        : []),
      ...(e.url && isHttpUrl(e.url)
        ? [foldLine(`URL:${escapeIcs(e.url.trim())}`)]
        : []),
      ...(e.location ? [foldLine(`LOCATION:${escapeIcs(e.location)}`)] : []),
      "END:VEVENT",
    ]
    lines.push(...eventLines)
  }

  lines.push("END:VCALENDAR")

  return lines.join("\r\n")
}
