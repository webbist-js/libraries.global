import { factories } from "@strapi/strapi"

import { isActivityPublic } from "../../../utils/activity-visibility"
import { readStatus } from "../../../utils/read-status"

const BODY_POPULATE = {
  on: {
    "content.rich-text": true,
    "content.image-block": { populate: { image: true } },
    "content.code-block": true,
    "content.quote-block": true,
    "content.callout": true,
  },
}

export default factories.createCoreController(
  "api::wiki-article.wiki-article",
  ({ strapi }) => ({
    // ── /wiki-articles/detail/:slug ───────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = readStatus(ctx)

      const results = await strapi
        .documents("api::wiki-article.wiki-article")
        .findMany({
          filters: { slug: { $eq: slug } } as Record<string, unknown>,
          fields: [
            "title",
            "slug",
            "summary",
            "author",
            "featured",
            "priority",
            "publishedAt",
            "updatedAt",
            "articleStatus",
          ],
          locale,
          status,
          populate: {
            heroImage: true,
            section: { fields: ["name", "slug"] },
            category: { fields: ["name", "slug"] },
            body: BODY_POPULATE,
            contributors: {
              fields: ["username", "documentId"],
              populate: { avatar: { fields: ["url"] } },
            },
            relatedArticles: {
              fields: ["title", "slug", "summary"],
              populate: {
                heroImage: true,
                section: { fields: ["name", "slug"] },
                category: { fields: ["name", "slug"] },
              },
            },
            seo: {
              populate: {
                metaImage: true,
                openGraph: { populate: { ogImage: true } },
              },
            },
          },
        })

      ctx.body = { data: results[0] ?? null, meta: {} }
    },

    // ── /wiki-articles/top-contributors ──────────────────────────────────────
    async topContributors(ctx) {
      const now = new Date()
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString()

      const submissions = await strapi
        .documents("plugin::content-moderation.submission")
        .findMany({
          filters: {
            submissionType: { $eq: "wiki_edit" },
            status: { $eq: "approved" },
            reviewedAt: { $gte: monthStart },
          } as Record<string, unknown>,
          fields: ["submittedByUserId"],
        })

      const countMap = new Map<string, number>()
      for (const s of submissions) {
        const uid = (s as Record<string, unknown>).submittedByUserId as
          | string
          | undefined
        if (uid) countMap.set(uid, (countMap.get(uid) ?? 0) + 1)
      }

      const topUserIds = [...countMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id)

      if (topUserIds.length === 0) {
        ctx.body = { data: [], meta: {} }

        return
      }

      const profiles = await strapi
        .documents("api::user-profile.user-profile")
        .findMany({
          filters: {
            baUserId: { $in: topUserIds },
          } as Record<string, unknown>,
          fields: [
            "documentId",
            "username",
            "baUserId",
            "profileVisibility",
            "publicPrefs",
          ],
          populate: { avatar: { fields: ["url"] } },
        })

      const sorted = topUserIds
        .map((uid) =>
          profiles.find((p) => (p as Record<string, unknown>).baUserId === uid)
        )
        // eslint-disable-next-line unicorn/prefer-native-coercion-functions -- type predicate narrows away `undefined`
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        // A private profile, or one with publicPrefs.showActivity === false,
        // is excluded from the public contributors listing entirely.
        .filter((p) => isActivityPublic(p as Record<string, unknown>))
        // baUserId/profileVisibility/publicPrefs are only used above to sort
        // and gate by visibility; they're never returned to the client.
        .map(
          ({
            baUserId: _baUserId,
            profileVisibility: _profileVisibility,
            publicPrefs: _publicPrefs,
            ...rest
          }) => rest
        )

      ctx.body = { data: sorted, meta: {} }
    },

    // ── /wiki-articles/slugs ──────────────────────────────────────────────────
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = readStatus(ctx)

      const results = await strapi
        .documents("api::wiki-article.wiki-article")
        .findMany({
          fields: ["slug", "locale"],
          populate: {
            category: { fields: ["slug"] },
            section: { fields: ["slug"] },
          },
          locale,
          status,
        })

      ctx.body = { data: results, meta: {} }
    },
  })
)
