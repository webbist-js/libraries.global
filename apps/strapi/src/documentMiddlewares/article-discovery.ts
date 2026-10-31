import { articleReadingMinutes, parseArticleSources } from "@repo/shared-data"
import { errors } from "@strapi/utils"

import { queueArticleProjection } from "../lifeCycles/articlePrivacy"
import { ARTICLE_UIDS, ARTICLE_BODY_POPULATE } from "../utils/article-content"
import {
  buildArticleGeography,
  frozenArticleGeography,
  preservePublishedArticleRelations,
  captureArticleEventLibraries,
} from "../utils/article-relations"

const GEOGRAPHY_KEYS = [
  "continents",
  "countries",
  "regions",
  "areas",
  "libraries",
]
const DISCOVERY_POPULATE = {
  body: ARTICLE_BODY_POPULATE,
  continents: true,
  countries: true,
  regions: true,
  areas: true,
  libraries: true,
}

/** Fill only additive derived columns; never publish or rewrite article content. */
export async function backfillArticleDiscovery(strapi: any) {
  for (const uid of ARTICLE_UIDS) {
    const journal = uid === "api::blog-article.blog-article"
    for (;;) {
      const rows = await strapi.db.query(uid).findMany({
        where: {
          $or: [
            { geographyFacet: { $null: true } },
            { readingTimeMinutes: { $null: true } },
            ...(journal ? [{ publicationOrigin: { $null: true } }] : []),
          ],
        },
        populate: DISCOVERY_POPULATE,
        orderBy: { id: "asc" },
        limit: 100,
      })
      if (!rows.length) break
      for (const row of rows)
        await strapi.db.query(uid).update({
          where: { id: row.id },
          data: {
            ...(journal && row.publicationOrigin == null
              ? { publicationOrigin: "index" }
              : {}),
            ...(row.readingTimeMinutes == null
              ? { readingTimeMinutes: articleReadingMinutes(row.body) }
              : {}),
            ...(row.geographyFacet == null
              ? { geographyFacet: await buildArticleGeography(strapi, row) }
              : {}),
          },
        })
    }
  }
}

/** Editorial admin writes receive the same public metrics as Submissions. */
export function registerArticleDiscoveryMiddleware({
  strapi,
}: {
  strapi: any
}) {
  strapi.documents.use(async (context: any, next: () => Promise<any>) => {
    const { uid, action } = context
    if (
      !ARTICLE_UIDS.has(uid) ||
      !["create", "update", "publish"].includes(action)
    )
      return next()
    const run = async () => {
      const { params } = context
      const { data, documentId: sourceDocumentId, locale, status } = params
      if (
        uid === "api::blog-article.blog-article" &&
        data &&
        "sources" in data
      ) {
        try {
          data.sources = parseArticleSources(data.sources)
        } catch (error) {
          throw new errors.ValidationError(
            error instanceof Error ? error.message : "Invalid article sources."
          )
        }
      }
      const publishing = action === "publish" || status === "published"
      const eventLibraries = publishing
        ? await captureArticleEventLibraries(strapi, uid, params)
        : []
      const changingGeography =
        action === "update" &&
        sourceDocumentId &&
        data &&
        !("geographyFacet" in data) &&
        GEOGRAPHY_KEYS.some((key) => key in data)
      const previous = changingGeography
        ? await strapi.documents(uid).findOne({
            documentId: sourceDocumentId,
            status: "draft",
            ...(locale ? { locale: locale } : {}),
            populate: DISCOVERY_POPULATE,
          })
        : null
      if (action === "publish" && sourceDocumentId) {
        const draft = await strapi.documents(uid).findOne({
          documentId: sourceDocumentId,
          status: "draft",
          ...(locale ? { locale: locale } : {}),
          populate: {
            body: ARTICLE_BODY_POPULATE,
            ...(uid === "api::blog-article.blog-article"
              ? { sources: true }
              : {}),
            continents: true,
            countries: true,
            regions: true,
            areas: true,
            libraries: true,
          },
        })
        if (
          draft &&
          (draft.readingTimeMinutes == null || draft.geographyFacet == null)
        ) {
          await strapi.documents(uid).update({
            documentId: sourceDocumentId,
            status: "draft",
            locale: draft.locale,
            data: {
              readingTimeMinutes: articleReadingMinutes(draft.body),
              ...(draft.geographyFacet == null
                ? { geographyFacet: await buildArticleGeography(strapi, draft) }
                : {}),
            },
          })
        }
      } else if (data && "body" in data) {
        data.readingTimeMinutes = articleReadingMinutes(data.body)
      }

      const result = await next()
      const documentId = result?.documentId ?? sourceDocumentId
      const projectionIds = new Set<number>()
      if (publishing && documentId && result) {
        const repaired = await preservePublishedArticleRelations(
          strapi,
          uid,
          documentId,
          locale ?? result?.locale,
          eventLibraries
        )
        const published = await strapi.db.query(uid).findMany({
          where: { documentId, publishedAt: { $notNull: true } },
          select: ["id"],
        })
        for (const id of [
          ...repaired,
          ...published.map((row: { id: number }) => row.id),
        ])
          projectionIds.add(id)
      }
      if (changingGeography && result?.id) {
        const current = await strapi.db
          .query(uid)
          .findOne({ where: { id: result.id }, populate: DISCOVERY_POPULATE })
        if (current) {
          const geographyFacet = await frozenArticleGeography(
            strapi,
            current,
            previous
          )
          await strapi.db
            .query(uid)
            .update({ where: { id: current.id }, data: { geographyFacet } })
          result.geographyFacet = geographyFacet
        }
      }

      // Every publication refreshes discovery, even when no relation needed repair.
      // Enqueue after derived updates, in this transaction; the worker starts on commit.
      if (projectionIds.size)
        await queueArticleProjection(
          strapi,
          [...projectionIds].map((id) => ({ uid: uid, id }))
        )

      return result
    }

    // The published row and its validated cross-language links become visible atomically.
    return strapi.db.transaction(run)
  })
}
