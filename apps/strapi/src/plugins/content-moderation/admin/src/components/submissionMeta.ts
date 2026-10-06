import { EVENT_PROVIDERS } from "@repo/shared-data"

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

export const TYPE_LABELS: Record<string, string> = {
  correction: "Correction",
  new_library: "New library",
  library_edit: "Library edit",
  library_claim: "Library claim",
  wiki_edit: "Knowledge",
  blog_submission: "Journal",
  topic_suggestion: "Topic",
  role_application: "Role application",
  event_feed: "Event feed",
}

/** Design System colour tokens per type: badge background and text. */
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  correction: { bg: "primary100", text: "primary600" },
  new_library: { bg: "success100", text: "success600" },
  library_edit: { bg: "primary100", text: "primary600" },
  library_claim: { bg: "warning100", text: "warning600" },
  wiki_edit: { bg: "secondary100", text: "secondary600" },
  blog_submission: { bg: "alternative100", text: "alternative600" },
  topic_suggestion: { bg: "neutral150", text: "neutral600" },
  role_application: { bg: "danger100", text: "danger600" },
  event_feed: { bg: "warning100", text: "warning600" },
}

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  institutional_url: "Institutional URL",
  on_site_photo: "On-site photo",
  on_site_visit: "Checked in person",
  press_release: "Press release",
  personal_communication: "Personal communication",
  my_institutional_affiliation: "Institutional affiliation",
  other: "Other",
}

export const FIELD_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Identity",
    keys: [
      "name",
      "shortName",
      "officialName",
      "libraryType",
      "operatorType",
      "operationalStatus",
      "closureReason",
      "summary",
    ],
  },
  {
    label: "Location",
    keys: [
      "streetAddress",
      "district",
      "city",
      "postalCode",
      "country",
      "lat",
      "lng",
    ],
  },
  {
    label: "Contact & web",
    keys: [
      "website",
      "email",
      "phone",
      "catalogueUrl",
      "planVisitUrl",
      "bookingUrl",
      "membershipUrl",
      "virtualTourUrl",
      "virtualTourEmbed",
      "donationUrl",
      "iiifEndpoint",
    ],
  },
  {
    label: "Visit",
    keys: [
      "admissionInfo",
      "transitInfo",
      "languagesServed",
      "accessibilityNotes",
      "visitNotes",
    ],
  },
  {
    label: "Collections",
    keys: [
      "collectionSize",
      "collectionTypes",
      "specialCollections",
      "classificationSystem",
    ],
  },
  {
    label: "Building & history",
    keys: [
      "foundedYear",
      "openedYear",
      "closedYear",
      "architect",
      "architecturalStyle",
      "buildingInfo",
    ],
  },
  { label: "Media", keys: ["imageUrl", "imageNote", "imageCredit"] },
]

export const EXCLUDE_FROM_OTHER = new Set([
  "kind",
  "previous",
  "continentDocumentId",
  "countryDocumentId",
  "regionDocumentId",
  "areaDocumentId",
  "uploadedImages",
  "socialLinks",
  "services",
  "amenities",
  "accessibility",
  "openingTimes",
  "source",
  "sourceUrl",
  // A shared photo is shown as an image, not as its id and address.
  "photoId",
  "photoUrl",
])

/** camelCase → words. */
export const humanise = (key: string) =>
  key
    .replace(/DocumentId$/, "")
    .replaceAll(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())

/**
 * Whether contributor-supplied text may be rendered as a link: http(s)
 * only. Anything else (javascript:, data:, a bare path) is shown as text,
 * since React doesn't block dangerous schemes in `href`.
 */
export function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim())
}

/**
 * A same-origin path for an uploaded image, or null when the value isn't
 * an http(s) URL or an absolute path. Strips the origin so images load
 * relative to the current Strapi admin host.
 */
export function assetPath(url: unknown): string | null {
  if (typeof url !== "string") return null
  const raw = url.trim()
  if (isHttpUrl(raw)) {
    try {
      return new URL(raw).pathname
    } catch {
      return null
    }
  }

  return /^\/(?!\/)/.test(raw) ? raw : null
}

