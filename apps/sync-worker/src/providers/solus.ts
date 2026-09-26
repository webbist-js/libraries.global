import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"
import { safeFetch } from "../lib/safe-fetch"

const MAX_FUTURE_MONTHS = 18
const PAGE_LIMIT = 100

const EVENT_TYPE_MAP: Record<string, EventType> = {
  storytime: "storytime",
  "book club": "book_club",
  talk: "talk",
  lecture: "talk",
  workshop: "workshop",
  exhibition: "exhibition",
  tour: "tour",
  film: "screening",
  screening: "screening",
  performance: "performance",
  "drop-in": "drop_in",
  other: "other",
}

function normaliseEndpoint(endpoint: string): string {
  return endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint
}

async function getToken(endpoint: string, secretKey: string): Promise<string> {
  const res = await safeFetch(`${endpoint}/1.0/authorization`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ secretKey }),
  })
  if (!res.ok) throw new Error(`Solus auth failed: ${res.status}`)

  const body = await res.json()
  const token = body?.data?.token as string | undefined
  if (!token) throw new Error("Solus auth: no token in response")

  return token
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const solusProvider: EventProvider = {
  name: "solus",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const { endpoint, secretKey } = credentials
    if (!endpoint || !secretKey) {
      return { ok: false, error: "Missing endpoint or secretKey" }
    }

    try {
      const base = normaliseEndpoint(endpoint)
      const token = await getToken(base, secretKey)

      // Quick probe: list 1 event to confirm token works
      const res = await safeFetch(
        `${base}/1.0/event/query?includeCancelled=false&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      )
      if (!res.ok)
        return { ok: false, error: `Solus event query returned ${res.status}` }

      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  },

  async fetch(
    credentials: ProviderCredentials,
    _hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const { endpoint, secretKey } = credentials
    if (!endpoint || !secretKey) {
      throw new Error("Missing Solus credentials: endpoint, secretKey")
    }

    const base = normaliseEndpoint(endpoint)
    const maxDate = new Date()
    maxDate.setMonth(maxDate.getMonth() + MAX_FUTURE_MONTHS)
    const fromDate = new Date().toISOString().split("T")[0]!

    const token = await getToken(base, secretKey)
    const events: RawEvent[] = []
    let offset = 0
    let hasMore = true
    let totalAvailable: number | null = null

    while (hasMore && events.length < 1000) {
      const params = new URLSearchParams({
        includeCancelled: "false",
        includePrivate: "false",
        limit: String(PAGE_LIMIT),
        offset: String(offset),
        sortBy: "start_time",
        sortOrder: "asc",
        fromDate,
      })

      const res = await safeFetch(`${base}/1.0/event/query?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })
      if (!res.ok) throw new Error(`Solus event query ${res.status}`)

      const body = await res.json()
      const data = body?.data

      if (!data) break

      const eventList: any[] = data.event_list ?? data.events ?? []
      const available: number = data.available ?? data.total ?? eventList.length

      if (totalAvailable === null) totalAvailable = available

      for (const ev of eventList) {
        const id = (ev.event_id ?? ev.id) as string | undefined
        if (!id || !ev.name?.trim() || !(ev.start_time ?? ev.start_date))
          continue

        const startRaw: string = ev.start_time ?? ev.start_date
        const endRaw: string | undefined =
          ev.end_time ?? ev.end_date ?? undefined

        events.push({
          externalId: String(id),
          title: ev.name as string,
          description: (ev.description ?? ev.summary ?? "") as string,
          url: (ev.booking_url ?? ev.url ?? "") as string,
          imageUrl: ev.image_url ?? undefined,
          startTime: new Date(startRaw).toISOString(),
          endTime: endRaw ? new Date(endRaw).toISOString() : undefined,
          allDay: false,
          timezone: (ev.timezone as string | undefined) ?? "UTC",
          tags: [],
          isFree: !ev.booking_required || ev.price === 0,
          venueName: (ev.venue_name ?? ev.location ?? undefined) as
            | string
            | undefined,
        })
      }

      hasMore =
        offset + PAGE_LIMIT < available && eventList.length === PAGE_LIMIT
      offset += PAGE_LIMIT

      if (hasMore) await sleep(250)
    }

    return events
  },
}
