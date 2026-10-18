import { createHash } from "node:crypto"

import type { ArticleGeography, ArticlePlace } from "@repo/shared-data"

import { ARTICLE_BODY_POPULATE, articleRevision } from "./article-content"
import { defaultLocale } from "../plugins/content-moderation/server/utils/locales"

const ARTICLE = {
  wiki_edit: "api::wiki-article.wiki-article",
  blog_submission: "api::blog-article.blog-article",
} as const
const PLACES = {
  continents: "continent",
  countries: "country",
  regions: "region",
  areas: "area",
} as const
const ID = /^[a-z0-9]{20,32}$/
const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}
const refs = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.flatMap((raw) => {
            const id = typeof raw === "string" ? raw : asObject(raw).documentId

            return typeof id === "string" && ID.test(id) ? [id] : []
          })
        ),
      ].slice(0, 20)
    : []

type RelationRow = {
  id?: number
  documentId: string
  locale?: string
  [key: string]: any
}
const RELATION_UIDS = new Set([
  "api::topic.topic",
  "api::library.library",
  "api::blog-section.blog-section",
  "api::wiki-section.wiki-section",
  ...Object.values(PLACES).map((place) => `api::${place}.${place}`),
])
const RELATION_ROWS_CAP = 1000

/** Select real public target variants: requested language, default language, then stable fallback. */
export async function articleRelationRows(
  strapi: any,
  uid: string,
  filters: Record<string, unknown>,
  locale?: string,
  options: {
    fields?: string[]
    populate?: Record<string, unknown>
    allVariants?: boolean
  } = {}
): Promise<RelationRow[]> {
  if (!RELATION_UIDS.has(uid)) throw new Error("Invalid article relation type")
  const rows = (await strapi.documents(uid).findMany({
    status: "published",
    locale: "*",
    filters,
    fields: [
      ...new Set(["id", "documentId", "locale", ...(options.fields ?? [])]),
    ],
    ...(options.populate ? { populate: options.populate } : {}),
    sort: [{ id: "asc" }],
    limit: RELATION_ROWS_CAP,
  })) as RelationRow[]
  if (rows.length >= RELATION_ROWS_CAP)
    throw new Error("Article relation lookup exceeds its supported size")
  if (options.allVariants) return rows
  const base = await defaultLocale(strapi)
  const rank = (row: RelationRow) =>
    row.locale === locale ? 0 : row.locale === base ? 1 : 2
  const selected = new Map<string, RelationRow>()
  for (const row of [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      String(a.locale ?? "").localeCompare(String(b.locale ?? "")) ||
      (a.id ?? 0) - (b.id ?? 0)
  )) {
    if (!selected.has(row.documentId)) selected.set(row.documentId, row)
  }

  return [...selected.values()]
}

/**
 * Strapi 5 forces matching locales for documentId relations between localized types.
 * Cross-language references therefore use an entity ID selected from a published CMS row;
 * client-provided entity IDs never reach this helper. Keep the locale explicit for components.
 */
export function articleRelationConnector(
  row: RelationRow,
  sourceLocale?: string
): Record<string, unknown> {
  const locale = typeof row.locale === "string" ? row.locale : undefined
  if (locale && sourceLocale && locale !== sourceLocale) {
    if (!Number.isInteger(row.id) || row.id! <= 0)
      throw new Error("Article relation has no resolved public entity")

    return { id: row.id, locale }
  }

  return { documentId: row.documentId, ...(locale ? { locale } : {}) }
}

const ARTICLE_RELATION_TYPES = {
  section: {
    blog: "api::blog-section.blog-section",
    wiki: "api::wiki-section.wiki-section",
  },
  topics: "api::topic.topic",
  libraries: "api::library.library",
  ...Object.fromEntries(
    Object.entries(PLACES).map(([key, singular]) => [
      key,
      `api::${singular}.${singular}`,
    ])
  ),
} as Record<string, string | { blog: string; wiki: string }>
const targetRows = (value: unknown): RelationRow[] =>
  (Array.isArray(value) ? value : value ? [value] : []) as RelationRow[]

