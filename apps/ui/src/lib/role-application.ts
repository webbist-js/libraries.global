/**
 * Role Applications on the client: who may apply, what the form sends, and
 * the applications already on file. The checks mirror Strapi's
 * `validateRoleApplicationFields` and `checkRoleApplication`, which stay the
 * authority. Nothing here reads a Plan, Tier or Points.
 */

export {
  ROLE_APPLICATION_COOLDOWN_DAYS,
  ROLE_APPLICATION_MIN_ACCEPTED,
} from "@repo/access"

export const APPLICATION_ROLES = [
  "wiki_editor",
  "journal_editor",
  "moderator",
] as const
export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

export const APPLICATION_ROLE_LABEL: Record<ApplicationRole, string> = {
  wiki_editor: "Knowledge editor",
  journal_editor: "Journal editor",
  moderator: "Moderator",
}

/** The queues a Moderator applicant may ask for (never `applications`). */
export const APPLICATION_QUEUES = ["index", "knowledge", "journal"] as const
export type ApplicationQueue = (typeof APPLICATION_QUEUES)[number]

export const APPLICATION_QUEUE_LABEL: Record<ApplicationQueue, string> = {
  index: "Index (library records)",
  knowledge: "Knowledge",
  journal: "Journal",
}

export const APPLICATION_STATEMENT_MIN = 20
export const APPLICATION_STATEMENT_MAX = 2000
export const APPLICATION_SAMPLES_MAX = 5
export const APPLICATION_SECTIONS_MAX = 10

/** Submission states in which an application still awaits a decision. */
export const OPEN_APPLICATION_STATES: ReadonlySet<string> = new Set([
  "draft",
  "pending",
  "needs_info",
])

/** A row from `/submissions/my`, as far as this module reads it. */
export type MySubmissionRow = {
  documentId?: string
  submissionType?: string
  status?: string
  reviewNote?: string | null
  fields?: unknown
  draftData?: unknown
  targetSlug?: string | null
  createdAt?: string
  updatedAt?: string | null
  reviewedAt?: string | null
}

export type RoleApplicationSummary = {
  documentId: string
  role: ApplicationRole
  queue: ApplicationQueue | null
  status: string
  /** Empty means every language. */
  locales: string[]
  reviewNote: string | null
  createdAt: string | null
  /** When it was approved or rejected, if it was. */
  decidedAt: string | null
}

export type ApplicationInput = {
  role: ApplicationRole | null
  queue?: ApplicationQueue | null
  locales: string[]
  sections?: string[]
  statement: string
  /** As typed; blank entries are dropped. */
  samples: string[]
  acceptedGuidelines?: boolean
}

export type RoleApplicationFields = {
  role: ApplicationRole
  queue?: ApplicationQueue
  locales: string[]
  sections?: string[]
  statement: string
  samples: string[]
  acceptedGuidelines: true
}

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v)

export function applicationRoleFrom(v: unknown): ApplicationRole | null {
  return isIn(APPLICATION_ROLES, v) ? v : null
}

export function applicationQueueFrom(v: unknown): ApplicationQueue | null {
  return isIn(APPLICATION_QUEUES, v) ? v : null
}

/**
 * Which section list the application picks from: wiki sections for
 * Knowledge, blog sections for the Journal, none for the Index queue.
 */
