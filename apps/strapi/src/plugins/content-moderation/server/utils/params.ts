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

/**
 * A `wiki_edit` draft counts as a direct edit (not a mere suggestion) as
 * soon as it carries an applied key: a `body` array or a `title` string.
 * Used identically at create time and at finalize time so a reader can't
 * slip a direct-edit body past the create-time check by saving it into the
 * draft afterwards.
 */
export function isDirectWikiEdit(draftData: unknown): boolean {
  if (!draftData || typeof draftData !== "object") return false
  const d = draftData as Record<string, unknown>

  return Array.isArray(d.body) || typeof d.title === "string"
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