type EventLibraryFallback = {
  locale: string
  citationId?: string
  eventDocumentId?: string
  index: number
  library: RelationRow
}

/** Components may be rewritten by core publication, so capture their validated public links first. */
export async function captureArticleEventLibraries(
  strapi: any,
  uid: string,
  params: Record<string, any>
): Promise<EventLibraryFallback[]> {
  if (uid !== ARTICLE.blog_submission) return []
  const locale = params.locale ?? (await defaultLocale(strapi))
  const drafts = Array.isArray(params.data?.eventMentions)
    ? [{ locale, eventMentions: params.data.eventMentions }]
    : params.documentId
      ? await strapi.db.query(uid).findMany({
          where: {
            documentId: params.documentId,
            publishedAt: { $null: true },
            ...(locale !== "*" ? { locale } : {}),
          },
          select: ["locale"],
          populate: {
            eventMentions: {
              populate: {
                library: { select: ["id", "documentId", "locale"] },
              },
            },
          },
        })
      : []
  const captured: EventLibraryFallback[] = []
  for (const draft of drafts) {
    for (const [index, mention] of (draft.eventMentions ?? []).entries()) {
      const relation = asObject(mention.library)
      const values =
        relation.connect ?? relation.set ?? targetRows(mention.library)
      const filter = relationFilter(values)
      if (!filter) continue
      const [library] = await articleRelationRows(
        strapi,
        "api::library.library",
        filter,
        draft.locale
      )
      if (!library?.locale || library.locale === draft.locale) continue
      captured.push({
        locale: draft.locale,
        citationId: mention.citationId,
        eventDocumentId: mention.eventDocumentId,
        index,
        library,
      })
    }
  }

  return captured
}

/**
 * Core publication remaps populated documentIds into the article locale and drops
 * cross-language links. Restore only the exact public target variants held by the
 * saved draft, inside the caller's publication transaction; never restore draft targets.
 */
