import { factories } from "@strapi/strapi"

import { readStatus } from "../../../utils/read-status"

const UID = "api::legal-document.legal-document"
const NAV_FIELDS = ["title", "navLabel", "slug", "order"] as const

function readLocale(ctx: { query: Record<string, unknown> }) {
  return typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // ── /legal-documents/nav ──────────────────────────────────────────────────
  // The tab strip: every document's label and slug, in display order.
  async nav(ctx) {
    const results = await strapi.documents(UID).findMany({
      fields: [...NAV_FIELDS],
      sort: ["order:asc", "title:asc"],
      locale: readLocale(ctx),
      status: readStatus(ctx),
    })

    ctx.body = { data: results, meta: {} }
  },

  // ── /legal-documents/detail/:slug ─────────────────────────────────────────
  async detail(ctx) {
    const { slug } = ctx.params as { slug: string }

    const results = await strapi.documents(UID).findMany({
      filters: { slug: { $eq: slug } } as Record<string, unknown>,
      fields: [...NAV_FIELDS, "heroTitle", "lead", "updatedAt", "publishedAt"],
      locale: readLocale(ctx),
      status: readStatus(ctx),
      populate: {
        summaryPoints: true,
        sections: true,
        revisions: true,
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
}))
