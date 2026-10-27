/** Pure moderation display rules. Adapters retain privileged fields, UI tokens and errors. */
import { proposedDrive } from "./drives"
import { EVENT_PROVIDERS, type EventProviderKey } from "./event-providers"

export const MODERATION_TYPE_LABELS: Record<string, string> = {
  correction: "Correction",
  new_library: "New library",
  library_edit: "Library edit",
  library_claim: "Library claim",
  network_claim: "Service or network claim",
  wiki_edit: "Knowledge",
  blog_submission: "Journal",
  topic_suggestion: "Topic",
  role_application: "Role application",
  event_feed: "Event feed",
  drive_proposal: "Drive proposal",
}

export const MODERATION_EVIDENCE_TYPE_LABELS: Record<string, string> = {
  institutional_url: "Institutional URL",
  on_site_photo: "On-site photo",
  on_site_visit: "Checked in person",
  press_release: "Press release",
  personal_communication: "Personal communication",
  my_institutional_affiliation: "Institutional affiliation",
  other: "Other",
}

export const MODERATION_FIELD_GROUPS: { label: string; keys: string[] }[] = [
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

export const MODERATION_EXCLUDE_FROM_OTHER = new Set([
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
  "sourceRecords",
  "photoId",
  "photoUrl",
])

/** camelCase → words. */
export const moderationHumanise = (key: string) =>
  key
    .replace(/DocumentId$/, "")
    .replaceAll(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())

/**
 * Whether contributor-supplied text may be rendered as a link: http(s)
 * only. Anything else (javascript:, data:, a bare path) is shown as text.
 */
export function moderationIsHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim())
}

