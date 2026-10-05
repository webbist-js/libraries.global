import type {
  EventType,
  LibraryHint,
  ProviderCredentials,
} from "@repo/event-providers"
import type { EventProviderKey } from "@repo/shared-data"

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
  capacity: number | null
  status: "upcoming" | "ongoing" | "cancelled" | "postponed"
  pendingReview: boolean
  importedAt: string
  lastSeenAt: string
}

export interface LoadedCredential {
  id: number
  documentId: string
  provider: EventProviderKey
  label: string
  scope: "library" | "group"
  isActive: boolean
  credentials: ProviderCredentials
  libraries: LibraryHint[]
}
