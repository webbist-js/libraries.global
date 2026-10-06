import type { EventProviderKey, FeedTestCode } from "@repo/shared-data"

export type FeedView = {
  documentId: string
  provider: EventProviderKey
  label: string
  scope: "library" | "group"
  status: "draft" | "pending" | "active" | "paused"
  pausedReason: "library" | "admin" | "sync_failures" | null
  managedBy: "library" | "admin_group"
  hints: Record<string, string>
  pendingHints: Record<string, string> | null
  review: {
    submissionDocumentId: string
    kind: "connect" | "replace"
    status: string
    note: string | null
  } | null
  lastTestedAt: string | null
  lastTestResult: FeedTestCode | null
  lastSyncAt: string | null
  lastSyncStatus: "ok" | "partial" | "error" | null
  lastErrorCode: FeedTestCode | null
  upcomingEvents: number
}

export type LibraryFeeds = {
  library: { documentId: string; name: string; slug: string | null }
  feeds: FeedView[]
}