export function sectionKindOf(
  role: ApplicationRole | null,
  queue: ApplicationQueue | null | undefined
): "knowledge" | "journal" | null {
  if (role === "wiki_editor") return "knowledge"
  if (role === "journal_editor") return "journal"
  if (role === "moderator" && queue === "knowledge") return "knowledge"
  if (role === "moderator" && queue === "journal") return "journal"

  return null
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []

/** The newest application for each role, newest first. */
export function latestApplications(
  rows: readonly MySubmissionRow[]
): RoleApplicationSummary[] {
  const byRole = new Map<ApplicationRole, RoleApplicationSummary>()
  const sorted = rows
    .filter((r) => r.submissionType === "role_application" && r.documentId)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
  for (const row of sorted) {
    const fields = (row.fields ?? {}) as Record<string, unknown>
    const role = applicationRoleFrom(fields.role)
    if (!role || byRole.has(role)) continue
    const status = row.status ?? "pending"
    const decided = status === "approved" || status === "rejected"
    byRole.set(role, {
      documentId: row.documentId as string,
      role,
      queue: role === "moderator" ? applicationQueueFrom(fields.queue) : null,
      status,
      locales: strings(fields.locales),
      reviewNote: row.reviewNote?.trim() ? row.reviewNote : null,
      createdAt: row.createdAt ?? null,
      decidedAt: decided ? (row.reviewedAt ?? row.updatedAt ?? null) : null,
    })
  }

  return [...byRole.values()]
}

/**
 * When a rejected application's cooldown ends, or null when there is none
 * (not rejected, no decision date, or the cooldown is over).
 */
export function cooldownEnds(
  app: Pick<RoleApplicationSummary, "status" | "decidedAt">,
  cooldownDays: number,
  now: Date = new Date()
): Date | null {
  if (app.status !== "rejected" || !app.decidedAt) return null
  const decided = new Date(app.decidedAt)
  if (Number.isNaN(decided.getTime())) return null
  const ends = new Date(decided.getTime() + cooldownDays * 86_400_000)

  return ends > now ? ends : null
}

/** "2 November 2026", the date format Strapi's cooldown message uses. */
export function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export type AcceptedChange = {
  documentId: string
  action: string
  target: string | null
  decidedAt: string | null
}

const text = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null

/** "loddon-library" → "Loddon library", for rows with nothing better. */
const humaniseSlug = (slug: string) => {
  const words = slug.replaceAll("-", " ").trim()

  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug
}

function actionOf(
  type: string,
  f: Record<string, unknown>,
  d: Record<string, unknown>
) {
  const isNew = d.kind === "new_article" || f.kind === "new_article"
  switch (type) {
    case "correction":
      if (f.kind === "photo") return "Shared a photo"
      if (f.kind === "source") return "Added a source"
      if (f.kind === "facilities") return "Confirmed facilities"
      if (f.kind === "record") return "Updated a record"

      return "Sent a correction"
    case "new_library":
      return "Added a library"
    case "library_edit":
      return "Edited a record"
    case "library_claim":
      return "Claimed a library"
    case "wiki_edit":
      return isNew ? "Wrote a Knowledge page" : "Improved a Knowledge page"
    case "blog_submission":
      return "Wrote for the Journal"
    case "topic_suggestion":
      return "Suggested a topic"

    default:
      return "Accepted change"
  }
}

/**
 * The user's accepted changes (Role Applications aside), newest decision
 * first: what an application attaches automatically.
 */
export function acceptedChanges(
  rows: readonly MySubmissionRow[]
): AcceptedChange[] {
  return rows
    .filter(
      (r) =>
        r.status === "approved" &&
        r.submissionType !== "role_application" &&
        r.documentId
    )
    .map((r) => {
      const f = (r.fields ?? {}) as Record<string, unknown>
      const d = (r.draftData ?? {}) as Record<string, unknown>

      return {
        documentId: r.documentId as string,
        action: actionOf(r.submissionType ?? "", f, d),
        target:
          text(f.libraryName) ??
          text(f.name) ??
          text(d.title) ??
          text(d.proposedTitle) ??
          text(f.title) ??
          (r.targetSlug ? humaniseSlug(r.targetSlug) : null),
        decidedAt: r.reviewedAt ?? r.updatedAt ?? r.createdAt ?? null,
      }
    })
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
}

function isHttpLink(v: string): boolean {
  try {
    const url = new URL(v)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** What's wrong with the form, in the server's words, or null. */
export function applicationProblem(
  input: ApplicationInput,
  configuredLocales: readonly string[]
): string | null {
  if (!input.role)
    return "Choose Knowledge editor, Journal editor or Moderator."
  if (input.role === "moderator" && !input.queue)
    return "Choose the queue you’d review."
  if (!input.locales.every((l) => configuredLocales.includes(l)))
    return "Choose languages from the list."
  if ((input.sections?.length ?? 0) > APPLICATION_SECTIONS_MAX)
    return `Choose at most ${APPLICATION_SECTIONS_MAX} sections.`
  const statement = input.statement.trim()
  if (
    statement.length < APPLICATION_STATEMENT_MIN ||
    statement.length > APPLICATION_STATEMENT_MAX
  )
    return `Write between ${APPLICATION_STATEMENT_MIN} and ${APPLICATION_STATEMENT_MAX} characters about why you’re applying.`
  const samples = input.samples.map((s) => s.trim()).filter(Boolean)
  if (samples.length > APPLICATION_SAMPLES_MAX)
    return `Add at most ${APPLICATION_SAMPLES_MAX} sample links.`
  if (!samples.every(isHttpLink))
    return "Sample links must start with http or https."
  if (input.acceptedGuidelines === false)
    return "Confirm that you’ve read the guidelines."

  return null
}

/** The submission's `fields`, as Strapi expects them (the shared contract). */
export function applicationFields(
  input: ApplicationInput & { role: ApplicationRole }
): RoleApplicationFields {
  const queue =
    input.role === "moderator" ? (input.queue ?? undefined) : undefined
  const sections =
    sectionKindOf(input.role, queue) && input.sections?.length
      ? [...new Set(input.sections)].slice(0, APPLICATION_SECTIONS_MAX)
      : undefined

  return {
    role: input.role,
    ...(queue ? { queue } : {}),
    locales: [...new Set(input.locales)],
    ...(sections ? { sections } : {}),
    statement: input.statement.trim(),
    samples: input.samples.map((s) => s.trim()).filter(Boolean),
    acceptedGuidelines: true,
  }
}