export function moderationRenderValue(v: unknown): {
  text: string
  isUrl: boolean
} {
  if (v === null || v === undefined || v === "")
    return { text: "—", isUrl: false }
  if (Array.isArray(v)) {
    if (v.length === 0) return { text: "—", isUrl: false }

    return {
      text: v
        .map((item) => {
          if (item && typeof item === "object") {
            const source = item as {
              url?: string
              label?: string
              fields?: string[]
            }
            if (source.url)
              return [source.label, source.url, source.fields?.join(", ")]
                .filter(Boolean)
                .join(" · ")

            return JSON.stringify(item)
          }

          return String(item)
        })
        .join(", "),
      isUrl: false,
    }
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

  return { text: s, isUrl: moderationIsHttpUrl(s) }
}

export type ModerationSubmissionLike = {
  submissionType: string
  targetSlug?: string | null
  fields?: Record<string, unknown> | null
  draftData?: Record<string, unknown> | null
}

/** One line describing what a submission is about. */
export function moderationSummaryOf(sub: ModerationSubmissionLike): string {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null
  switch (sub.submissionType) {
    case "new_library":
      return str(f.name) ?? "Unnamed library"
    case "network_claim":
      return `${String(f.networkName ?? "Service")} · ${String(f.intent ?? "affiliation")} · ${Array.isArray(f.libraryIds) ? f.libraryIds.length : 0} libraries`
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
      return `${typeof f.provider === "string" && Object.hasOwn(EVENT_PROVIDERS, f.provider) ? EVENT_PROVIDERS[f.provider as EventProviderKey].label : "Event"} feed${f.kind === "replace" ? " (new details)" : ""}`
    case "role_application":
      return moderationRoleApplicationSummary(f)
    case "drive_proposal": {
      const title = moderationDriveProposalTitle(d)

      return title ? `Drive: ${title}` : "Drive proposal"
    }

    default:
      return sub.targetSlug ?? "Library"
  }
}

/**
 * A Drive Proposal's title without its `*italic*` markers, or null when it
 * has none.
 */
export function moderationDriveProposalTitle(
  draftData: unknown
): string | null {
  const title = proposedDrive(draftData)?.title
  if (typeof title !== "string") return null
  const plain = title.replaceAll("*", "").trim()

  return plain || null
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
export function moderationRoleApplicationSummary(
  f: Record<string, unknown>,
  options?: { trimLocales?: boolean }
): string {
  const role = options?.trimLocales
    ? f.role === "wiki_editor"
      ? "Knowledge editor"
      : f.role === "journal_editor"
        ? "Journal editor"
        : undefined
    : typeof f.role === "string" &&
        Object.hasOwn(APPLICATION_ROLE_NAMES, f.role)
      ? APPLICATION_ROLE_NAMES[f.role]
      : undefined
  const locales = Array.isArray(f.locales)
    ? [
        ...new Set(
          f.locales.flatMap((value) => {
            if (typeof value !== "string" || !value.trim()) return []

            return [options?.trimLocales ? value.trim() : value]
          })
        ),
      ]
    : []
  const langs = locales.length > 0 ? locales.join(", ") : "all languages"
  if (f.role === "moderator") {
    const queue = options?.trimLocales
      ? f.queue === "index"
        ? "Index"
        : f.queue === "knowledge"
          ? "Knowledge"
          : f.queue === "journal"
            ? "Journal"
            : undefined
      : typeof f.queue === "string" &&
          Object.hasOwn(APPLICATION_QUEUE_NAMES, f.queue)
        ? APPLICATION_QUEUE_NAMES[f.queue]
        : undefined

    return `Moderator application: ${queue ?? "Queue"} (${langs})`
  }

  return `${role ?? "Editor"} application (${langs})`
}

export const moderationFieldChangeCount = (f: Record<string, unknown>) => {
  const n = Object.keys(f).filter(
    (k) => !MODERATION_EXCLUDE_FROM_OTHER.has(k)
  ).length

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
  verify: "Still right?",
}

/** A second line: what kind of change, in a few words. */
export function moderationDetailOf(
  sub: ModerationSubmissionLike
): string | null {
  const f = sub.fields ?? {}
  const d = sub.draftData ?? {}
  switch (sub.submissionType) {
    case "wiki_edit":
    case "blog_submission":
      return articleDetail(f, d)
    case "correction":
      if (f.kind === "record") return moderationFieldChangeCount(f)
      if (typeof f.kind === "string" && Object.hasOwn(CORRECTION_KINDS, f.kind))
        return CORRECTION_KINDS[f.kind] ?? null

      return typeof f.category === "string" ? f.category : null
    case "library_edit":
      return moderationFieldChangeCount(f)
    case "new_library":
      return (
        [
          f.libraryType,
          f.city,
          sub.draftData?.staffCreation ? "Staff ownership requested" : null,
        ]
          .filter((x) => typeof x === "string" && x)
          .join(" · ") || null
      )
    case "library_claim":
      return typeof f.role === "string" ? f.role.replaceAll("_", " ") : null
    case "event_feed": {
      const kind = f.kind === "replace" ? "replace" : "connect"
      const library = sub.targetSlug ?? "Library"

      return `${library} · ${kind === "replace" ? "new details" : "new connection"}`
    }

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
      case "heading": {
        const requested =
          typeof n.level === "number" || typeof n.level === "string"
            ? Number(n.level)
            : 2
        const level =
          Number.isFinite(requested) && requested !== 0
            ? Math.max(1, Math.min(6, Math.trunc(requested)))
            : 2
        lines.push(`${"#".repeat(level)} ${inline(n.children)}`)
        break
      }
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
export function moderationExtractText(body: unknown): string {
  if (!Array.isArray(body)) return ""

  return body
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map(blockText)
    .filter(Boolean)
    .join("\n\n")
}

// ── Dates ─────────────────────────────────────────────────────────────────

export function moderationFormatDate(iso: string | null | undefined): string {
  if (!iso) return "—"

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function moderationFormatDateTime(
  iso: string | null | undefined
): string {
  if (!iso) return "—"
  const d = new Date(iso)

  return `${moderationFormatDate(iso)} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
}

/** Newly introduced article refusals: copy shared by both moderation surfaces. */
export const MODERATION_ARTICLE_REFUSAL_COPY: Record<
  "stale_article" | "invalid_media",
  string
> = {
  stale_article:
    "This article changed while the revision was being written. Request changes and ask the writer to compare the current publication before resubmitting.",
  invalid_media:
    "An image is unavailable or does not belong to this writer or the current article. Request changes and ask the writer to replace it.",
}

/** Only handles these new refusal reasons; adapters preserve their existing error policy. */
export function moderationArticleRefusalMessage(body: unknown): string | null {
  const error =
    body && typeof body === "object"
      ? (body as { error?: unknown }).error
      : null
  if (!error || typeof error !== "object") return null
  const { name, reason } = error as { name?: unknown; reason?: unknown }
  if (
    name !== "apply_refused" ||
    typeof reason !== "string" ||
    !Object.hasOwn(MODERATION_ARTICLE_REFUSAL_COPY, reason)
  )
    return null

  return MODERATION_ARTICLE_REFUSAL_COPY[
    reason as keyof typeof MODERATION_ARTICLE_REFUSAL_COPY
  ]
}
