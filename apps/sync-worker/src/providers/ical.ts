import ICAL from "ical.js"

import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"
import { safeFetch } from "../lib/safe-fetch"

const EVENT_TYPE_MAP: Record<string, EventType> = {
  READING: "reading_group",
  BOOK: "book_club",
  STORY: "storytime",
  TALK: "talk",
  LECTURE: "talk",
  WORKSHOP: "workshop",
  EXHIBITION: "exhibition",
  TOUR: "tour",
  FILM: "screening",
  SCREENING: "screening",
  PERFORMANCE: "performance",
}

/**
 * Unfold iCal line continuations per RFC 5545 §3.1.
 * A line starting with SP/HTAB is a continuation of the previous line.
 * Exception: lines following a component boundary (BEGIN:/END:) are treated
 * as new properties rather than continuations — some feeds emit the first
 * property of a VEVENT with a leading space immediately after BEGIN:VEVENT.
 */
function unfoldIcal(text: string): string {
  const lines = text.split(/\r?\n/)
  const result: string[] = []
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      const prev = result.at(-1) ?? ""
      if (/^(BEGIN|END):/i.test(prev)) {
        // Treat as a new property — strip the leading whitespace
        result.push(line.slice(1))
      } else {
        // Standard fold: merge onto previous line
        result[result.length - 1] = prev + line.slice(1)
      }
    } else {
      result.push(line)
    }
  }

  return result.join("\n")
}

/**
 * Convert an ICAL.Time to a JS Date, honouring its TZID.
 *
 * ical.js only resolves a TZID when the matching VTIMEZONE has been
 * registered; otherwise the time is "floating" and `toJSDate()` interprets the
 * wall-clock value in the *server's* local timezone. On a UTC host that shifts
 * every London event by an hour during BST. We resolve the offset ourselves
 * with Intl so the result is independent of the host timezone.
 */
export function icalTimeToDate(time: ICAL.Time, tzid: string): Date {
  const isFloating = !time.zone || time.zone.tzid === "floating"
  if (!isFloating) return time.toJSDate()

  const wallClockAsUtc = Date.UTC(
    time.year,
    time.month - 1,
    time.day,
    time.hour,
    time.minute,
    time.second
  )
  if (time.isDate || tzid === "UTC") return new Date(wallClockAsUtc)

  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tzid,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    // Unknown TZID (e.g. a Windows zone name) — treat the wall clock as UTC.
    return new Date(wallClockAsUtc)
  }

  const offsetAt = (instant: number): number => {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(instant)).map((p) => [p.type, p.value])
    )
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    )

    return asUtc - instant
  }

  // Two passes settle the offset across DST transitions.
  let instant = wallClockAsUtc - offsetAt(wallClockAsUtc)
  instant = wallClockAsUtc - offsetAt(instant)

  return new Date(instant)
}

async function fetchFeed(
  feedUrl: string,
  username?: string,
  password?: string
): Promise<string> {
  const headers: Record<string, string> = {}
  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  }
  const res = await safeFetch(feedUrl, { headers })
  if (!res.ok) throw new Error(`iCal feed returned ${res.status}: ${feedUrl}`)

  return res.text()
}

export const icalProvider: EventProvider = {
  name: "ical",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    try {
      await fetchFeed(
        credentials.feedUrl!,
        credentials.username,
        credentials.password
      )

      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  },

  async fetch(
    credentials: ProviderCredentials,
    _hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const rawText = await fetchFeed(
      credentials.feedUrl!,
      credentials.username,
      credentials.password
    )
    const icalText = unfoldIcal(rawText)
    const parsed = ICAL.parse(icalText)
    const comp = new ICAL.Component(parsed)
    const vevents = comp.getAllSubcomponents("vevent")

    const events: RawEvent[] = []
    for (const vevent of vevents) {
      const ev = new ICAL.Event(vevent)
      if (!ev.startDate) continue

      // ical.js sets an undeclared `timezone` string from the TZID parameter;
      // `zone.tzid` is only meaningful when a VTIMEZONE was registered.
      const declaredTz = (ev.startDate as unknown as { timezone?: string })
        .timezone
      const zoneTz = ev.startDate.zone?.tzid
      const tzid =
        declaredTz ?? (zoneTz && zoneTz !== "floating" ? zoneTz : "UTC")

      const startDt = icalTimeToDate(ev.startDate, tzid)
      const endDt = ev.endDate ? icalTimeToDate(ev.endDate, tzid) : null
      const uid = ev.uid ?? `${startDt.toISOString()}-${ev.summary}`
      const title = ev.summary ?? ""
      const description = ev.description ?? ""
      const url = (vevent.getFirstPropertyValue("url") as string | null) ?? ""

      // Derive eventType from title keywords
      const upperTitle = title.toUpperCase()
      let providerCategory: string | undefined
      for (const [kw] of Object.entries(EVENT_TYPE_MAP)) {
        if (upperTitle.includes(kw)) {
          providerCategory = kw
          break
        }
      }

      events.push({
        externalId: uid,
        title,
        description,
        url,
        startTime: startDt.toISOString(),
        endTime: endDt?.toISOString(),
        allDay: ev.startDate.isDate,
        timezone: tzid,
        providerCategory,
        tags: [],
        isFree: true, // iCal feeds don't expose pricing — assume free unless URL contains ticket keywords
      })
    }

    return events
  },
}
