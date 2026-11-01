import {
  DRIVE_PLACE_LEVELS,
  moderationArticleRefusalMessage as articleDecisionErrorMessage,
  EVENT_PROVIDERS,
  moderationHumanise as humanise,
  moderationIsHttpUrl as isHttpUrl,
  moderationRenderValue as renderValue,
  moderationSummaryOf,
  moderationRoleApplicationSummary,
  moderationDetailOf,
  moderationFieldChangeCount,
  moderationDriveProposalTitle as driveTitle,
  moderationFormatDateTime as formatDateTime,
  MODERATION_TYPE_LABELS as TYPE_LABELS,
  MODERATION_EVIDENCE_TYPE_LABELS as EVIDENCE_TYPE_LABELS,
  MODERATION_FIELD_GROUPS as FIELD_GROUPS,
  MODERATION_EXCLUDE_FROM_OTHER as EXCLUDE_FROM_OTHER,
  gapDefinition,
  isGapKey,
  proposedDrive,
} from "@repo/shared-data"

/** Shared shapes and labels for the moderation queue. */

export interface UploadedImage {
  strapiId: number
  url: string
  isHero: boolean
}

export interface SocialLink {
  platform: string
  url: string
  label?: string
}

export type Submission = {
  staffReviewHint?: string
  /** A claim an unverified Team's organiser filed by assigning a member. */
  teamReview?: { name: string; staffRole: "owner" | "editor" }
  documentId: string
  submissionType: string
  status: string
  targetEntityType?: string
  targetSlug?: string
  targetDocumentId?: string
  fields?: Record<string, unknown>
  draftData?: Record<string, unknown> | null
  note?: string
  reviewNote?: string
  submittedByEmail: string
  submittedByName?: string
  submittedByUserId: string
  reviewedAt?: string
  createdAt: string
  editSummary?: string
  evidenceType?: string
  evidenceUrl?: string
  /** Record corrections in review: the library's live values and option names. */
  review?: {
    current: Record<string, unknown>
    names: Record<string, string>
  }
}

export type ModerationStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"

export const STATUS_TABS: { id: ModerationStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "needs_info", label: "Needs info" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
]

export const STATUS_META: Record<
  string,
  {
    label: string
    variant: "warning" | "secondary" | "success" | "danger" | "alternative"
  }
> = {
  pending: { label: "Pending", variant: "warning" },
  needs_info: { label: "Needs info", variant: "secondary" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  draft: { label: "Draft", variant: "alternative" },
}

/** Design System colour tokens per type: badge background and text. */
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  correction: { bg: "primary100", text: "primary600" },
  new_library: { bg: "success100", text: "success600" },
  library_edit: { bg: "primary100", text: "primary600" },
  network_claim: { bg: "warning100", text: "warning600" },
  library_claim: { bg: "warning100", text: "warning600" },
  wiki_edit: { bg: "secondary100", text: "secondary600" },
  blog_submission: { bg: "alternative100", text: "alternative600" },
  topic_suggestion: { bg: "neutral150", text: "neutral600" },
  role_application: { bg: "danger100", text: "danger600" },
  event_feed: { bg: "warning100", text: "warning600" },
  drive_proposal: { bg: "success100", text: "success600" },
}

/** Keep upload/CDN URLs intact, including signatures; local uploads stay relative. */
export function assetPath(url: unknown): string | null {
  if (typeof url !== "string") return null
  const raw = url.trim()
  // Reject browser URL normalisation tricks before using the address in a link.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001F\u007F]/.test(raw)) return null
  if (isHttpUrl(raw)) {
    const parsed = new URL(raw)

    return parsed.username || parsed.password ? null : raw
  }

  return /^\/(?!\/)/.test(raw) ? raw : null
}

export {
  articleDecisionErrorMessage,
  humanise,
  isHttpUrl,
  renderValue,
  formatDateTime,
  TYPE_LABELS,
  EVIDENCE_TYPE_LABELS,
  FIELD_GROUPS,
  EXCLUDE_FROM_OTHER,
}

/** The privileged admin includes the snapshotted library name in feed summaries. */
export function summaryOf(sub: Submission): string {
  const fields = sub.fields ?? {}
  if (sub.submissionType === "event_feed") {
    const library =
      typeof fields.libraryName === "string" && fields.libraryName.trim()
        ? fields.libraryName.trim()
        : (sub.targetSlug ?? "a library")

    return `${EVENT_PROVIDERS[fields.provider as keyof typeof EVENT_PROVIDERS]?.label ?? "Event"} feed for ${library}${fields.kind === "replace" ? " (new details)" : ""}`
  }
  if (sub.submissionType === "role_application")
    return moderationRoleApplicationSummary(fields, { trimLocales: true })

  return moderationSummaryOf(sub)
}

