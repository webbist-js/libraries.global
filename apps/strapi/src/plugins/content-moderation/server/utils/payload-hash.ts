import { createHash } from "node:crypto"

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])])
    )

  return v ?? null
}

type HashedSubmission = {
  submissionType: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
  draftData?: unknown
  /** The service-layer name; a stored row carries `contentLocale`. */
  locale?: string | null
  contentLocale?: string | null
}

function digest(doc: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(doc)))
    .digest("hex")
}

/**
 * SHA-256 over exactly what a moderator reviews, including the locale the
 * change is written to. Stored when a submission enters review.
 */
export function payloadHash(s: HashedSubmission): string {
  return digest({
    submissionType: s.submissionType,
    targetDocumentId: s.targetDocumentId ?? null,
    targetSlug: s.targetSlug ?? null,
    fields: s.fields ?? null,
    draftData: s.draftData ?? null,
    locale: s.contentLocale ?? s.locale ?? null,
  })
}

/**
 * The hash as it was computed before submissions carried a locale. Only the
 * `submission-locale-v1` backfill uses it, to re-pin rows whose stored hash
 * still matches their content.
 */
export function legacyPayloadHash(s: HashedSubmission): string {
  return digest({
    submissionType: s.submissionType,
    targetDocumentId: s.targetDocumentId ?? null,
    targetSlug: s.targetSlug ?? null,
    fields: s.fields ?? null,
    draftData: s.draftData ?? null,
  })
}
