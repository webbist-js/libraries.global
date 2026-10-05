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

/**
 * `not_published`: the record has no published version. `no_hierarchy`: a
 * `new_library` approved with `publish` lacks its continent, country or
 * region, so it can't get a real entityRef (see services/submission).
 */
export type ApplyRefusedReason = "not_published" | "no_hierarchy"

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
  "verifiedSections",
])

/** A stable text form for comparing values: null, undefined and "" agree. */
export function canonical(v: unknown): string {
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

export type ApplyToLocaleOptions = {
  locale: string
  defaultLocale: string
  fields?: readonly string[]
}

/**
 * `applyToPublished` for one locale version of a record.
 *
 * The default locale, and a locale version that already exists, go through
 * the publish guard as usual. A locale with no version yet is created,
 * published, from `data`, but only when the default-locale version is
 * published: a translation never goes live for a record nobody has
 * released (`ApplyRefusedError("not_published")` otherwise).
 */
export async function applyToLocale(
  strapi: any,
  uid: string,
  documentId: string,
  data: Record<string, unknown>,
  { locale, defaultLocale, fields }: ApplyToLocaleOptions
): Promise<ApplyMode | { mode: "created_locale" }> {
  if (locale === defaultLocale)
    return applyToPublished(strapi, uid, documentId, data, { locale, fields })

  const existing = await strapi.documents(uid).findOne({
    documentId,
    locale,
    status: "published",
    fields: ["documentId", "locale"],
  })
  if (existing && (existing.locale === undefined || existing.locale === locale))
    return applyToPublished(strapi, uid, documentId, data, { locale, fields })

  const draftExists = await strapi.documents(uid).findOne({
    documentId,
    locale,
    status: "draft",
    fields: ["documentId", "locale"],
  })
  if (
    draftExists &&
    (draftExists.locale === undefined || draftExists.locale === locale)
  )
    // An unpublished translation: someone is working on it in the admin.
    // The guard refuses it like any unpublished record.
    return applyToPublished(strapi, uid, documentId, data, { locale, fields })

  const seeded = requiredLocalizedScalars(strapi, uid).filter(
    (k) => !(k in data)
  )
  const base = await strapi.documents(uid).findOne({
    documentId,
    locale: defaultLocale,
    status: "published",
    fields: ["documentId", ...seeded],
  })
  if (!base) throw new ApplyRefusedError("not_published", uid, documentId)

  // A new locale version must still satisfy the schema: required localized
  // fields the change doesn't carry (a library's name) start as the default
  // locale's, for a translator to replace.
  const seed: Record<string, unknown> = {}
  for (const k of seeded) if (base[k] != null) seed[k] = base[k]

  await strapi.documents(uid).update({
    documentId,
    locale,
    status: "published",
    data: { ...seed, ...data },
  })
  strapi.log.info(
    `[content-moderation] ${uid} ${documentId}: created the ${locale} version`
  )

  return { mode: "created_locale" }
}

/** Required, localized scalar attributes of `uid` (from its schema). */
function requiredLocalizedScalars(strapi: any, uid: string): string[] {
  const attributes: Record<string, any> =
    strapi?.contentType?.(uid)?.attributes ?? {}

  return Object.entries(attributes).flatMap(([k, a]) =>
    a?.required &&
    ["string", "text"].includes(a?.type) &&
    a?.pluginOptions?.i18n?.localized === true
      ? [k]
      : []
  )
}
