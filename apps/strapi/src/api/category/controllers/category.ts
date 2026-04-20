import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::category.category",
  ({ strapi }) => ({
    // ── /categories/nav ────────────────────────────────────────────────────────
    // Returns all categories with their wiki articles — used to build the sidebar
    async nav(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined

      const categories = await strapi
        .documents("api::category.category")
        .findMany({
          fields: ["name", "slug", "order"],
          locale,
          populate: {
            wikiArticles: {
              fields: ["title", "slug", "priority", "articleStatus"],
            },
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sort: ["order:asc", "name:asc"] as any,
        })

      // Normalize: expose wiki articles under the "articles" key for sidebar compat
      const result = categories.map((cat) => ({
        documentId: cat.documentId,
        name: cat.name,
        slug: cat.slug,
        order: cat.order,
        articles: (cat as any).wikiArticles ?? [],
      }))

      ctx.body = { data: result, meta: {} }
    },
  })
)
