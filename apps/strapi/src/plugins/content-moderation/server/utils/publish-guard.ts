/**
 * Guards every apply-on-approval write to a draft-and-publish record.
 *
 * `documents().update({ status: "published" })` writes the draft version and
 * then publishes the whole of it, so it would also publish an admin's
 * unfinished Content Manager edits, and would publish a `PENDING-` library
 * that was never reviewed. So an approval:
 *
 * 1. is refused (`ApplyRefusedError("not_published")`) when the record has
 *    no published version: the moderator publishes it first;
 * 2. is written to the draft only when the draft already differs from the
 *    published version on a field the approval doesn't touch (the admin's
 *    edit stays unpublished, and so does this change until they publish);
 * 3. is published otherwise.
 */

export type ApplyRefusedReason = "not_published"

export class ApplyRefusedError extends Error {
  readonly reason: ApplyRefusedReason
  readonly uid: string
  readonly documentId: string

  constructor(reason: ApplyRefusedReason, uid: string, documentId: string) {
    super(`apply refused (${reason}): ${uid} ${documentId}`)
    this.name = "ApplyRefusedError"
    this.reason = reason
    this.uid = uid
    this.documentId = documentId
  }
}

export type ApplyMode =
  | { mode: "published" }
  | { mode: "draft_only"; divergentKeys: string[] }

export type PublishGuardOptions = {
  locale?: string | null
  /**
   * The scalar fields compared between the draft and published versions
   * (never relations, media or components: `fields` can't select those).
   * Defaults per content type below.
   */
  fields?: readonly string[]
}

/** The library's own scalar attributes (see api::library schema). */
export const LIBRARY_COMPARE_FIELDS: readonly string[] = [
  "name",
  "slug",
  "entityRef",
  "shortName",
  "alternateNames",
  "summary",
  "description",
  "libraryType",
  "operatorType",
  "foundedYear",
  "openedYear",
  "closedYear",
  "city",
  "district",
  "streetAddress",
  "postalCode",
  "location",
  "timezone",
  "openingTimes",
  "website",
  "catalogueUrl",
  "membershipUrl",
  "bookingUrl",
  "planVisitUrl",
  "virtualTourUrl",
  "donationUrl",
  "email",
  "phone",
  "operationalStatus",
  "closureReason",
  "visitNotes",
  "admissionInfo",
  "accessibilityNotes",
  "absentFacilities",
  "virtualTourEmbed",
  "architect",
  "buildingInfo",
  "languagesServed",
  "classificationSystem",
  "iiifEndpoint",
  "transitInfo",
  "nearestStation",
  "wikidataId",
  "featured",
  "source",
  "sourceUrl",
]

/** Scalar attributes shared by wiki-article and blog-article. */
export const ARTICLE_COMPARE_FIELDS: readonly string[] = [
  "title",
  "slug",
  "summary",
  "author",
  "featured",
]

const DEFAULT_FIELDS: Record<string, readonly string[]> = {
  "api::library.library": LIBRARY_COMPARE_FIELDS,
  "api::wiki-article.wiki-article": [
    ...ARTICLE_COMPARE_FIELDS,
    "priority",
    "articleStatus",
    "docsSections",
  ],
  "api::blog-article.blog-article": [
    ...ARTICLE_COMPARE_FIELDS,
    "authorTitle",
    "authorBio",
  ],
}

/** Never compared: identity and timestamps differ between versions by design. */
const META_KEYS = new Set([
  "id",
  "documentId",
  "locale",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "contentUpdatedAt",
  "lastVerifiedAt",
])

function canonical(v: unknown): string {
  if (v === undefined || v === null || v === "") return "null"
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`
  if (typeof v === "object") {
    const o = v as Record<string, unknown>

    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`
  }

  return JSON.stringify(v)
}

function compareFields(
  uid: string,
  data: Record<string, unknown>,
  fields?: readonly string[]
): string[] {
  return (fields ?? DEFAULT_FIELDS[uid] ?? []).filter(
    (k) => !(k in data) && !META_KEYS.has(k)
  )
}

/** The published version of a record (its compared fields), or null. */
export async function loadPublishedTarget(
  strapi: any,
  uid: string,
  documentId: string,
  { locale, fields }: PublishGuardOptions = {}
): Promise<Record<string, unknown> | null> {
  const compare = compareFields(uid, {}, fields)
  const row = await strapi.documents(uid).findOne({
    documentId,
    status: "published",
    ...(locale ? { locale } : {}),
    fields: ["documentId", ...compare],
  })

  return row ?? null
}

/**
 * Writes `data` to the record: published when the draft carries no other
 * unpublished change, draft-only otherwise. Throws `ApplyRefusedError` when
 * the record has no published version. Database errors propagate.
 */
export async function applyToPublished(
  strapi: any,
  uid: string,
  documentId: string,
  data: Record<string, unknown>,
  { locale, fields }: PublishGuardOptions = {}
): Promise<ApplyMode> {
  const compare = compareFields(uid, data, fields)
  const query = {
    documentId,
    ...(locale ? { locale } : {}),
    fields: ["documentId", ...compare],
  }
  const published = await strapi
    .documents(uid)
    .findOne({ ...query, status: "published" })
  if (!published) throw new ApplyRefusedError("not_published", uid, documentId)

  const draft = await strapi
    .documents(uid)
    .findOne({ ...query, status: "draft" })
  const divergentKeys = draft
    ? compare.filter((k) => canonical(draft[k]) !== canonical(published[k]))
    : []

  if (divergentKeys.length > 0) {
    await strapi.documents(uid).update({
      documentId,
      ...(locale ? { locale } : {}),
      status: "draft",
      data,
    })
    strapi.log.info(
      `[content-moderation] ${uid} ${documentId}: draft differs from published on ${divergentKeys.join(", ")}; applied to the draft only`
    )

    return { mode: "draft_only", divergentKeys }
  }

  await strapi.documents(uid).update({
    documentId,
    ...(locale ? { locale } : {}),
    status: "published",
    data,
  })

  return { mode: "published" }
}
