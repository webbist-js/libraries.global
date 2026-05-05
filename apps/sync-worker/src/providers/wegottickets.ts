import { XMLParser } from "fast-xml-parser"

import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"

const MAX_EVENTS = 200

const EVENT_TYPE_MAP: Record<string, EventType> = {
  theatre: "performance",
  comedy: "performance",
  music: "performance",
  concert: "performance",
  dance: "performance",
  exhibition: "exhibition",
  film: "screening",
  talks: "talk",
  workshop: "workshop",
  tour: "tour",
  children: "storytime",
  family: "storytime",
  other: "other",
}

function parseXml(xml: string): any[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
  })

  const parsed = parser.parse(xml)
  if (!parsed?.wegottickets) return []

  let events = parsed.wegottickets.event ?? []
  if (!Array.isArray(events)) events = [events]

  return events as any[]
}

function extractVenueName(venue: any): string {
  if (!venue) return ""
  if (typeof venue === "string") return venue
  if (typeof venue === "object") {
    return (venue["#text"] ?? venue._text ?? venue.title ?? "") as string
  }

  return ""
}

/**
 * Convert WeGotTickets date ("Fri, 14 Nov 2025") + time ("7:00pm") → ISO string.
 * Assumes UK/GMT timezone.
 */
function buildStartISO(rawDate?: string, rawTime?: string): string | null {
  if (!rawDate || !rawTime) return null

  const cleanedDate = rawDate.replace(/^[A-Za-z]{3},\s*/, "").trim()
  const cleanedTime = rawTime.trim().toLowerCase()

  const m = cleanedTime.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/)
  if (!m) return null

  let hh = Number.parseInt(m[1]!, 10)
  const mm = Number.parseInt(m[2] ?? "00", 10)
  const ampm = m[3]!

  if (ampm === "pm" && hh !== 12) hh += 12
  if (ampm === "am" && hh === 12) hh = 0

  const candidate = `${cleanedDate} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00 GMT`
  const d = new Date(candidate)
  if (Number.isNaN(d.getTime())) return null

  return d.toISOString()
}

export const wegottickets: EventProvider = {
  name: "wegottickets",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const { feedUrl } = credentials
    if (!feedUrl) return { ok: false, error: "Missing feedUrl" }

    try {
      const res = await fetch(feedUrl, {
        headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
      })
      if (!res.ok) return { ok: false, error: `Feed returned ${res.status}` }

      const xml = await res.text()
      const events = parseXml(xml)
      const usable = events.some((ev) => ev?.id && ev?.title)
      if (!usable)
        return { ok: false, error: "Feed contained no usable events" }

      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  },

  async fetch(
    credentials: ProviderCredentials,
    _hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const { feedUrl } = credentials
    if (!feedUrl) throw new Error("Missing WeGotTickets feedUrl")

    const res = await fetch(feedUrl, {
      headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
    })
    if (!res.ok) throw new Error(`WeGotTickets feed ${res.status}: ${feedUrl}`)

    const xml = await res.text()
    const rawEvents = parseXml(xml)

    const events: RawEvent[] = []

    for (const ev of rawEvents) {
      if (events.length >= MAX_EVENTS) break
      if (!ev?.id || !ev?.title) continue

      const startISO = buildStartISO(
        ev.date?.start ?? undefined,
        ev.time?.info ?? ev.time?.start ?? undefined
      )
      if (!startISO) continue

      const venueName = extractVenueName(ev.venue)

      // isFree heuristic
      const minVal =
        ev.price?.min?.["#text"] ?? ev.price?.min?._text ?? ev.price?.min
      const isFree = minVal != null && Number.parseFloat(String(minVal)) === 0

      events.push({
        externalId: `wegottickets-${ev.id}`,
        title: ev.title as string,
        description: (ev.description ?? "") as string,
        url: (ev.link ?? "") as string,
        imageUrl: (ev.image as string | undefined) ?? undefined,
        startTime: startISO,
        allDay: false,
        timezone: "Europe/London",
        tags: ev.genre ? [ev.genre as string] : [],
        isFree,
        venueName: venueName || undefined,
      })
    }

    return events
  },
}