export async function preservePublishedArticleRelations(
  strapi: any,
  uid: string,
  documentId: string,
  locale?: string,
  capturedLibraries: EventLibraryFallback[] = []
): Promise<number[]> {
  if (!Object.values(ARTICLE).includes(uid as any))
    throw new Error("Invalid article relation source")
  locale ??= await defaultLocale(strapi)
  const relationTypes = Object.fromEntries(
    Object.entries(ARTICLE_RELATION_TYPES).map(([key, target]) => [
      key,
      typeof target === "string"
        ? target
        : uid === ARTICLE.blog_submission
          ? target.blog
          : target.wiki,
    ])
  )
  const relationPopulate = Object.fromEntries(
    Object.keys(relationTypes).map((key) => [
      key,
      { select: ["id", "documentId", "locale"] },
    ])
  )
  const populate = {
    ...relationPopulate,
    ...(uid === ARTICLE.blog_submission
      ? {
          eventMentions: {
            select: ["id", "citationId", "eventDocumentId"],
            populate: { library: { select: ["id", "documentId", "locale"] } },
          },
        }
      : {}),
  }
  const published = await strapi.db.query(uid).findMany({
    where: {
      documentId,
      publishedAt: { $notNull: true },
      ...(locale && locale !== "*" ? { locale } : {}),
    },
    select: ["id", "documentId", "locale"],
    populate,
  })
  const repaired: number[] = []
  for (const article of published) {
    const draft = await strapi.db.query(uid).findOne({
      where: {
        documentId,
        locale: article.locale,
        publishedAt: { $null: true },
      },
      select: ["id", "documentId", "locale"],
      populate,
    })
    if (!draft) continue
    const data: Record<string, unknown> = {}
    for (const [key, targetUid] of Object.entries(relationTypes)) {
      const saved = targetRows(draft[key])
      if (
        !saved.some(
          (target) => target.locale && target.locale !== article.locale
        )
      )
        continue
      const available = await articleRelationRows(
        strapi,
        targetUid,
        {
          documentId: { $in: saved.map((target) => target.documentId) },
          ...(targetUid === "api::topic.topic"
            ? { status: { $eq: "approved" } }
            : {}),
        },
        undefined,
        { allVariants: true }
      )
      const targets = saved.flatMap((target) => {
        const live = available.find(
          (row) =>
            row.documentId === target.documentId && row.locale === target.locale
        )

        return live?.id ? [{ id: live.id }] : []
      })
      data[key] = { set: targets }
    }
    let changed = Object.keys(data).length > 0
    if (changed)
      await strapi.db.query(uid).update({ where: { id: article.id }, data })
    const eventLibraries = capturedLibraries.filter(
      (mention) => mention.locale === article.locale
    )
    if (!eventLibraries.length) {
      for (const [index, mention] of (draft.eventMentions ?? []).entries()) {
        if (
          mention.library?.locale &&
          mention.library.locale !== article.locale
        )
          eventLibraries.push({
            locale: article.locale,
            citationId: mention.citationId,
            eventDocumentId: mention.eventDocumentId,
            index,
            library: mention.library,
          })
      }
    }
    for (const mention of eventLibraries) {
      const [library] = await articleRelationRows(
        strapi,
        "api::library.library",
        { documentId: { $eq: mention.library.documentId } },
        mention.library.locale
      )
      // An unavailable/unpublished library remains detached while its durable citation survives.
      if (!library?.id || library.locale !== mention.library.locale) continue
      const key = mention.citationId ?? mention.eventDocumentId
      const componentIds = new Set<number>()
      for (const version of [article, draft]) {
        const counterpart = key
          ? version.eventMentions?.find(
              (row: any) => (row.citationId ?? row.eventDocumentId) === key
            )
          : version.eventMentions?.[mention.index]
        if (counterpart?.id) componentIds.add(counterpart.id)
      }
      for (const id of componentIds)
        await strapi.db.query("content.event-mention").update({
          where: { id },
          data: { library: { set: [{ id: library.id }] } },
        })
      if (componentIds.size) changed = true
    }
    if (changed) repaired.push(article.id)
  }

  return repaired
}

function relationFilter(value: unknown): Record<string, unknown> | null {
  const values = asObject(value).set ?? value
  if (!Array.isArray(values)) return null
  const documentIds = refs(values)
  const ids = values.flatMap((raw) => {
    const id = asObject(raw).id

    return Number.isInteger(id) && id > 0 ? [id] : []
  })
  const clauses = [
    ...(documentIds.length ? [{ documentId: { $in: documentIds } }] : []),
    ...(ids.length ? [{ id: { $in: ids } }] : []),
  ]

  return clauses.length ? { $or: clauses } : null
}

async function relationDocumentIds(
  strapi: any,
  uid: string,
  value: unknown
): Promise<string[]> {
  const filter = relationFilter(value)
  if (!filter) return []

  return (await articleRelationRows(strapi, uid, filter))
    .map((row) => row.documentId)
    .sort()
}

export async function submissionArticle(
  strapi: any,
  submission: any,
  locale?: string
): Promise<any | null> {
  const uid = ARTICLE[submission.submissionType as keyof typeof ARTICLE]
  if (!uid || (!submission.targetSlug && !submission.targetDocumentId))
    return null
  const query = {
    status: "published",
    fields: [
      "title",
      "summary",
      "slug",
      "locale",
      "geographyFacet",
      "updatedAt",
    ],
    populate: {
      body: ARTICLE_BODY_POPULATE,
      authorProfile: { fields: ["documentId"] },
      libraries: { fields: ["documentId"] },
      topics: { fields: ["documentId"] },
      continents: { fields: ["documentId"] },
      countries: { fields: ["documentId"] },
      regions: { fields: ["documentId"] },
      areas: { fields: ["documentId"] },
    },
  }
  if (uid === ARTICLE.wiki_edit) delete (query.populate as any).authorProfile
  const filters = submission.targetDocumentId
    ? { documentId: { $eq: submission.targetDocumentId } }
    : { slug: { $eq: submission.targetSlug } }
  const inLocale = await strapi
    .documents(uid)
    .findMany({ ...query, filters, ...(locale ? { locale } : {}), limit: 1 })
  if (inLocale[0]) return inLocale[0]
  const base = await strapi
    .documents(uid)
    .findMany({ ...query, filters, limit: 1 })

  return base[0] ?? null
}

