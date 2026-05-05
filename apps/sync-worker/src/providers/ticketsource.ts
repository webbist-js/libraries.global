import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"

const BASE = "https://api.ticketsource.io"
const PER_PAGE = 100
const MAX_FUTURE_MONTHS = 18

const EVENT_TYPE_MAP: Record<string, EventType> = {
  theatre: "performance",
  comedy: "performance",
  music: "performance",
  concert: "performance",
  dance: "performance",
  exhibition: "exhibition",
  film: "screening",
  "film & cinema": "screening",
  talk: "talk",
  lecture: "talk",
  workshop: "workshop",
  tour: "tour",
  "family & children": "storytime",
  other: "other",
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function dateWindow(): { from: string; to: string } {
  const now = new Date()
  const end = new Date()
  end.setMonth(end.getMonth() + MAX_FUTURE_MONTHS)
  const toYMD = (d: Date) => d.toISOString().slice(0, 10)

  return { from: toYMD(now), to: toYMD(end) }
}

async function fetchAllPages(
  url: string,
  headers: Record<string, string>,
  extraParams?: Record<string, string>
): Promise<any[]> {
  const out: any[] = []
  let page = 1

  while (page <= 50) {
    const params = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(page),
      ...extraParams,
    })
    const res = await fetch(`${url}?${params}`, { headers })
    if (!res.ok) throw new Error(`TicketSource ${res.status}: ${url}`)

    const data = await res.json()
    const items: any[] = Array.isArray(data?.data) ? data.data : []
    out.push(...items)

    const hasNext = Boolean(data?.links?.next)
    if (!hasNext || items.length < PER_PAGE) break

    page++
    await sleep(500)
  }

  return out
}

export const ticketsourceProvider: EventProvider = {
  name: "ticketsource",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const { apiKey } = credentials
    if (!apiKey) return { ok: false, error: "Missing apiKey" }

    try {
      const res = await fetch(`${BASE}/events?per_page=1&page=1`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "User-Agent": "libraries-global-events/1.0",
        },
      })
      if (res.ok) return { ok: true }

      return { ok: false, error: `TicketSource returned ${res.status}` }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  },

  async fetch(
    credentials: ProviderCredentials,
    _hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const { apiKey } = credentials
    if (!apiKey) throw new Error("Missing TicketSource apiKey")

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "User-Agent": "libraries-global-events/1.0",
    }

    const { from, to } = dateWindow()

    // Fetch all events (public only)
    let allEvents = await fetchAllPages(`${BASE}/events`, headers)
    allEvents = allEvents.filter((e) => e?.attributes?.public === true)

    const events: RawEvent[] = []

    // Enrich each event with its dates and venues
    for (let i = 0; i < allEvents.length && events.length < 1000; i++) {
      const ev = allEvents[i]!

      let dates: any[] = []
      try {
        const datesUrl =
          (ev.links?.dates as string | undefined) ??
          `${BASE}/events/${ev.id}/dates`
        dates = await fetchAllPages(datesUrl, headers, {
          "filter[start][operator]": "between",
          "filter[start][value]": from,
          "filter[start][value2]": to,
        })
      } catch {
        // skip events where dates fetch fails
      }

      let venue: any = null
      try {
        const venuesUrl =
          (ev.links?.venues as string | undefined) ??
          `${BASE}/events/${ev.id}/venues`
        const venues = await fetchAllPages(venuesUrl, headers, {
          per_page: "1",
          page: "1",
        })
        venue = venues[0]?.attributes ?? null
      } catch {
        // venue fetch failure is non-fatal
      }

      for (const date of dates) {
        const startRaw: string | undefined = date.attributes?.start
        if (!startRaw) continue

        events.push({
          externalId: `${ev.id}-${date.id}`,
          title: (ev.attributes?.name ??
            ev.attributes?.reference ??
            "Untitled") as string,
          description: (ev.attributes?.description ?? "") as string,
          url: (ev.attributes?.web_link ?? "") as string,
          imageUrl: undefined,
          startTime: new Date(startRaw).toISOString(),
          endTime: date.attributes?.end
            ? new Date(date.attributes.end as string).toISOString()
            : undefined,
          allDay: false,
          timezone: "UTC",
          tags: [],
          isFree: false,
          venueName: (venue?.name as string | undefined) ?? undefined,
          venueAddress: (venue?.address as string | undefined) ?? undefined,
        })
      }

      await sleep(200)
    }

    return events
  },
}
