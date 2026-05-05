import { toUtcIso, truncateSummary, computeSyncHash } from "../lib/date"
import type { RawEvent, NormalizedEvent, EventType } from "../providers/types"

export function normalizeEvent(
  raw: RawEvent,
  provider: string,
  credentialId: number,
  libraryId: number,
  libraryEntityRef: string,
  eventTypeMap: Record<string, EventType>,
  pendingReview: boolean
): NormalizedEvent {
  const startTime = toUtcIso(raw.startTime)
  const endTime = raw.endTime ? toUtcIso(raw.endTime) : null
  const syncHash = computeSyncHash(
    raw.externalId,
    provider,
    startTime,
    raw.title
  )
  const eventType: EventType = raw.providerCategory
    ? (eventTypeMap[raw.providerCategory] ?? "other")
    : "other"
  const now = new Date().toISOString()

  return {
    externalId: raw.externalId,
    sourceProvider: provider,
    credentialId,
    syncHash,
    libraryId,
    libraryEntityRef,
    title: raw.title,
    description: raw.description,
    summary: truncateSummary(raw.description),
    url: raw.registrationUrl ?? raw.url,
    imageUrl: raw.imageUrl ?? null,
    startTime,
    endTime,
    allDay: raw.allDay,
    timezone: raw.timezone,
    eventType,
    audience: [],
    tags: raw.tags,
    isFree: raw.isFree,
    priceMin: raw.priceMin ?? null,
    priceMax: raw.priceMax ?? null,
    capacity: raw.capacity ?? null,
    status: "upcoming",
    pendingReview,
    importedAt: now,
    lastSeenAt: now,
  }
}
