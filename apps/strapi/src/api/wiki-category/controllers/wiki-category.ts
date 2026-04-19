import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::wiki-category.wiki-category",
  ({ strapi }) => ({
    // ── /wiki-categories/nav ──────────────────────────────────────────────────
    // Returns all categories with their articles — used to build the sidebar
    async nav(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined

      const categories = await strapi
        .documents("api::wiki-category.wiki-category")
        .findMany({
          fields: ["name", "slug", "order"],
          locale,

          populate: {
            articles: {
              fields: ["title", "slug", "priority", "articleStatus"],
            },
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sort: ["order:asc", "name:asc"] as any,
        })

      ctx.body = { data: categories, meta: {} }
    },
  })
)
