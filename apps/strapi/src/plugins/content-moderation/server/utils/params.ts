export const VERIFICATION_METHODS = [
  "email_domain",
  "vouching",
  "contact_us",
] as const
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]

// Strapi v5 documentIds are 24 lowercase alphanumerics; allow 20–32 for safety.
const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

export function isDocumentId(v: unknown): v is string {
  return typeof v === "string" && DOCUMENT_ID.test(v)
}

/** A draft that proposes a brand-new article rather than a change to one. */
export function isNewArticleDraft(draftData: unknown): boolean {
  return (
    !!draftData &&
    typeof draftData === "object" &&
    (draftData as Record<string, unknown>).kind === "new_article"
  )
}

/**
 * Whether a draft carries article content that approval would publish
 * straight onto an existing article: a `body` array or a `title` string
 * aimed at a target. Used identically at create time and at finalize time
 * so a reader can't slip a direct-edit body past the create-time check by
 * saving it into the draft afterwards.
 *
 * A new-article draft (`kind: "new_article"`) is not a direct edit: any
 * signed-in contributor may write one, and approval creates it as a Strapi
 * draft unless the submitter holds the editor capability (see
 * `applyArticleSubmission`). Likewise a `proposedBody` is a suggestion
 * that approval writes to the article's draft version, never publishes.
 */
function isDirectArticleEdit(draftData: unknown): boolean {
  if (!draftData || typeof draftData !== "object") return false
  if (isNewArticleDraft(draftData)) return false
  const d = draftData as Record<string, unknown>

  return Array.isArray(d.body) || typeof d.title === "string"
}

/** A `wiki_edit` that publishes on approval (needs `docs.directEdit`). */
export function isDirectWikiEdit(draftData: unknown): boolean {
  return isDirectArticleEdit(draftData)
}

/** A `blog_submission` that publishes on approval (needs `journal.directEdit`). */
export function isDirectJournalEdit(draftData: unknown): boolean {
  return isDirectArticleEdit(draftData)
}

/**
 * `draftData` must be a plain, non-array object no larger than 256KB
 * serialized. Shared by `create` and `saveDraft` so both reject the same
 * malformed/oversized payloads the same way.
 */
export function isValidDraftData(v: unknown): boolean {
  const isPlainObject = typeof v === "object" && v !== null && !Array.isArray(v)

  return isPlainObject && JSON.stringify(v).length <= 256 * 1024
}

/** The roles a Role Application may ask for. */
export const APPLICATION_ROLES = ["wiki_editor", "journal_editor"] as const
export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

export const APPLICATION_STATEMENT_MIN = 20
export const APPLICATION_STATEMENT_MAX = 2000
export const APPLICATION_SAMPLES_MAX = 5
const SAMPLE_URL_MAX = 2048
const APPLICATION_KEYS = new Set(["role", "locales", "statement", "samples"])

export type RoleApplicationFields = {
  role: ApplicationRole
  /** Empty means every locale. */
  locales: string[]
  statement: string
  samples: string[]
}

export function isApplicationRole(v: unknown): v is ApplicationRole {
  return (
    typeof v === "string" &&
    (APPLICATION_ROLES as readonly string[]).includes(v)
  )
}

function isHttpLink(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim() || v.length > SAMPLE_URL_MAX)
    return false
  try {
    const url = new URL(v.trim())

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Checks a `role_application`'s `fields` against the configured locales:
 * `{ role, locales, statement, samples }` and nothing else. Locales are
 * de-duplicated; the statement is trimmed.
 */
export function validateRoleApplicationFields(
  fields: unknown,
  configured: readonly string[]
): { ok: true; value: RoleApplicationFields } | { ok: false; message: string } {
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    return { ok: false, message: "Tell us which role you're applying for." }
  const f = fields as Record<string, unknown>
  const unknown = Object.keys(f).find((k) => !APPLICATION_KEYS.has(k))
  if (unknown)
    return {
      ok: false,
      message: `Unexpected field in the application: ${unknown}.`,
    }

  if (!isApplicationRole(f.role))
    return {
      ok: false,
      message: "Choose Knowledge editor or Journal editor.",
    }

  const rawLocales = f.locales ?? []
  if (
    !Array.isArray(rawLocales) ||
    !rawLocales.every((l) => typeof l === "string" && configured.includes(l))
  )
    return { ok: false, message: "Choose languages from the list." }

  const statement = typeof f.statement === "string" ? f.statement.trim() : ""
  if (
    statement.length < APPLICATION_STATEMENT_MIN ||
    statement.length > APPLICATION_STATEMENT_MAX
  )
    return {
      ok: false,
      message: `Write between ${APPLICATION_STATEMENT_MIN} and ${APPLICATION_STATEMENT_MAX} characters about why you're applying.`,
    }

  const samples = f.samples ?? []
  if (!Array.isArray(samples) || samples.length > APPLICATION_SAMPLES_MAX)
    return {
      ok: false,
      message: `Add at most ${APPLICATION_SAMPLES_MAX} sample links.`,
    }
  if (!samples.every(isHttpLink))
    return { ok: false, message: "Sample links must start with http or https." }

  return {
    ok: true,
    value: {
      role: f.role,
      locales: [...new Set(rawLocales as string[])],
      statement,
      samples: (samples as string[]).map((s) => s.trim()),
    },
  }
}
