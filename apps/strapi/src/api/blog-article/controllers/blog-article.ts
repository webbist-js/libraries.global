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
            body: BODY_POPULATE,
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

    // ── /blog-articles/slugs ──────────────────────────────────────────────────
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const results = await strapi
        .documents("api::blog-article.blog-article")
        .findMany({
          fields: ["slug", "locale"],
          locale,
          status,
        })

      ctx.body = { data: results, meta: {} }
    },
  })
)
