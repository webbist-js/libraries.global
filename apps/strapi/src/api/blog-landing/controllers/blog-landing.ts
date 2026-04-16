import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::blog-landing.blog-landing",
  ({ strapi }) => ({
    // ── /blog-landing ─────────────────────────────────────────────────────────
    // Override find to always return a fully populated landing page
    async find(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const data = await strapi
        .documents("api::blog-landing.blog-landing")
        .findFirst({
          locale,
          status,
          populate: {
            featuredArticle: { populate: { heroImage: true } },
            sections: {
              on: {
                "sections.editorial-block": { populate: { image: true } },
                "sections.cta-banner": true,
                "sections.quick-links": { populate: { links: true } },
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
