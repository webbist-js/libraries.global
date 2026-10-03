/**
 * Role Applications on the client: who may apply, what the form sends, and
 * the applications already on file. The checks mirror Strapi's
 * `validateRoleApplicationFields` and `checkRoleApplication`, which stay the
 * authority. Nothing here reads a Plan, Tier or Points.
 */

export { ROLE_APPLICATION_MIN_ACCEPTED } from "@repo/access"

export const APPLICATION_ROLES = ["wiki_editor", "journal_editor"] as const
export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

export const APPLICATION_ROLE_LABEL: Record<ApplicationRole, string> = {
  wiki_editor: "Knowledge editor",
  journal_editor: "Journal editor",
}

export const APPLICATION_STATEMENT_MIN = 20
export const APPLICATION_STATEMENT_MAX = 2000
export const APPLICATION_SAMPLES_MAX = 5

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
  createdAt?: string
}

export type RoleApplicationSummary = {
  documentId: string
  role: ApplicationRole
  status: string
  /** Empty means every language. */
  locales: string[]
  reviewNote: string | null
  createdAt: string | null
}

export type ApplicationInput = {
  role: ApplicationRole | null
  locales: string[]
  statement: string
  /** As typed; blank entries are dropped. */
  samples: string[]
}

export type RoleApplicationFields = {
  role: ApplicationRole
  locales: string[]
  statement: string
  samples: string[]
}

export function applicationRoleFrom(v: unknown): ApplicationRole | null {
  return typeof v === "string" &&
    (APPLICATION_ROLES as readonly string[]).includes(v)
    ? (v as ApplicationRole)
    : null
}

/** The newest application for each role, newest first. */
export function latestApplications(
  rows: readonly MySubmissionRow[]
): RoleApplicationSummary[] {
  const byRole = new Map<ApplicationRole, RoleApplicationSummary>()
  const sorted = rows
    .filter((r) => r.submissionType === "role_application" && r.documentId)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
  for (const row of sorted) {
    const fields = (row.fields ?? {}) as { role?: unknown; locales?: unknown }
    const role = applicationRoleFrom(fields.role)
    if (!role || byRole.has(role)) continue
    byRole.set(role, {
      documentId: row.documentId as string,
      role,
      status: row.status ?? "pending",
      locales: Array.isArray(fields.locales)
        ? fields.locales.filter((l): l is string => typeof l === "string")
        : [],
      reviewNote: row.reviewNote?.trim() ? row.reviewNote : null,
      createdAt: row.createdAt ?? null,
    })
  }

  return [...byRole.values()]
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
  if (!input.role) return "Choose Knowledge editor or Journal editor."
  if (!input.locales.every((l) => configuredLocales.includes(l)))
    return "Choose languages from the list."
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

  return null
}

/** The submission's `fields`, as Strapi expects them. */
export function applicationFields(
  input: ApplicationInput & { role: ApplicationRole }
): RoleApplicationFields {
  return {
    role: input.role,
    locales: [...new Set(input.locales)],
    statement: input.statement.trim(),
    samples: input.samples.map((s) => s.trim()).filter(Boolean),
  }
}