export async function ownsJournalArticle(
  strapi: any,
  userId: string,
  target: any
): Promise<boolean> {
  const documentId =
    typeof target?.targetDocumentId === "string"
      ? target.targetDocumentId
      : null
  const slug = typeof target?.targetSlug === "string" ? target.targetSlug : null
  if (!documentId && !slug) return false
  const filters = documentId
    ? { documentId: { $eq: documentId } }
    : { slug: { $eq: slug } }
  // Provenance belongs to the logical story, including stories only published outside the default locale.
  const articles = await strapi.documents(ARTICLE.blog_submission).findMany({
    status: "published",
    locale: "*",
    fields: ["slug"],
    filters,
    populate: { authorProfile: { fields: ["documentId"] } },
    limit: 1,
  })
  const article = articles[0]

  if (!article?.authorProfile?.documentId) return false
  const owner = await strapi.db
    .query("api::user-profile.user-profile")
    .findOne({
      where: { documentId: article.authorProfile.documentId, baUserId: userId },
      select: ["id"],
    })

  return !!owner
}

/** Pin new edits once; saving cannot silently rebase a stale revision. */
export async function pinArticleBase(
  strapi: any,
  submission: any
): Promise<any> {
  const draftData = asObject(submission.draftData)
  if (
    draftData.kind === "new_article" ||
    draftData.baseRevision ||
    !ARTICLE[submission.submissionType as keyof typeof ARTICLE]
  )
    return submission
  const article = await submissionArticle(
    strapi,
    submission,
    submission.contentLocale ?? draftData.locale
  )

  return article
    ? {
        ...submission,
        draftData: {
          ...draftData,
          baseRevision: articleRevision(article),
          sourceLocale: draftData.sourceLocale ?? article.locale,
        },
      }
    : submission
}

export function articleImageIds(body: unknown): number[] {
  if (!Array.isArray(body)) return []

  return body.flatMap((raw) => {
    const b = asObject(raw)
    const id = typeof b.image === "number" ? b.image : asObject(b.image).id

    return b.__component === "content.image-block" &&
      Number.isInteger(id) &&
      id > 0
      ? [id]
      : []
  })
}

export async function articleDraftMedia(
  strapi: any,
  submission: any
): Promise<any> {
  if (
    !submission ||
    !ARTICLE[submission.submissionType as keyof typeof ARTICLE]
  )
    return submission
  const draft = asObject(submission.draftData)
  const ids = articleImageIds(draft.body ?? draft.proposedBody)
  if (!ids.length) return submission
  const article = await submissionArticle(
    strapi,
    submission,
    submission.contentLocale
  )
  const existing = new Set(articleImageIds(article?.body))
  const owned = await strapi
    .documents("plugin::content-moderation.submission-upload")
    .findMany({
      filters: {
        baUserId: { $eq: submission.submittedByUserId },
        fileId: { $in: ids },
      },
      fields: ["fileId"],
      limit: ids.length,
    })
  const allowed = ids.filter(
    (id) => existing.has(id) || owned.some((row: any) => row.fileId === id)
  )
  const media = allowed.length
    ? await strapi.documents("plugin::upload.file").findMany({
        filters: { id: { $in: allowed } },
        fields: ["id", "url", "alternativeText"],
        limit: allowed.length,
      })
    : []

  return {
    ...submission,
    draftData: {
      ...draft,
      editorMedia: media.map(({ id, url, alternativeText }: any) => ({
        id,
        url,
        alternativeText,
      })),
    },
  }
}

