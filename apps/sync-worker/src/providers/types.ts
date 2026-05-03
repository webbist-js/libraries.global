export type ProviderKey =
  | "eventbrite"
  | "ical"
  | "ticketsource"
  | "meetup"
  | "wegottickets"
  | "spydus"
  | "bibliocommons"

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
  registrationUrl?: string
  capacity?: number
  /** For group-scope credentials: venue name to match against library names */
  venueName?: string
  venueAddress?: string
}

export interface NormalizedEvent {
  externalId: string
  sourceProvider: string
  credentialId: number
  syncHash: string
  libraryId: number
  libraryEntityRef: string
  title: string
  description: string
  summary: string
  url: string
  imageUrl: string | null
  startTime: string
  endTime: string | null
  allDay: boolean
  timezone: string
  eventType: EventType
  audience: string[]
  tags: string[]
  isFree: boolean
  priceMin: number | null
  priceMax: number | null
  registrationUrl: string | null
  capacity: number | null
  status: "upcoming" | "ongoing" | "cancelled" | "postponed"
  pendingReview: boolean
  importedAt: string
  lastSeenAt: string
}

export interface EventProvider {
  readonly name: ProviderKey
  readonly eventTypeMap: Record<string, EventType>
  test: (
    credentials: ProviderCredentials
  ) => Promise<{ ok: boolean; error?: string }>
  fetch: (
    credentials: ProviderCredentials,
    hints: LibraryHint[]
  ) => Promise<RawEvent[]>
}

export interface LoadedCredential {
  id: number
  documentId: string
  provider: ProviderKey
  label: string
  scope: "library" | "group"
  isActive: boolean
  credentials: ProviderCredentials
  libraries: LibraryHint[]
}