const shortDate = (v: unknown): string | null => {
  if (typeof v !== "string") return null
  const t = Date.parse(v)

  return Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null
}

/** "a, b and c". */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

// The UI's `focusSummary` (`apps/ui/src/components/drives/focus-meta.ts`),
// copied because the admin can't import UI code: its section labels and its
// fixed month table (ICU month names vary by build).
const VERIFY_SECTION_LABELS: Record<string, string> = {
  hours: "Opening hours",
  status: "Open or closed",
  address: "Address",
  contact: "Contact details",
}
const FOCUS_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/** "6 Oct 2025" in UTC; "" when it isn't a date. */
function focusDate(v: unknown): string {
  const t = typeof v === "string" ? Date.parse(v) : Number.NaN
  if (!Number.isFinite(t)) return ""
  const d = new Date(t)

  return `${d.getUTCDate()} ${FOCUS_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * A Drive's Focus in one line: "Opening hours and Contact details", "Confirm
 * opening hours and open or closed not checked since 6 Oct 2025" or
 * "Complete records to 75%". Null when it can't be read.
 */
function focusSummary(focus: Record<string, unknown> | null): string | null {
  if (!focus) return null
  if (focus.kind === "gaps" && Array.isArray(focus.gaps)) {
    const labels = focus.gaps.map((g) =>
      isGapKey(g) ? gapDefinition(g).label : String(g)
    )

    return labels.length > 0 ? joinAnd(labels) : null
  }
  if (focus.kind === "verify" && Array.isArray(focus.sections)) {
    const sections = joinAnd(
      focus.sections.map((s) =>
        (Object.hasOwn(VERIFY_SECTION_LABELS, String(s))
          ? VERIFY_SECTION_LABELS[String(s)]!
          : String(s)
        ).toLowerCase()
      )
    )
    if (!sections) return null
    const since = focusDate(focus.before)

    return since
      ? `Confirm ${sections} not checked since ${since}`
      : `Confirm ${sections}`
  }
  if (focus.kind === "record" && typeof focus.target === "number") {
    return `Complete records to ${focus.target}%`
  }

  return null
}

/** A Drive Proposal's definition in one line, with a Moderator's dates. */
function driveProposalDetail(draftData: unknown): string | null {
  const drive = proposedDrive(draftData, { withModeratorEdit: true })
  if (!drive) return null
  const parts: string[] = []
  const title = driveTitle(draftData)
  if (title) parts.push(`Title: ${title}`)

  const focus = focusSummary(
    drive.focus as unknown as Record<string, unknown> | null
  )
  if (focus) parts.push(`Focus: ${focus}`)

  const scope = drive.scope as unknown as Record<string, unknown> | null
  const places =
    scope?.places && typeof scope.places === "object"
      ? (scope.places as Record<string, unknown>)
      : {}
  const placeText = DRIVE_PLACE_LEVELS.flatMap((level) => {
    const slugs = places[level]

    return Array.isArray(slugs) && slugs.length > 0
      ? [`${level}: ${slugs.join(", ")}`]
      : []
  }).join("; ")
  if (placeText) parts.push(`Places: ${placeText}`)
  if (Array.isArray(scope?.libraries) && scope.libraries.length > 0)
    parts.push(`Library list: ${scope.libraries.length}`)

  const starts = shortDate(drive.startsAt)
  if (starts) parts.push(`Starts: ${starts}`)
  const ends = shortDate(drive.endsAt)
  if (ends) parts.push(`Ends: ${ends}`)
  if (typeof drive.goalPercent === "number")
    parts.push(`Goal: ${drive.goalPercent}%`)

  return parts.length > 0 ? parts.join(" · ") : null
}

/** Admin-only detail preserves library names and full drive definitions. */
export function detailOf(sub: Submission): string | null {
  const fields = sub.fields ?? {}
  if (sub.submissionType === "event_feed") {
    const library =
      (typeof fields.libraryName === "string" && fields.libraryName.trim()) ||
      sub.targetSlug ||
      "Library"

    return `${library} · ${fields.kind === "replace" ? "new details" : "new connection"}`
  }
  if (sub.submissionType === "drive_proposal")
    return driveProposalDetail(sub.draftData)
  if (sub.submissionType === "correction") {
    if (fields.kind === "record") return moderationFieldChangeCount(fields)
    if (fields.kind === "facilities") return "Facility answers"
    if (fields.kind === "photo") return "Photo"
    if (fields.kind === "source") return "Source"
    if (fields.kind === "verify") return "Still right?"

    return typeof fields.category === "string" ? fields.category : null
  }

  return moderationDetailOf(sub)
}

export function relativeTime(iso: string | undefined): string {
  if (!iso) return "—"
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} d ago`

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
}