function publicPlace(raw: unknown): ArticlePlace | null {
  const p = asObject(raw)

  return typeof p.documentId === "string"
    ? {
        documentId: p.documentId,
        ...(typeof p.slug === "string" ? { slug: p.slug } : {}),
        ...(typeof p.name === "string" ? { name: p.name } : {}),
        ...(typeof p.iso2 === "string" ? { iso2: p.iso2 } : {}),
        ...(typeof (
          p.continent?.documentId ??
          p.country?.continent?.documentId ??
          p.region?.country?.continent?.documentId
        ) === "string"
          ? {
              continentDocumentId:
                p.continent?.documentId ??
                p.country?.continent?.documentId ??
                p.region?.country?.continent?.documentId,
            }
          : {}),
        ...(typeof (p.country?.documentId ?? p.region?.country?.documentId) ===
        "string"
          ? {
              countryDocumentId:
                p.country?.documentId ?? p.region?.country?.documentId,
            }
          : {}),
        ...(typeof p.region?.documentId === "string"
          ? { regionDocumentId: p.region.documentId }
          : {}),
      }
    : null
}

/** Frozen discovery context: all values originate in published CMS relations. */
export async function buildArticleGeography(
  strapi: any,
  data: Record<string, any>
): Promise<ArticleGeography> {
  const result: ArticleGeography = {
    continents: [],
    countries: [],
    regions: [],
    areas: [],
  }
  const add = (level: keyof ArticleGeography, value: unknown) => {
    const p = publicPlace(value)
    if (p && !result[level].some((other) => other.documentId === p.documentId))
      result[level].push(p)
  }
  const common = { fields: ["name", "slug"], status: "published" }
  for (const [plural, singular] of Object.entries(PLACES)) {
    const filters = relationFilter(data[plural])
    if (!filters) continue
    const rows = await strapi
      .documents(`api::${singular}.${singular}`)
      .findMany({
        ...common,
        locale: "*",
        ...(singular == "country" ? { fields: ["name", "slug", "iso2"] } : {}),
        filters,
        populate: {
          ...(singular === "country" || singular === "region"
            ? { continent: { fields: ["name", "slug"] } }
            : {}),
          ...(singular === "region" || singular === "area"
            ? {
                country: {
                  fields: ["name", "slug", "iso2"],
                  populate: { continent: { fields: ["name", "slug"] } },
                },
              }
            : {}),
          ...(singular === "area"
            ? {
                region: {
                  fields: ["name", "slug"],
                  populate: {
                    country: {
                      fields: ["name", "slug", "iso2"],
                      populate: { continent: { fields: ["name", "slug"] } },
                    },
                  },
                },
              }
            : {}),
        },
        limit: RELATION_ROWS_CAP,
      })
    for (const row of rows) {
      add(plural as keyof ArticleGeography, row)
      add("regions", row.region)
      add("countries", row.country ?? row.region?.country)
      add(
        "continents",
        row.continent ??
          row.country?.continent ??
          row.region?.country?.continent
      )
    }
  }
  const libraries = relationFilter(data.libraries)
  if (libraries) {
    const rows = await strapi.documents("api::library.library").findMany({
      ...common,
      locale: "*",
      filters: libraries,
      populate: {
        continent: { fields: ["name", "slug"] },
        country: { fields: ["name", "slug", "iso2"] },
        region: { fields: ["name", "slug"] },
        area: { fields: ["name", "slug"] },
      },
      limit: RELATION_ROWS_CAP,
    })
    for (const row of rows)
      for (const [plural, singular] of Object.entries(PLACES))
        add(plural as keyof ArticleGeography, row[singular])
  }

  return result
}

