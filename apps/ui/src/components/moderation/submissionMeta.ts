/**
 * Shapes, labels and pure helpers for the site's Moderation Queue
 * (`/contribute/moderation`). Matching summary/text/value rules live in
 * shared-data; this adapter retains community shapes, redaction, badges,
 * scope copy and decision errors.
 */

import {
  type DriveInput,
  MODERATION_ARTICLE_REFUSAL_COPY,
  moderationHumanise as humanise,
  moderationIsHttpUrl as isHttpUrl,
  moderationRenderValue as renderValue,
  moderationSummaryOf as summaryOf,
  moderationDriveProposalTitle as driveProposalTitle,
  moderationRoleApplicationSummary as roleApplicationSummary,
  moderationDetailOf as detailOf,
  moderationExtractText as extractText,
  moderationFormatDate as formatDate,
  moderationFormatDateTime as formatDateTime,
  MODERATION_TYPE_LABELS as TYPE_LABELS,
  MODERATION_EVIDENCE_TYPE_LABELS as EVIDENCE_TYPE_LABELS,
  MODERATION_FIELD_GROUPS as FIELD_GROUPS,
  MODERATION_EXCLUDE_FROM_OTHER as EXCLUDE_FROM_OTHER,
} from "@repo/shared-data"

import type { BadgeColor } from "@/components/ds"

// ── API shapes (Strapi `/api/content-moderation/moderation/*`) ───────────────

export type ModerationQueueName =
  | "index"
  | "knowledge"
  | "journal"
  | "applications"

/** A Submission's Drive tag: `api::drive.drive`'s id, slug and title. */
export type DriveTag = { documentId: string; slug: string; title: string }

export type ModerationRow = {
  staffReviewHint?: string
  documentId: string
  submissionType: string
  queue: ModerationQueueName
  status: string
  locale: string
  summary: string
  targetSlug: string | null
  submittedByName: string | null
  createdAt: string
  reviewedAt: string | null
  drive: DriveTag | null
}

export type ArticleVersion = {
  title: unknown
  summary: unknown
  body: unknown
}

/** Live values of a record correction's fields, and option names by id. */
export type RecordReview = {
  current: Record<string, unknown>
  names: Record<string, string>
}

export type ModerationDetail = ModerationRow & {
  targetDocumentId: string | null
  targetEntityType: string | null
  resultDocumentId: string | null
  fields: Record<string, unknown> | null
  draftData: Record<string, unknown> | null
  note: string | null
  editSummary: string | null
  evidenceType: string | null
  evidenceUrl: string | null
  reviewNote: string | null
  review: unknown | null
  article: {
    current: ArticleVersion | null
    source: (ArticleVersion & { locale: string }) | null
  } | null
  canPublish: boolean
  /** role_application and drive_proposal only: who applied or proposed. */
  applicant?: RoleApplicant | null
  /** drive_proposal only; null for every other type. */
  proposal?: DriveProposalReview | null
}

/** The applicant block on a Role Application's detail (newest first, ≤ 10). */
export type RoleApplicant = {
  username: string | null
  acceptedCount: number
  recentAccepted: { summary: string; type: string; decidedAt: string }[]
}

/**
 * A Drive Proposal's review: the drive approval would create (with any
 * Moderator date change), how big it is counted now, its problems as it
 * stands, and, once approved, the drive it created. Mirrors Strapi's
 * `DriveProposalReview` (content-moderation `services/moderation.ts`).
 */
export type DriveProposalReview = {
  discussions?: {
    enabled: boolean
    threadIds: string[]
    featuredThreadId?: string
  }
  /** The drive as approval would create it: the proposer's definition with the Moderator's dates. */
  drive: DriveInput
  /** True when the Moderator's dates have replaced the proposer's. */
  datesEdited: boolean
  /** In scope and to do, counted as if it opened now; null when Meilisearch can't answer. */
  counts: { total: number; todo: number } | null
  /** validateDrive(drive, now): empty when it would be created as it stands. */
  errors: string[]
  /** After approval: the drive it created, for the "Scheduled as …" link. */
  created: { slug: string; title: string; status: string } | null
}

