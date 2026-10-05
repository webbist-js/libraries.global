/**
 * Shapes, labels and pure helpers for the site's Moderation Queue
 * (`/contribute/moderation`). `summaryOf`, `detailOf`, `humanise`,
 * `renderValue` and `extractText` are ports of the Strapi admin's helpers
 * (content-moderation `admin/src/components/submissionMeta.ts` and
 * `WikiEditDiffPanel.tsx`); a test keeps them in step.
 */

import type { BadgeColor } from "@/components/ds"

// ── API shapes (Strapi `/api/content-moderation/moderation/*`) ───────────────

export type ModerationQueueName =
  | "index"
  | "knowledge"
  | "journal"
  | "applications"

export type ModerationRow = {
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
  /** role_application only: who applied and what they've had accepted. */
  applicant?: RoleApplicant | null
}

/** The applicant block on a Role Application's detail (newest first, ≤ 10). */
export type RoleApplicant = {
  username: string | null
  acceptedCount: number
  recentAccepted: { summary: string; type: string; decidedAt: string }[]
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
  documentId: string
  name: string
  optionKey: "accessibility" | "amenities" | "services"
  status: "open" | "accepted" | "declined"
  requests: number
  votes: number
  libraries: { documentId: string; name: string }[]
  createdAt?: string
  decidedAt: string | null
  decidedBy: string | null
  decisionNote: string | null
}

export type ScopeLike = { queue: string; locale: string | null }

// ── Labels ────────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<string, string> = {
  correction: "Correction",
  new_library: "New library",
  library_edit: "Library edit",
  library_claim: "Library claim",
  wiki_edit: "Knowledge",
  blog_submission: "Journal",
  topic_suggestion: "Topic",
  role_application: "Role application",
}

export const TYPE_COLORS: Record<string, BadgeColor> = {
  correction: "aurora",
  new_library: "ok",
  library_edit: "aurora",
  library_claim: "gold",
  wiki_edit: "violet",
  blog_submission: "ember",
  topic_suggestion: "dim",
  role_application: "violet",
}

/** The Type column's label for a queue row (or any submission). */
export function moderationRowLabel(row: { submissionType: string }): string {
  return (
    TYPE_LABELS[row.submissionType] ??
    humanise(row.submissionType.replaceAll("_", " "))
  )
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
  STATUS_META[status] ?? {
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
  "photoId",
  "photoUrl",
])

// ── Ports of the admin helpers ───────────────────────────────────────────────

/** camelCase → words. */
export const humanise = (key: string) =>
  key
    .replace(/DocumentId$/, "")
    .replaceAll(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())

/**
 * Whether contributor-supplied text may be rendered as a link: http(s)
 * only. Anything else (javascript:, data:, a bare path) is shown as text.
 */
export function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim())
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

type SubmissionLike = {
  submissionType: string
  targetSlug?: string | null
  fields?: Record<string, unknown> | null
  draftData?: Record<string, unknown> | null
}

/** One line describing what a submission is about. */
export function summaryOf(sub: SubmissionLike): string {
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
    case "role_application":
      return roleApplicationSummary(f)

    default:
      return sub.targetSlug ?? "Library"
  }
}

const APPLICATION_ROLE_NAMES: Record<string, string> = {
  wiki_editor: "Knowledge editor",
  journal_editor: "Journal editor",
  moderator: "Moderator",
}

const APPLICATION_QUEUE_NAMES: Record<string, string> = {
  index: "Index",
  knowledge: "Knowledge",
  journal: "Journal",
}

/**
 * A Role Application in a line, as Strapi's submission summary writes it:
 * "Moderator application: Index (fr)", "Knowledge editor application (all
 * languages)".
 */
export function roleApplicationSummary(f: Record<string, unknown>): string {
  const role =
    typeof f.role === "string" ? APPLICATION_ROLE_NAMES[f.role] : undefined
  const locales = Array.isArray(f.locales)
    ? [
        ...new Set(
          f.locales.filter(
            (l): l is string => typeof l === "string" && l.trim() !== ""
          )
        ),
      ]
    : []
  const langs = locales.length > 0 ? locales.join(", ") : "all languages"
  if (f.role === "moderator") {
    const queue =
      typeof f.queue === "string" ? APPLICATION_QUEUE_NAMES[f.queue] : undefined

    return `Moderator application: ${queue ?? "Queue"} (${langs})`
  }

  return `${role ?? "Editor"} application (${langs})`
}

