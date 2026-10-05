import type { EventProviderKey } from "@repo/shared-data"

export type EventType =
  | "talk"
  | "exhibition"
  | "storytime"
  | "book_club"
  | "workshop"
  | "tour"
  | "screening"
  | "reading_group"
  | "performance"
  | "drop_in"
  | "other"

export type ProviderCredentials = Record<string, string>

export interface LibraryHint {
  id: number
  documentId: string
  entityRef: string
  name: string
  address?: string
}

export interface RawEvent {
  externalId: string
  title: string
  description: string
  url: string
  imageUrl?: string
  /** ISO 8601 string — may include tz offset or may be local */
  startTime: string
  endTime?: string
  allDay: boolean
  timezone: string
  /** Provider's own category string — fed into eventTypeMap */
  providerCategory?: string
  tags: string[]
  isFree: boolean
  priceMin?: number
  priceMax?: number
  /** Booking/ticket URL — if present, used as the canonical action URL instead of url */
  registrationUrl?: string
  capacity?: number
  /** For group-scope credentials: venue name to match against library names */
  venueName?: string
  venueAddress?: string
}

export interface EventProvider {
  readonly name: EventProviderKey
  readonly eventTypeMap: Record<string, EventType>
  /** Resolves when the values work; throws (see errors.ts) when they don't. */
  test: (credentials: ProviderCredentials) => Promise<void>
  fetch: (
    credentials: ProviderCredentials,
    hints: LibraryHint[]
  ) => Promise<RawEvent[]>
}