export type ReviewEvent = {
  documentId: string
  fromStatus: string | null
  toStatus: string | null
  reviewerKind: string | null
  byViewer: boolean
  note: string | null
  createdAt: string
}

export type ModerationListResponse = {
  data: ModerationRow[]
  meta: { page: number; pageSize: number; total: number }
}

export type ModerationStat = {
  queue: ModerationQueueName
  status: "pending" | "needs_info" | "decided"
  count: number
}

export type OptionSuggestion = {
  publicationStatus?: "pending" | "published" | "rejected"
  version?: number
  comparison?: { documentId: string; name: string; explanation: string } | null

  documentId: string
  name: string
  optionKey: "accessibility" | "amenities" | "services" | "library_types"
  status: "open" | "reviewing" | "planned" | "accepted" | "declined"
  requests: number
  votes: number
  libraries: { documentId: string; name: string }[]
  /** Accepted suggestions only: libraries the board still needs to link by hand. */
  unlinkedLibraries: {
    documentId: string
    name: string
    reason: "not_published" | "not_found"
  }[]
  description: string | null
  suggestedByName: string | null
  createdAt?: string
  decidedAt: string | null
  decidedBy: string | null
  decisionNote: string | null
}

export type ScopeLike = { queue: string; locale: string | null }

// ── Labels ────────────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, BadgeColor> = {
  correction: "aurora",
  new_library: "ok",
  library_edit: "aurora",
  library_claim: "gold",
  network_claim: "gold",
  wiki_edit: "violet",
  blog_submission: "ember",
  topic_suggestion: "dim",
  role_application: "violet",
  event_feed: "gold",
  drive_proposal: "ok",
}

/** The Type column's label for a queue row (or any submission). */
export function moderationRowLabel(row: { submissionType: string }): string {
  return Object.hasOwn(TYPE_LABELS, row.submissionType)
    ? TYPE_LABELS[row.submissionType]!
    : humanise(row.submissionType.replaceAll("_", " "))
}

/** Status as colour, icon and text together (never colour alone). */
export const STATUS_META: Record<
  string,
  { label: string; color: BadgeColor; icon: string }
> = {
  pending: { label: "Pending", color: "warn", icon: "mdi:clock-outline" },
  needs_info: {
    label: "Needs changes",
    color: "aurora",
    icon: "mdi:message-alert-outline",
  },
  approved: {
    label: "Approved",
    color: "ok",
    icon: "mdi:check-circle-outline",
  },
  rejected: {
    label: "Rejected",
    color: "danger",
    icon: "mdi:close-circle-outline",
  },
}

export const statusMeta = (status: string) =>
  Object.hasOwn(STATUS_META, status)
    ? STATUS_META[status]!
    : {
        label: humanise(status.replaceAll("_", " ")),
        color: "dim" as BadgeColor,
        icon: "mdi:help-circle-outline",
      }

/** The queue segments: Strapi's `decided` is approved or rejected. */
export const SEGMENTS = [
  { id: "pending", label: "Pending" },
  { id: "needs_info", label: "Needs changes" },
  { id: "decided", label: "Decided" },
] as const

export type Segment = (typeof SEGMENTS)[number]["id"]

export const QUEUE_LABELS: Record<ModerationQueueName, string> = {
  index: "Index",
  knowledge: "Knowledge",
  journal: "Journal",
  applications: "Role applications",
}

/** A queue as a phrase in a sentence: "the Index", "Knowledge". */
const QUEUE_PHRASES: Record<string, string> = {
  index: "the Index",
  knowledge: "Knowledge",
  journal: "the Journal",
  applications: "role applications",
}

