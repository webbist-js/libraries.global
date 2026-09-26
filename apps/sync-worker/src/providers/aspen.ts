import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"
import { safeFetch } from "../lib/safe-fetch"

const PAGE_SIZE = 100
const MAX_FUTURE_MONTHS = 18

const EVENT_TYPE_MAP: Record<string, EventType> = {
  storytime: "storytime",
  "story time": "storytime",
  "book club": "book_club",
  reading: "reading_group",
  talk: "talk",
  lecture: "talk",
  workshop: "workshop",
  exhibition: "exhibition",
  tour: "tour",
  film: "screening",
  screening: "screening",
  performance: "performance",
  "drop-in": "drop_in",
  "drop in": "drop_in",
  other: "other",
}

function getFutureWindow(): { startDate: string; endDate: string } {
  const now = new Date()
  const end = new Date()
  end.setMonth(end.getMonth() + MAX_FUTURE_MONTHS)

  return {
    startDate: now.toISOString().split("T")[0]!,
    endDate: end.toISOString().split("T")[0]!,
  }
}

function buildAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

async function fetchPage(
  endpoint: string,
  authHeader: string,
  page: number,
  startDate: string
): Promise<any> {
  const url = new URL(endpoint)
  url.searchParams.set(
    "method",
    url.searchParams.get("method") ?? "getEventInstances"
  )
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(PAGE_SIZE))
  url.searchParams.set("startDate", startDate)

  const res = await safeFetch(url.toString(), {
    headers: { Authorization: authHeader, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Aspen API ${res.status}: ${url.toString()}`)

  const data = await res.json()
  const result = data?.result
  if (!result?.success || !Array.isArray(result.items)) {
    throw new Error("Aspen returned unexpected response payload")
  }

  return result
}

function isWithinFutureWindow(dateStr: string): boolean {
  const now = new Date()
  const max = new Date()
  max.setMonth(max.getMonth() + MAX_FUTURE_MONTHS)
  const d = new Date(dateStr)

  return !Number.isNaN(d.getTime()) && d >= now && d <= max
}

export const aspenProvider: EventProvider = {
  name: "aspen",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const { endpoint, clientId, clientSecret } = credentials
    if (!endpoint || !clientId || !clientSecret) {
      return { ok: false, error: "Missing endpoint, clientId, or clientSecret" }
    }

    try {
      const authHeader = buildAuthHeader(clientId, clientSecret)
      await fetchPage(
        endpoint,
        authHeader,
        1,
        new Date().toISOString().split("T")[0]!
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
    const { endpoint, clientId, clientSecret } = credentials
    if (!endpoint || !clientId || !clientSecret) {
      throw new Error(
        "Missing Aspen credentials: endpoint, clientId, clientSecret"
      )
    }

    const authHeader = buildAuthHeader(clientId, clientSecret)
    const { startDate } = getFutureWindow()
    const events: RawEvent[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages && events.length < 5000) {
      const result = await fetchPage(endpoint, authHeader, page, startDate)
      totalPages = Math.max(1, Number(result.totalPages) || 1)

      for (const item of result.items as any[]) {
        if (!item?.id || !item?.title || item?.private) continue

        const instances: any[] = Array.isArray(item.instances)
          ? item.instances.filter(
              (i: any) =>
                i?.startDateTime && isWithinFutureWindow(i.startDateTime)
            )
          : []

        for (const instance of instances) {
          const instanceId = instance.id ?? instance.startDateTime
          events.push({
            externalId: `${item.id}-${instanceId}`,
            title: item.title as string,
            description: (item.description ??
              item.program?.description ??
              "") as string,
            url: (item.url ?? item.bookingUrl ?? "") as string,
            imageUrl: (item.images as any[])?.[0]?.url ?? undefined,
            startTime: new Date(instance.startDateTime as string).toISOString(),
            endTime: instance.endDateTime
              ? new Date(instance.endDateTime as string).toISOString()
              : undefined,
            allDay: false,
            timezone: "UTC",
            providerCategory: Array.isArray(item.eventTypes)
              ? (item.eventTypes[0] as string | undefined)
              : undefined,
            tags: Array.isArray(item.eventTypes)
              ? (item.eventTypes as string[])
              : [],
            isFree:
              !item.registrationRequired ||
              (item.prices as any[])?.[0]?.amount === 0,
            capacity:
              typeof item.registrationLimit === "number"
                ? (item.registrationLimit as number)
                : undefined,
          })
        }
      }

      page++
    }

    return events
  },
}
