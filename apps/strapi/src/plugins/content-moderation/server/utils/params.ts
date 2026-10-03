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

/**
 * The role and locales of a stored application, read leniently: `role` is
 * null unless it is one an application may ask for, and `locales` keeps the
 * unique strings (empty means every locale). Shared by the approval and the
 * notification emails, which read rows already validated at submit time.
 */
export function roleApplicationFields(fields: unknown): {
  role: ApplicationRole | null
  locales: string[]
} {
  const f =
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? (fields as Record<string, unknown>)
      : {}
  const locales = Array.isArray(f.locales)
    ? [...new Set(f.locales.filter((l): l is string => typeof l === "string"))]
    : []

  return { role: isApplicationRole(f.role) ? f.role : null, locales }
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

/** What a Location Request asks for: a missing Region or Area. */
export const LOCATION_REQUEST_KINDS = ["region", "area"] as const
export type LocationRequestKind = (typeof LOCATION_REQUEST_KINDS)[number]

export const LOCATION_NAME_MIN = 2
export const LOCATION_NAME_MAX = 120
export const LOCATION_TYPE_LABEL_MAX = 60
export const LOCATION_NOTE_MAX = 1000
const LOCATION_REQUEST_KEYS = new Set([
  "kind",
  "name",
  "typeLabel",
  "countryDocumentId",
  "regionDocumentId",
  "note",
  "evidenceUrl",
])

export type LocationRequestFields = {
  kind: LocationRequestKind
  name: string
  typeLabel?: string
  countryDocumentId: string
  /** Areas only: the region the area belongs to. */
  regionDocumentId?: string
  note?: string
  evidenceUrl: string
}

export function isLocationRequestKind(v: unknown): v is LocationRequestKind {
  return (
    typeof v === "string" &&
    (LOCATION_REQUEST_KINDS as readonly string[]).includes(v)
  )
}

const trimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

/** A place name a moderator or contributor typed: trimmed, 2–120 chars. */
export function locationNameProblem(name: string): string | null {
  return name.length < LOCATION_NAME_MIN || name.length > LOCATION_NAME_MAX
    ? `Give the place a name of ${LOCATION_NAME_MIN} to ${LOCATION_NAME_MAX} characters.`
    : null
}

/** A type label ("County", "Borough"): at most 60 chars. */
export function locationTypeLabelProblem(typeLabel: string): string | null {
  return typeLabel.length > LOCATION_TYPE_LABEL_MAX
    ? `Keep the type to ${LOCATION_TYPE_LABEL_MAX} characters or fewer.`
    : null
}

/**
 * Checks a `location_request`'s `fields`: `{ kind, name, typeLabel?,
 * countryDocumentId, regionDocumentId (areas), note?, evidenceUrl }` and
 * nothing else. Strings are trimmed; empty optional ones are dropped, and a
 * region request keeps no `regionDocumentId`.
 */
export function validateLocationRequestFields(
  fields: unknown
): { ok: true; value: LocationRequestFields } | { ok: false; message: string } {
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    return { ok: false, message: "Tell us which place is missing." }
  const f = fields as Record<string, unknown>
  const unknown = Object.keys(f).find((k) => !LOCATION_REQUEST_KEYS.has(k))
  if (unknown)
    return {
      ok: false,
      message: `Unexpected field in the request: ${unknown}.`,
    }

  if (!isLocationRequestKind(f.kind))
    return { ok: false, message: "Ask for a region or an area." }

  const name = trimmed(f.name)
  const nameProblem = locationNameProblem(name)
  if (nameProblem) return { ok: false, message: nameProblem }

  if (f.typeLabel != null && typeof f.typeLabel !== "string")
    return { ok: false, message: "The type must be text." }
  const typeLabel = trimmed(f.typeLabel)
  const typeProblem = locationTypeLabelProblem(typeLabel)
  if (typeProblem) return { ok: false, message: typeProblem }

  if (!isDocumentId(f.countryDocumentId))
    return { ok: false, message: "Choose the country first." }
  if (f.kind === "area" && !isDocumentId(f.regionDocumentId))
    return {
      ok: false,
      message: "Choose the region the area belongs to.",
    }

  if (f.note != null && typeof f.note !== "string")
    return { ok: false, message: "The note must be text." }
  const note = trimmed(f.note)
  if (note.length > LOCATION_NOTE_MAX)
    return {
      ok: false,
      message: `Keep the note to ${LOCATION_NOTE_MAX} characters or fewer.`,
    }

  if (!isHttpLink(f.evidenceUrl))
    return {
      ok: false,
      message:
        "Add a link that shows the place exists, starting with http or https.",
    }

  return {
    ok: true,
    value: {
      kind: f.kind,
      name,
      ...(typeLabel ? { typeLabel } : {}),
      countryDocumentId: f.countryDocumentId,
      ...(f.kind === "area"
        ? { regionDocumentId: f.regionDocumentId as string }
        : {}),
      ...(note ? { note } : {}),
      evidenceUrl: (f.evidenceUrl as string).trim(),
    },
  }
}

/** A Moderator's changes to a Location Request (`draftData.moderatorEdit`). */
export type LocationEdit = { name?: string; typeLabel?: string }

/** The stored `moderatorEdit`, read leniently (unknown values dropped). */
export function locationEditOf(draftData: unknown): LocationEdit {
  const d =
    draftData && typeof draftData === "object" && !Array.isArray(draftData)
      ? (draftData as Record<string, unknown>).moderatorEdit
      : null
  if (!d || typeof d !== "object" || Array.isArray(d)) return {}
  const e = d as Record<string, unknown>
  const out: LocationEdit = {}
  if (typeof e.name === "string" && e.name.trim()) out.name = e.name.trim()
  if (typeof e.typeLabel === "string") out.typeLabel = e.typeLabel.trim()

  return out
}
