import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::wiki-landing.wiki-landing",
  ({ strapi }) => ({
    // ── /wiki-landing ─────────────────────────────────────────────────────────
    async find(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const data = await strapi
        .documents("api::wiki-landing.wiki-landing")
        .findFirst({
          locale,
          status,
          populate: {
            featuredArticle: {
              populate: {
                heroImage: true,
                category: { fields: ["name", "slug"] },
              },
            },
            featuredCategories: {
              fields: ["name", "slug", "description"],
            },
            stats: true,
            sections: {
              on: {
                "sections.editorial-block": { populate: { image: true } },
                "sections.cta-banner": true,
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

      ctx.body = { data: data ?? null, meta: {} }
    },
  })
)
