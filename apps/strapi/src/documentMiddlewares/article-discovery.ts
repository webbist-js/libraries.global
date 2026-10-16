import { articleReadingMinutes } from "@repo/shared-data"

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
    if (
      !ARTICLE_UIDS.has(context.uid) ||
      !["create", "update", "publish"].includes(context.action)
    )
      return next()
    const run = async () => {
      const { params } = context
      const publishing =
        context.action === "publish" || params.status === "published"
      const eventLibraries = publishing
        ? await captureArticleEventLibraries(strapi, context.uid, params)
        : []
      const changingGeography =
        context.action === "update" &&
        params.documentId &&
        params.data &&
        !("geographyFacet" in params.data) &&
        GEOGRAPHY_KEYS.some((key) => key in params.data)
      const previous = changingGeography
        ? await strapi.documents(context.uid).findOne({
            documentId: params.documentId,
            status: "draft",
            ...(params.locale ? { locale: params.locale } : {}),
            populate: DISCOVERY_POPULATE,
          })
        : null
      if (context.action === "publish" && params.documentId) {
        const draft = await strapi.documents(context.uid).findOne({
          documentId: params.documentId,
          status: "draft",
          ...(params.locale ? { locale: params.locale } : {}),
          populate: {
            body: ARTICLE_BODY_POPULATE,
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
          await strapi.documents(context.uid).update({
            documentId: params.documentId,
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
      } else if (params.data && "body" in params.data) {
        params.data.readingTimeMinutes = articleReadingMinutes(params.data.body)
      }

      const result = await next()
      const documentId = result?.documentId ?? params.documentId
      if (publishing && documentId) {
        const repaired = await preservePublishedArticleRelations(
          strapi,
          context.uid,
          documentId,
          params.locale ?? result?.locale,
          eventLibraries
        )
        if (repaired.length)
          await queueArticleProjection(
            strapi,
            repaired.map((id) => ({ uid: context.uid, id }))
          )
      }
      if (changingGeography && result?.id) {
        const current = await strapi.db
          .query(context.uid)
          .findOne({ where: { id: result.id }, populate: DISCOVERY_POPULATE })
        if (current) {
          const geographyFacet = await frozenArticleGeography(
            strapi,
            current,
            previous
          )
          await strapi.db
            .query(context.uid)
            .update({ where: { id: current.id }, data: { geographyFacet } })
          result.geographyFacet = geographyFacet
        }
      }

      return result
    }

    // The published row and its validated cross-language links become visible atomically.
    return strapi.db.transaction(run)
  })
}
