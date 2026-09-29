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