export async function frozenArticleGeography(
  strapi: any,
  data: Record<string, any>,
  current: any
): Promise<ArticleGeography> {
  const keys = ["continents", "countries", "regions", "areas", "libraries"]
  if (current?.geographyFacet) {
    const unchanged = await Promise.all(
      keys.map(async (key) => {
        if (!(key in data)) return true
        const singular =
          key === "libraries" ? "library" : PLACES[key as keyof typeof PLACES]
        const next = await relationDocumentIds(
          strapi,
          `api::${singular}.${singular}`,
          data[key]
        )

        return (
          JSON.stringify(next) === JSON.stringify(refs(current[key]).sort())
        )
      })
    )
    if (unchanged.every(Boolean)) return current.geographyFacet
  }

  return buildArticleGeography(strapi, {
    ...Object.fromEntries(keys.map((key) => [key, current?.[key] ?? []])),
    ...data,
  })
}

export async function articlePlaceRelations(
  strapi: any,
  tags: any[],
  locale?: string
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}
  for (const [plural, singular] of Object.entries(PLACES)) {
    const ids = refs(tags.filter((tag) => tag.kind === singular))
    const rows = ids.length
      ? await articleRelationRows(
          strapi,
          `api::${singular}.${singular}`,
          { documentId: { $in: ids } },
          locale
        )
      : []
    if (rows.length !== ids.length)
      throw new Error("An article place is unavailable")
    data[plural] = {
      set: rows.map((row) => articleRelationConnector(row, locale)),
    }
  }

  return data
}

export async function publicEventMentions(
  strapi: any,
  input: unknown,
  locale?: string
): Promise<Record<string, unknown>[]> {
  if (!Array.isArray(input)) return []
  if (input.length > 10)
    throw new Error("At most ten Event mentions are allowed")
  const out: Record<string, unknown>[] = []
  for (const raw of input) {
    const mention = asObject(raw)
    const eventId = ID.test(String(mention.eventDocumentId ?? ""))
      ? mention.eventDocumentId
      : null
    const event = eventId
      ? await strapi.documents("plugin::events.event").findOne({
          documentId: eventId,
          status: "published",
          fields: [
            "title",
            "startTime",
            "endTime",
            "timezone",
            "url",
            "pendingReview",
          ],
          populate: { library: { fields: ["documentId"] } },
        })
      : null
    if (event?.pendingReview) throw new Error("The Event is unavailable")
    const title = String(event?.title ?? mention.title ?? "")
      .trim()
      .slice(0, 200)
    if (!title) throw new Error("Event mentions need a title")
    const url = String(event?.url ?? mention.url ?? "").trim()
    if (url) {
      const parsed = new URL(url)
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error("Invalid Event citation URL")
    }
    const libraryId = event?.library?.documentId ?? mention.libraryDocumentId
    const library = ID.test(String(libraryId ?? ""))
      ? (
          await articleRelationRows(
            strapi,
            "api::library.library",
            { documentId: { $eq: libraryId } },
            locale
          )
        )[0]
      : null
    const clean: Record<string, unknown> = {
      title,
      citationId:
        typeof mention.citationId === "string" &&
        /^[a-z0-9-]{12,80}$/.test(mention.citationId)
          ? mention.citationId
          : createHash("sha256")
              .update(
                JSON.stringify([
                  eventId,
                  title,
                  url,
                  libraryId ?? null,
                  mention.startTime ?? event?.startTime ?? null,
                ])
              )
              .digest("hex")
              .slice(0, 24),
      ...(url ? { url: url.slice(0, 2048) } : {}),
      ...(library
        ? { library: { connect: [articleRelationConnector(library, locale)] } }
        : {}),
      ...(event
        ? {
            event: { connect: [{ documentId: event.documentId }] },
            eventDocumentId: event.documentId,
          }
        : eventId
          ? { eventDocumentId: eventId }
          : {}),
    }
    for (const key of ["startTime", "endTime"] as const) {
      const value = event?.[key] ?? mention[key]
      if (value) {
        const date = new Date(value)
        if (!Number.isFinite(date.getTime()))
          throw new Error("Invalid Event date")
        clean[key] = date.toISOString()
      }
    }
    if (mention.timezone || event?.timezone) {
      const zone = String(event?.timezone ?? mention.timezone)
      new Intl.DateTimeFormat("en", { timeZone: zone }).format()
      clean.timezone = zone
    }
    out.push(clean)
  }

  return out
}
