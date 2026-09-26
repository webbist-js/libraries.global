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

/** SHA-256 over exactly what a moderator reviews. Stored when a submission enters review. */
export function payloadHash(s: {
  submissionType: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
  draftData?: unknown
}): string {
  const doc = canonical({
    submissionType: s.submissionType,
    targetDocumentId: s.targetDocumentId ?? null,
    targetSlug: s.targetSlug ?? null,
    fields: s.fields ?? null,
    draftData: s.draftData ?? null,
  })

  return createHash("sha256").update(JSON.stringify(doc)).digest("hex")
}
