import { factories } from "@strapi/strapi"

import { readLocale } from "../../../utils/read-status"

export default factories.createCoreController(
  "api::wiki-section.wiki-section",
  ({ strapi }) => ({
    // ── /wiki-sections/nav ─────────────────────────────────────────────────────
    // Returns all sections with their articles
    async nav(ctx) {
      const sections = (await strapi
        .documents("api::wiki-section.wiki-section")
        .findMany({
          locale: readLocale(ctx),
          fields: ["name", "label", "slug", "description", "order", "icon"],
          status: "published",
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
        icon?: string | null
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
          icon: section.icon ?? null,
          articles: section.articles ?? [],
        }
      })

      ctx.body = { data: result, meta: {} }
    },
  })
)
