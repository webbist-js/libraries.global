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
export const APPLICATION_ROLES = [
  "wiki_editor",
  "journal_editor",
  "moderator",
] as const
export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

/** The queues a Moderator application may ask to review. */
export const APPLICATION_QUEUES = ["index", "knowledge", "journal"] as const
export type ApplicationQueue = (typeof APPLICATION_QUEUES)[number]

export const APPLICATION_STATEMENT_MIN = 20
export const APPLICATION_STATEMENT_MAX = 2000
export const APPLICATION_SAMPLES_MAX = 5
export const APPLICATION_SECTIONS_MAX = 10
const SAMPLE_URL_MAX = 2048
const SECTION_SLUG = /^[A-Za-z0-9._~-]{1,255}$/
const APPLICATION_KEYS = new Set([
  "role",
  "queue",
  "locales",
  "sections",
  "statement",
  "samples",
  "acceptedGuidelines",
])

export type RoleApplicationFields = {
  role: ApplicationRole
  /** Moderator applications only: the queue they'd review. */
  queue?: ApplicationQueue
  /** Empty means every locale. */
  locales: string[]
  /**
   * Section slugs they'd work on: wiki sections (Knowledge editor, Knowledge
   * queue) or blog sections (Journal editor, Journal queue). Always empty
   * for the Index queue.
   */
  sections: string[]
  statement: string
  samples: string[]
  acceptedGuidelines: true
}

/**
 * Which section list an application's `sections` come from: `wiki` for a
 * Knowledge editor or the Knowledge queue, `blog` for a Journal editor or
 * the Journal queue, none for the Index queue.
 */
export function applicationSectionKind(a: {
  role: ApplicationRole | null
  queue?: ApplicationQueue | null
}): "wiki" | "blog" | null {
  if (a.role === "wiki_editor") return "wiki"
  if (a.role === "journal_editor") return "blog"
  if (a.role === "moderator" && a.queue === "knowledge") return "wiki"
  if (a.role === "moderator" && a.queue === "journal") return "blog"

  return null
}

const uniqueStrings = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((l): l is string => typeof l === "string"))]
    : []

/**
 * The role, queue, locales and sections of a stored application, read
 * leniently: `role` is null unless it is one an application may ask for,
 * `queue` is null unless the role is `moderator` and the queue one it may
 * ask for, and `locales` / `sections` keep the unique strings (empty
 * locales means every locale). Shared by the approval, the moderation
 * scope checks and the notification emails, which read rows already
 * validated at submit time.
 */
export function roleApplicationFields(fields: unknown): {
  role: ApplicationRole | null
  queue: ApplicationQueue | null
  locales: string[]
  sections: string[]
} {
  const f =
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? (fields as Record<string, unknown>)
      : {}
  const role = isApplicationRole(f.role) ? f.role : null
  const queue =
    role === "moderator" && isApplicationQueue(f.queue) ? f.queue : null

  return {
    role,
    queue,
    locales: uniqueStrings(f.locales),
    sections: uniqueStrings(f.sections),
  }
}

export function isApplicationRole(v: unknown): v is ApplicationRole {
  return (
    typeof v === "string" &&
    (APPLICATION_ROLES as readonly string[]).includes(v)
  )
}

export function isApplicationQueue(v: unknown): v is ApplicationQueue {
  return (
    typeof v === "string" &&
    (APPLICATION_QUEUES as readonly string[]).includes(v)
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
 * `{ role, queue?, locales, sections?, statement, samples,
 * acceptedGuidelines }` and nothing else. `queue` is required for a
 * Moderator and dropped for anyone else; `sections` are dropped for the
 * Index queue. Locales and sections are de-duplicated; the statement is
 * trimmed. Whether the section slugs exist is checked by the policy.
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
      message: "Choose Knowledge editor, Journal editor or Moderator.",
    }
  const role = f.role

  let queue: ApplicationQueue | undefined
  if (role === "moderator") {
    if (!isApplicationQueue(f.queue))
      return {
        ok: false,
        message: "Choose the queue you'd review: Index, Knowledge or Journal.",
      }
    queue = f.queue
  }

  const rawLocales = f.locales ?? []
  if (
    !Array.isArray(rawLocales) ||
    !rawLocales.every((l) => typeof l === "string" && configured.includes(l))
  )
    return { ok: false, message: "Choose languages from the list." }

  const rawSections = f.sections ?? []
  if (!Array.isArray(rawSections))
    return { ok: false, message: "Choose sections from the list." }
  const sectionKind = applicationSectionKind({ role, queue })
  let sections: string[] = []
  if (sectionKind) {
    if (
      !rawSections.every((s) => typeof s === "string" && SECTION_SLUG.test(s))
    )
      return { ok: false, message: "Choose sections from the list." }
    sections = [...new Set(rawSections as string[])]
    if (sections.length > APPLICATION_SECTIONS_MAX)
      return {
        ok: false,
        message: `Choose at most ${APPLICATION_SECTIONS_MAX} sections.`,
      }
  }

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

  if (f.acceptedGuidelines !== true)
    return {
      ok: false,
      message: "Read and accept the guidelines to apply.",
    }

  return {
    ok: true,
    value: {
      role,
      ...(queue ? { queue } : {}),
      locales: [...new Set(rawLocales as string[])],
      sections,
      statement,
      samples: (samples as string[]).map((s) => s.trim()),
      acceptedGuidelines: true,
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
