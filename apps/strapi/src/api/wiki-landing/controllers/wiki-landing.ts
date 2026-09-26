import { factories } from "@strapi/strapi"

import { readStatus } from "../../../utils/read-status"

export default factories.createCoreController(
  "api::wiki-landing.wiki-landing",
  ({ strapi }) => ({
    // ── /wiki-landing ─────────────────────────────────────────────────────────
    async find(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = readStatus(ctx)

      const data = await strapi
        .documents("api::wiki-landing.wiki-landing")
        .findFirst({
          locale,
          status,
          populate: {
            quickStartCards: {
              fields: ["title", "slug", "summary"],
              populate: {
                category: { fields: ["name", "slug"] },
                section: { fields: ["name", "slug"] },
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
