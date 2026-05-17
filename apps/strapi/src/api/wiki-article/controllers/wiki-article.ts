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
  "api::wiki-article.wiki-article",
  ({ strapi }) => ({
    // ── /wiki-articles/detail/:slug ───────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

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

    // ── /wiki-articles/slugs ──────────────────────────────────────────────────
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

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