export function renderValue(v: unknown): { text: string; isUrl: boolean } {
  if (v === null || v === undefined || v === "")
    return { text: "—", isUrl: false }
  if (Array.isArray(v)) {
    if (v.length === 0) return { text: "—", isUrl: false }

    return { text: v.join(", "), isUrl: false }
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.days))
      return {
        text: `${(o.days as { enabled?: boolean }[]).filter((d) => d?.enabled).length} day(s) with hours`,
        isUrl: false,
      }

    return { text: JSON.stringify(v), isUrl: false }
  }
  const s = String(v)

  return { text: s, isUrl: isHttpUrl(s) }
}

/** One line describing what a submission is about, for the queue table. */
export function summaryOf(sub: Submission): string {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null
  switch (sub.submissionType) {
    case "new_library":
      return str(f.name) ?? "Unnamed library"
    case "library_claim":
      return str(f.name) ?? sub.targetSlug ?? "Library claim"
    case "wiki_edit":
    case "blog_submission":
      return (
        str(d.title) ??
        str(d.proposedTitle) ??
        str(f.title) ??
        (sub.targetSlug ? `Edit: ${sub.targetSlug}` : "Untitled article")
      )
    case "topic_suggestion":
      return str(f.name) ?? "Topic"
    case "event_feed":
      return `${EVENT_PROVIDERS[f.provider as keyof typeof EVENT_PROVIDERS]?.label ?? "Event"} feed${f.kind === "replace" ? " (new details)" : ""}`
    case "role_application": {
      const role =
        f.role === "journal_editor"
          ? "Journal editor"
          : f.role === "wiki_editor"
            ? "Knowledge editor"
            : "Editor"
      const locales = Array.isArray(f.locales)
        ? [
            ...new Set(
              f.locales.flatMap((l: unknown) => {
                const code = str(l)

                return code ? [code] : []
              })
            ),
          ]
        : []

      const languages =
        locales.length > 0 ? locales.join(", ") : "all languages"
      if (f.role === "moderator") {
        const queue =
          f.queue === "index"
            ? "Index"
            : f.queue === "knowledge"
              ? "Knowledge"
              : f.queue === "journal"
                ? "Journal"
                : "Queue"

        return `Moderator application: ${queue} (${languages})`
      }

      return `${role} application (${languages})`
    }

    default:
      return sub.targetSlug ?? "Library"
  }
}

/** A second line: what kind of change, in a few words. */
export function detailOf(sub: Submission): string | null {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  if (
    sub.submissionType === "wiki_edit" ||
    sub.submissionType === "blog_submission"
  ) {
    if (d.kind === "new_article" || f.kind === "new_article")
      return "New article"
    if (d.isTranslation === true || f.isTranslation === true)
      return `Translation (${String(d.locale ?? f.locale ?? "?")})`
    if (Array.isArray(d.body)) return "Direct edit"
    if (Array.isArray(d.proposedBody)) return "Suggested edit"
    if (typeof f.category === "string") return `Report: ${f.category}`

    return null
  }
  if (sub.submissionType === "correction") {
    if (f.kind === "record") {
      const n = Object.keys(f).filter((k) => !EXCLUDE_FROM_OTHER.has(k)).length

      return `${n} field${n === 1 ? "" : "s"} changed`
    }
    if (f.kind === "facilities") return "Facility answers"
    if (f.kind === "photo") return "Photo"
    if (f.kind === "source") return "Source"
    if (f.kind === "verify") return "Still right?"

    return typeof f.category === "string" ? f.category : null
  }
  if (sub.submissionType === "library_edit") {
    const n = Object.keys(f).filter((k) => !EXCLUDE_FROM_OTHER.has(k)).length

    return `${n} field${n === 1 ? "" : "s"} changed`
  }
  if (sub.submissionType === "new_library")
    return (
      [f.libraryType, f.city]
        .filter((x) => typeof x === "string" && x)
        .join(" · ") || null
    )
  if (sub.submissionType === "library_claim")
    return typeof f.role === "string" ? f.role.replaceAll("_", " ") : null
  if (sub.submissionType === "event_feed") {
    const kind = f.kind === "replace" ? "replace" : "connect"
    const library = sub.targetSlug ?? "Library"

    return `${library} · ${kind === "replace" ? "new details" : "new connection"}`
  }

  return null
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)

  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
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
