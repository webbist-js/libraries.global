import { factories } from "@strapi/strapi"

import { readLocale, readStatus } from "../../../utils/read-status"

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
  "api::blog-article.blog-article",
  ({ strapi }) => ({
    // ── /blog-articles/detail/:slug ───────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale = readLocale(ctx)
      const status = readStatus(ctx)

      const results = await strapi
        .documents("api::blog-article.blog-article")
        .findMany({
          filters: { slug: { $eq: slug } } as Record<string, unknown>,
          locale,
          status,
          populate: {
            heroImage: true,
            authorAvatar: true,
            // Public profile fields only: the Document Service doesn't strip
            // private attributes, so name them.
            authorProfile: {
              fields: [
                "username",
                "firstName",
                "lastName",
                "profileVisibility",
              ],
              populate: { avatar: true },
            } as Record<string, unknown>,
            section: { fields: ["name", "slug"] },
            category: { fields: ["name", "slug"] },
            relatedArticles: {
              fields: [
                "title",
                "slug",
                "summary",
                "author",
                "authorTitle",
                "publishedAt",
              ],
              populate: {
                heroImage: true,
                authorAvatar: true,
                category: { fields: ["name", "slug"] },
              },
            } as Record<string, unknown>,
            body: BODY_POPULATE,
            seo: {
              populate: {
                metaImage: true,
                openGraph: { populate: { ogImage: true } },
              },
            },
          },
        })

      const article = results[0] ?? null

      // A private profile isn't linked from a byline; the text author stays.
      const authorProfile = (article as Record<string, unknown> | null)
        ?.authorProfile as { profileVisibility?: string } | null | undefined
      if (authorProfile) {
        if (authorProfile.profileVisibility === "private") {
          ;(article as Record<string, unknown>).authorProfile = null
        } else {
          delete authorProfile.profileVisibility
        }
      }

      // If no curated related articles, fall back to 3 recent posts
      if (
        article &&
        (!article.relatedArticles ||
          (article.relatedArticles as unknown[]).length === 0)
      ) {
        const fallback = await strapi
          .documents("api::blog-article.blog-article")
          .findMany({
            filters: { slug: { $ne: slug } } as Record<string, unknown>,
            fields: [
              "title",
              "slug",
              "summary",
              "author",
              "authorTitle",
              "publishedAt",
            ],
            populate: {
              heroImage: true,
              authorAvatar: true,
              section: { fields: ["name", "slug"] },
              category: { fields: ["name", "slug"] },
            } as Record<string, unknown>,
            status: "published",
            // `id` breaks ties so the three are stable across pages.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sort: ["publishedAt:desc", "id:asc"] as any,
            limit: 3,
          })
        ;(article as Record<string, unknown>).relatedArticles = fallback
      }

      ctx.body = { data: article, meta: {} }
    },

    // ── /blog-articles/slugs ──────────────────────────────────────────────────
    async slugs(ctx) {
      const locale = readLocale(ctx)
      const status = readStatus(ctx)

      const results = await strapi
        .documents("api::blog-article.blog-article")
        .findMany({
          fields: ["slug", "locale"],
          populate: { section: { fields: ["slug"] } },
          locale,
          status,
        })

      ctx.body = { data: results, meta: {} }
    },
  })
)
