import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"

const BASE = "https://www.eventbriteapi.com/v3"

const EVENT_TYPE_MAP: Record<string, EventType> = {
  lectures_and_books: "talk",
  literary_arts: "talk",
  seminars: "talk",
  workshops_and_classes: "workshop",
  learning_and_education: "workshop",
  family_and_education: "storytime",
  kids_and_family: "storytime",
  reading_groups: "reading_group",
  book_club: "book_club",
  exhibitions: "exhibition",
  performing_arts: "performance",
  theatre_arts: "performance",
  film_and_media: "screening",
  tours: "tour",
  charity_and_causes: "other",
  community: "other",
  music: "performance",
  other: "other",
}

/** Venue names that suggest library venues — used as a pre-filter for group credentials. */
const LIBRARY_KEYWORDS = [
  "library",
  "libraries",
  "biblioth",
  "biblioteca",
  "médiathèque",
  "archive",
  "reading room",
]

function isLikelyLibraryVenue(venueName: string): boolean {
  const lower = venueName.toLowerCase()

  return LIBRARY_KEYWORDS.some((kw) => lower.includes(kw))
}

async function fetchPage(
  orgId: string,
  token: string,
  page: number
): Promise<any> {
  const url = `${BASE}/organizations/${orgId}/events/?status=live&page=${page}&expand=venue,category`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Eventbrite API ${res.status}`)

  return res.json()
}

export const eventbriteProvider: EventProvider = {
  name: "eventbrite",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const { organizationId, accessToken } = credentials
    const res = await fetch(`${BASE}/organizations/${organizationId}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) return { ok: true }

    return { ok: false, error: `Eventbrite returned ${res.status}` }
  },

  async fetch(
    credentials: ProviderCredentials,
    hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const { organizationId, accessToken } = credentials
    const events: RawEvent[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const data = await fetchPage(organizationId!, accessToken!, page)
      const raw = (data.events as any[]) ?? []

      for (const ev of raw) {
        const venueName: string = ev.venue?.name ?? ""
        // For group credentials, pre-filter: skip if venue doesn't look like a library
        if (hints.length > 1 && !isLikelyLibraryVenue(venueName)) continue

        events.push({
          externalId: ev.id as string,
          title: (ev.name?.text ?? "") as string,
          description: (ev.description?.text ?? "") as string,
          url: ev.url as string,
          imageUrl: ev.logo?.url ?? undefined,
          startTime: ev.start?.utc as string,
          endTime: ev.end?.utc as string | undefined,
          allDay: false,
          timezone: (ev.start?.timezone ?? "UTC") as string,
          providerCategory: ev.subcategory_id ?? ev.category_id ?? undefined,
          tags: [],
          isFree: ev.is_free === true,
          venueName,
          venueAddress:
            ev.venue?.address?.localized_address_display ?? undefined,
        })
      }

      hasMore = data.pagination?.has_more_items === true
      page++
      if (page > 50) break // safety ceiling
    }

    return events
  },
}
