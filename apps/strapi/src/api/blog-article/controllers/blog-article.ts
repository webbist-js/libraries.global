import { factories } from "@strapi/strapi"

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
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const results = await strapi
        .documents("api::blog-article.blog-article")
        .findMany({
          filters: { slug: { $eq: slug } } as Record<string, unknown>,
          locale,
          status,
          populate: {
            heroImage: true,
            authorAvatar: true,
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sort: ["publishedAt:desc"] as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pagination: { pageSize: 3 } as any,
          })
        ;(article as Record<string, unknown>).relatedArticles = fallback
      }

      ctx.body = { data: article, meta: {} }
    },

    // ── /blog-articles/slugs ──────────────────────────────────────────────────
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

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