const languageOf = (code: string, names: Record<string, string>) =>
  names[code] ?? code.toUpperCase()

/**
 * The caller's Moderation Scopes as a phrase for the queue's lead, e.g.
 * "Knowledge in French, and the Index".
 */
export function describeScopes(
  scopes: readonly ScopeLike[],
  localeNames: Record<string, string>
): string {
  if (scopes.some((s) => s.queue === "all" && s.locale === null))
    return "every queue"
  const parts = scopes.map((s) => {
    const queue =
      s.queue === "all" ? "every queue" : (QUEUE_PHRASES[s.queue] ?? s.queue)

    return s.locale ? `${queue} in ${languageOf(s.locale, localeNames)}` : queue
  })
  const unique = [...new Set(parts)]
  if (unique.length <= 1) return unique[0] ?? "no queue"

  return `${unique.slice(0, -1).join(", ")}, and ${unique.at(-1)}`
}

export {
  humanise,
  isHttpUrl,
  renderValue,
  summaryOf,
  driveProposalTitle,
  roleApplicationSummary,
  detailOf,
  extractText,
  formatDate,
  formatDateTime,
  TYPE_LABELS,
  EVIDENCE_TYPE_LABELS,
  FIELD_GROUPS,
  EXCLUDE_FROM_OTHER,
}

// ── Decision errors (spec §5.2) ──────────────────────────────────────────────

const CONFLICT_COPY =
  "This submission was already decided or changed meanwhile. Reload the page to see where it stands."
const TAMPERED_COPY =
  "This submission changed after it was submitted for review, so it can't be approved as it is. Ask an admin to look at it."

const ERROR_COPY: Record<string, string> = {
  self_review: "You can't review your own submission.",
  conflict: CONFLICT_COPY,
  invalid_transition: CONFLICT_COPY,
  tampered: TAMPERED_COPY,
  apply_failed:
    "Approval could not be applied; the submission is back in review.",
  apply_failed_unreverted:
    "Approval could not be applied, and the submission could not be returned to review. An admin needs to fix it.",
}

const REFUSAL_COPY: Record<string, string> = {
  ...MODERATION_ARTICLE_REFUSAL_COPY,
  no_hierarchy:
    "This library needs a continent, country and region before it can be published. Set its location, then approve again.",
  not_published:
    "This record has no published version; an admin must publish it first.",
  claim_lost:
    "The submitter no longer holds a claim on this library. Reject it instead.",
  feed_mismatch:
    "This feed is no longer waiting on this submission. Reject it instead.",
}

/** What to tell the Moderator when Strapi refused a decision. */
export function decisionErrorMessage(status: number, body: unknown): string {
  const raw =
    body && typeof body === "object"
      ? (body as { error?: unknown }).error
      : undefined
  const err = (raw && typeof raw === "object" ? raw : {}) as {
    name?: unknown
    reason?: unknown
    message?: unknown
  }
  const name = typeof err.name === "string" ? err.name : ""
  if (name === "apply_refused")
    return (
      (Object.hasOwn(REFUSAL_COPY, String(err.reason))
        ? REFUSAL_COPY[String(err.reason)]
        : undefined) ?? "This change can't be applied to the record yet."
    )
  const known = Object.hasOwn(ERROR_COPY, name) ? ERROR_COPY[name] : undefined
  if (known) return known
  switch (status) {
    case 400:
      return typeof err.message === "string"
        ? err.message
        : "Check the decision and try again."
    case 401:
      return "Your session has ended. Sign in again to continue."
    case 403:
      return "You can't review this submission: it's your own or outside your queues."
    case 404:
      return "This submission is no longer in your queue."
    case 409:
      return CONFLICT_COPY
    case 422:
      return TAMPERED_COPY
    case 429:
      return "Too many requests. Wait a minute, then try again."

    default:
      return status >= 500
        ? "Something went wrong on our side. Try again in a moment."
        : "Something went wrong. Try again."
  }
}