const fieldCount = (f: Record<string, unknown>) => {
  const n = Object.keys(f).filter((k) => !EXCLUDE_FROM_OTHER.has(k)).length

  return `${n} field${n === 1 ? "" : "s"} changed`
}

function articleDetail(
  f: Record<string, unknown>,
  d: Record<string, unknown>
): string | null {
  if (d.kind === "new_article" || f.kind === "new_article") return "New article"
  if (d.isTranslation === true || f.isTranslation === true)
    return `Translation (${String(d.locale ?? f.locale ?? "?")})`
  if (Array.isArray(d.body)) return "Direct edit"
  if (Array.isArray(d.proposedBody)) return "Suggested edit"
  if (typeof f.category === "string") return `Report: ${f.category}`

  return null
}

const CORRECTION_KINDS: Record<string, string> = {
  facilities: "Facility answers",
  photo: "Photo",
  source: "Source",
}

/** A second line: what kind of change, in a few words. */
export function detailOf(sub: SubmissionLike): string | null {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  switch (sub.submissionType) {
    case "wiki_edit":
    case "blog_submission":
      return articleDetail(f, d)
    case "correction":
      if (f.kind === "record") return fieldCount(f)
      if (typeof f.kind === "string" && f.kind in CORRECTION_KINDS)
        return CORRECTION_KINDS[f.kind] ?? null

      return typeof f.category === "string" ? f.category : null
    case "library_edit":
      return fieldCount(f)
    case "new_library":
      return (
        [f.libraryType, f.city]
          .filter((x) => typeof x === "string" && x)
          .join(" · ") || null
      )
    case "library_claim":
      return typeof f.role === "string" ? f.role.replaceAll("_", " ") : null

    default:
      return null
  }
}

/** Plain text of a Strapi blocks AST (paragraphs, headings, lists, quotes, code). */
function blocksToText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return ""
  const inline = (children: unknown): string =>
    Array.isArray(children)
      ? children
          .map((c) => {
            if (!c || typeof c !== "object") return ""
            const child = c as Record<string, unknown>
            if (typeof child.text === "string") return child.text

            return inline(child.children)
          })
          .join("")
      : ""
  const lines: string[] = []
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue
    const n = node as Record<string, unknown>
    switch (n.type) {
      case "heading":
        lines.push(`${"#".repeat(Number(n.level) || 2)} ${inline(n.children)}`)
        break
      case "list":
        if (Array.isArray(n.children))
          n.children.forEach((item, i) => {
            const li = item as Record<string, unknown>
            lines.push(
              `${n.format === "ordered" ? `${i + 1}.` : "•"} ${inline(li?.children)}`
            )
          })
        break
      case "quote":
        lines.push(`> ${inline(n.children)}`)
        break
      case "code":
        lines.push(`[code] ${inline(n.children).slice(0, 200)}`)
        break
      case "image":
        lines.push("[image]")
        break

      default:
        lines.push(inline(n.children))
    }
  }

  return lines.join("\n")
}

function blockText(b: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === "string" ? v : "")
  switch (b.__component) {
    case "content.rich-text":
      // Drafts carry Strapi blocks in `body`; the retired editor saved `text`.
      return typeof b.text === "string" ? b.text : blocksToText(b.body)
    case "content.quote-block":
      return typeof b.quote === "string"
        ? `"${b.quote}"${s(b.attribution) ? ` — ${s(b.attribution)}` : ""}`
        : ""
    case "content.callout":
      return typeof b.body === "string"
        ? `[${String(b.type ?? "note")}${s(b.title) ? `: ${s(b.title)}` : ""}] ${b.body}`
        : ""
    case "content.code-block":
      return typeof b.code === "string"
        ? `[code] ${b.code.slice(0, 200)}${b.code.length > 200 ? "…" : ""}`
        : ""
    case "content.image-block":
      return `[image${s(b.caption) ? `: ${s(b.caption)}` : ""}]`

    default:
      return ""
  }
}

/** Readable text of an article body (dynamic zone). */
export function extractText(body: unknown): string {
  if (!Array.isArray(body)) return ""

  return body
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map(blockText)
    .filter(Boolean)
    .join("\n\n")
}

// ── Dates ─────────────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)

  return `${formatDate(iso)} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
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
  no_hierarchy:
    "This library needs a continent, country and region before it can be published. Set its location, then approve again.",
  not_published:
    "This record has no published version; an admin must publish it first.",
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
      REFUSAL_COPY[String(err.reason)] ??
      "This change can't be applied to the record yet."
    )
  const known = ERROR_COPY[name]
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
