import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::wiki-section.wiki-section",
  ({ strapi }) => ({
    // ── /wiki-sections/nav ─────────────────────────────────────────────────────
    // Returns all sections with their articles
    async nav(ctx) {
      const sections = (await strapi
        .documents("api::wiki-section.wiki-section")
        .findMany({
          fields: ["name", "label", "slug", "description", "order"],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sort: ["order:asc", "name:asc"] as any,
          populate: {
            articles: {
              fields: [
                "id",
                "documentId",
                "title",
                "slug",
                "priority",
                "articleStatus",
              ],
              populate: {
                category: {
                  fields: ["name", "slug"],
                },
              },
            },
          } as any,
        })) as unknown as {
        documentId: string
        name: string
        label?: string | null
        slug: string
        description?: string | null
        order?: number | null
        articles: {
          id: number
          documentId: string
          title?: string | null
          slug?: string | null
          priority?: number | null
          articleStatus?: string | null
          category?: { name: string; slug: string } | null
        }[]
      }[]

      const result = sections.map((section) => {
        return {
          documentId: section.documentId,
          name: section.name,
          label: section.label ?? null,
          slug: section.slug,
          description: section.description ?? null,
          order: section.order ?? null,
          articles: section.articles ?? [],
        }
      })

      ctx.body = { data: result, meta: {} }
    },
  })
)
