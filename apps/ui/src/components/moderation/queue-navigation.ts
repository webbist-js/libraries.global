import type { QueueFilters } from "@/components/moderation/ModerationFilters"

const BASE = "/contribute/moderation"

/** Queue return links stay on this workspace; never accept an external URL. */
export function reviewReturnHref(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1500) return undefined
  if (value === BASE || value.startsWith(BASE + "?")) return value

  return undefined
}

export function reviewHref(documentId: string, returnTo?: string): string {
  const path = `${BASE}/${encodeURIComponent(documentId)}`
  const safe = reviewReturnHref(returnTo)

  return safe ? `${path}?returnTo=${encodeURIComponent(safe)}` : path
}

export type QueueState = QueueFilters & { page: number }

/** The queue's URL for a set of filters (the URL holds the state). */
export function queueHref(s: QueueState): string {
  const p = new URLSearchParams()
  if (s.category) p.set("category", s.category)
  if (s.segment !== "pending") p.set("status", s.segment)
  if (s.queue) p.set("queue", s.queue)
  if (s.locale) p.set("locale", s.locale)
  if (s.q) p.set("q", s.q)
  if (s.drive) p.set("drive", s.drive)
  if (s.page > 1) p.set("page", String(s.page))
  const qs = p.toString()

  return qs ? `${BASE}?${qs}` : BASE
}
