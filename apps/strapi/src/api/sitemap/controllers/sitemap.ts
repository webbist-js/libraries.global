import type { Core } from "@strapi/strapi"

import {
  isSitemapSource,
  SITEMAP_BATCH_SIZE,
  sitemapCount,
  sitemapRows,
} from "../../../utils/sitemap-source"

type Context = {
  params: { source: string }
  query: Record<string, unknown>
  body: unknown
  badRequest: (message: string) => unknown
  notFound: () => unknown
}

function integer(value: unknown, fallback: number, min: number) {
  if (value === undefined) return fallback
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null
  const n = Number(value)

  return Number.isSafeInteger(n) && n >= min ? n : null
}

/** Always published; query parameters cannot opt into preview or private data. */
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async pages(ctx: Context) {
    const locale = ctx.query.locale ?? "en"
    if (typeof locale !== "string")
      return ctx.badRequest("locale must be a string")
    const paths = [
      ["", "api::homepage.homepage"],
      ["journal", "api::blog-landing.blog-landing"],
    ] as const
    const visibility = await Promise.all(
      paths.map(async ([path, uid]) => {
        const row = await strapi.documents(uid).findFirst({
          locale,
          status: "published",
          fields: ["documentId"],
          populate: { seo: { fields: ["metaRobots"] } },
        } as never)
        const seo = (row as unknown as { seo?: { metaRobots?: string } } | null)
          ?.seo
        const directives = seo?.metaRobots?.toLowerCase().split(/[\s,]+/) ?? []

        return [
          path,
          !directives.includes("noindex") && !directives.includes("none"),
        ]
      })
    )
    ctx.body = { data: Object.fromEntries(visibility) }
  },

  async count(ctx: Context) {
    const { source } = ctx.params
    if (!isSitemapSource(source)) return ctx.notFound()
    const locale = ctx.query.locale ?? "en"
    if (typeof locale !== "string")
      return ctx.badRequest("locale must be a string")
    ctx.body = { count: await sitemapCount(strapi, source, locale) }
  },

  async rows(ctx: Context) {
    const { source } = ctx.params
    if (!isSitemapSource(source)) return ctx.notFound()
    const locale = ctx.query.locale ?? "en"
    const after = integer(ctx.query.after, 0, 0)
    const start = integer(ctx.query.start, 0, 0)
    const limit = integer(ctx.query.limit, SITEMAP_BATCH_SIZE, 1)
    if (
      typeof locale !== "string" ||
      after === null ||
      start === null ||
      limit === null
    )
      return ctx.badRequest("Invalid sitemap window")
    const take = Math.min(limit, SITEMAP_BATCH_SIZE)
    const data = await sitemapRows(strapi, source, locale, {
      after,
      start,
      limit: take,
    })
    const last = data.at(-1)?.id
    ctx.body = {
      data,
      meta: {
        next: data.length === take && typeof last === "number" ? last : null,
      },
    }
  },
})
