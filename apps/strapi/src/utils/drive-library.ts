import { librarySourceKey, type DriveLibrary } from "@repo/shared-data"

const LIBRARY = "api::library.library"

// Strapi v5 documentIds are 24 lowercase alphanumerics; allow 20–32 for
// safety. Mirrors `isDocumentId` in the content-moderation plugin's
// `utils/params.ts` — duplicated rather than imported so this core util
// doesn't reach into a plugin's own source tree (plugins build to their own
// `dist/`; core `src` does not).
const DOCUMENT_ID = /^[a-z0-9]{20,32}$/
const isDocumentId = (v: unknown): v is string =>
  typeof v === "string" && DOCUMENT_ID.test(v)

const DRIVE_LIBRARY_FIELDS = [
  "documentId",
  "libraryType",
  "completeness",
  "createdAt",
  "operationalStatus",
] as const
const DRIVE_LIBRARY_POPULATE = {
  sourceRecords: { fields: ["dataset", "role"] },
  continent: { fields: ["slug"] },
  country: { fields: ["slug"] },
  region: { fields: ["slug"] },
  area: { fields: ["slug"] },
} as const

/**
 * The library a Drive-tagged submission targets (or, for untagged credit, the
 * library a just-approved change was made to), with its place slugs, for
 * `libraryInScope`. Looked up by documentId, falling back to `targetSlug`
 * like `allowedTerms` — a submission may carry only one of the two.
 *
 * Shared by the submission policy (`check()`, at submission/finalize time)
 * and the drive service (`creditApproval`, post-commit) so both read the
 * same library shape from one copy.
 */
export async function loadDriveLibrary(
  strapi: any,
  target: { targetDocumentId?: unknown; targetSlug?: unknown }
): Promise<DriveLibrary | null> {
  let row: Record<string, any> | null = null
  if (isDocumentId(target.targetDocumentId)) {
    row = await strapi.documents(LIBRARY).findOne({
      documentId: target.targetDocumentId,
      fields: DRIVE_LIBRARY_FIELDS as unknown as string[],
      populate: DRIVE_LIBRARY_POPULATE,
    })
  } else if (typeof target.targetSlug === "string" && target.targetSlug) {
    ;[row] = await strapi.documents(LIBRARY).findMany({
      filters: { slug: { $eq: target.targetSlug } },
      fields: DRIVE_LIBRARY_FIELDS as unknown as string[],
      populate: DRIVE_LIBRARY_POPULATE,
      limit: 1,
    })
  }
  if (!row) return null

  return {
    documentId: row.documentId,
    continent: row.continent?.slug ?? null,
    country: row.country?.slug ?? null,
    region: row.region?.slug ?? null,
    area: row.area?.slug ?? null,
    libraryType: row.libraryType ?? null,
    source: librarySourceKey(row.sourceRecords),
    completeness: row.completeness ?? null,
    createdAt: row.createdAt ?? null,
    operationalStatus: row.operationalStatus ?? null,
  }
}
