import ICAL from "ical.js"

import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"

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

async function fetchFeed(
  feedUrl: string,
  username?: string,
  password?: string
): Promise<string> {
  const headers: Record<string, string> = {}
  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  }
  const res = await fetch(feedUrl, { headers })
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

      const startDt = ev.startDate.toJSDate()
      const endDt = ev.endDate?.toJSDate() ?? null
      const uid = ev.uid ?? `${startDt.toISOString()}-${ev.summary}`
      const title = ev.summary ?? ""
      const description = ev.description ?? ""
      const url = (vevent.getFirstPropertyValue("url") as string | null) ?? ""
      const tzid = ev.startDate.timezone ?? "UTC"

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
