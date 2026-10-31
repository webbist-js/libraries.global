import type { FeedView } from "@/components/event-feeds/types"
import type { EventDetailPage } from "@/components/events/EventDetailPage"
import type { EventSearchHit } from "@/lib/meilisearch"
import type { ComponentProps } from "react"

export const eventFixture = {
  id: 1,
  documentId: "example-storytime",
  title: "Stories in the reading room",
  summary:
    "Stories, songs and a friendly introduction to the library for families.",
  description:
    "Join the library team for stories and songs. Everyone is welcome; no booking is needed.",
  url: "https://example.invalid/events/storytime",
  imageUrl: "/library-placeholder.svg",
  startTime: "2026-11-14T10:00:00Z",
  endTime: "2026-11-14T11:00:00Z",
  allDay: false,
  timezone: "Europe/London",
  eventType: "storytime",
  isFree: true,
  status: "upcoming",
  library_name: "Northbridge Community Library",
  library_slug: "northbridge-library",
  library_city: "Northbridge",
  tags: ["Families", "Reading"],
} satisfies EventSearchHit & ComponentProps<typeof EventDetailPage>["event"]
export const eventFixtures: EventSearchHit[] = [
  eventFixture,
  {
    ...eventFixture,
    id: 2,
    documentId: "example-local-history",
    title: "Local history workshop",
    eventType: "workshop",
    startTime: "2026-11-14T14:00:00Z",
    endTime: "2026-11-14T16:00:00Z",
    isFree: false,
    priceMin: 5,
    priceMax: 5,
  },
]
export const feedFixture: FeedView = {
  documentId: "example-feed",
  provider: "ical",
  label: "Northbridge library calendar",
  scope: "library",
  status: "active",
  pausedReason: null,
  managedBy: "library",
  hints: { url: "https://example.invalid/calendar.ics" },
  pendingHints: null,
  review: null,
  lastTestedAt: "2026-01-15T12:00:00Z",
  lastTestResult: "ok",
  lastSyncAt: "2026-01-15T12:00:00Z",
  lastSyncStatus: "ok",
  lastErrorCode: null,
  upcomingEvents: 12,
}
export const eventResponses = {
  "GET /api/public-proxy/api/events/global": {
    body: eventFixtures,
  },
  "GET /api/public-proxy/api/events/event/example-storytime": {
    body: eventFixture,
  },
  "GET /api/saved-events": { body: [] },
  "POST /api/saved-events": { body: { documentId: "example-saved-event" } },
  "DELETE /api/saved-events/example-saved-event": { body: { ok: true } },
}
