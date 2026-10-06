import { T } from "@/lib/design-tokens"

// One vocabulary for a person's submissions, shared by the public
// Contributions tab on their profile and their own My submissions page.

export type ContributionStatus =
  | "draft"
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"

/** The fields a contribution row reads; both lists carry at least these. */
export type ContributionItem = {
  documentId: string
  submissionType: string
  status: ContributionStatus | string
  targetSlug?: string | null
  /** The library's name or article's title (Strapi resolves it). */
  targetLabel?: string | null
  editSummary?: string | null
  createdAt: string
  /** The Drive this change is tagged to, when it's part of one. */
  drive?: { documentId: string; slug: string; title: string } | null
}

/** What kind of change: a tinted icon and a noun that fits every status. */
export const KIND_META: Record<
  string,
  { tint: string; icon: string; label: string }
> = {
  new_library: {
    tint: "public",
    icon: "mdi:book-plus-outline",
    label: "New library",
  },
  library_edit: {
    tint: "academic",
    icon: "mdi:pencil-outline",
    label: "Record edit",
  },
  correction: {
    tint: "special",
    icon: "mdi:flag-outline",
    label: "Correction",
  },
  wiki_edit: {
    tint: "national",
    icon: "mdi:book-edit-outline",
    label: "Knowledge article",
  },
  blog_submission: {
    tint: "neutral",
    icon: "mdi:newspaper-variant-outline",
    label: "Journal article",
  },
  library_claim: {
    tint: "national",
    icon: "mdi:shield-check-outline",
    label: "Library claim",
  },
  topic_suggestion: {
    tint: "neutral",
    icon: "mdi:tag-outline",
    label: "Topic suggestion",
  },
  role_application: {
    tint: "national",
    icon: "mdi:account-star-outline",
    label: "Role application",
  },
  event_feed: {
    tint: "national",
    icon: "mdi:calendar-sync-outline",
    label: "Event feed",
  },
  drive_proposal: {
    tint: "national",
    icon: "mdi:pin-outline",
    label: "Drive proposal",
  },
  default: {
    tint: "neutral",
    icon: "mdi:message-text-outline",
    label: "Contribution",
  },
}

/** Where a submission stands: always icon + label + colour. */
export const STATUS_META: Record<
  ContributionStatus,
  { label: string; color: string; icon: string }
> = {
  draft: {
    label: "Draft",
    color: T.ink.dim,
    icon: "mdi:file-document-edit-outline",
  },
  pending: {
    label: "In review",
    color: "var(--tint-academic-fg)",
    icon: "mdi:clock-outline",
  },
  needs_info: {
    label: "Changes requested",
    color: "#6B5420",
    icon: "mdi:alert-circle-outline",
  },
  approved: {
    label: "Accepted",
    color: "var(--tint-public-fg)",
    icon: "mdi:check-circle-outline",
  },
  rejected: {
    label: "Not accepted",
    color: T.accent.danger,
    icon: "mdi:close-circle-outline",
  },
}

export const statusMeta = (status: string) =>
  STATUS_META[status as ContributionStatus] ?? STATUS_META.pending

export const kindMeta = (type: string) => KIND_META[type] ?? KIND_META.default!

/** The row's title: the target's name, else its slug, else the kind. */
export function titleOf(item: ContributionItem): string {
  return (
    item.targetLabel?.trim() ||
    item.targetSlug ||
    kindMeta(item.submissionType).label
  )
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  const d = Math.floor(diff / 86_400_000)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`

  return `${Math.floor(d / 30)} months ago`
}

/** Newest first in, day groups out, labelled "29 September 2026". */
export function groupByDay<I extends ContributionItem>(
  items: readonly I[]
): { label: string; items: I[] }[] {
  const groups = new Map<string, I[]>()
  for (const item of items) {
    const key = new Date(item.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return [...groups.entries()].map(([label, grouped]) => ({
    label,
    items: grouped,
  }))
}
