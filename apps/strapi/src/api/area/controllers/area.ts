import { factories } from "@strapi/strapi"

import { readStatus } from "../../../utils/read-status"

export default factories.createCoreController(
  "api::area.area",
  ({ strapi }) => ({
    // ── /areas/detail/:slug ───────────────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = readStatus(ctx)

      const results = await strapi.documents("api::area.area").findMany({
        filters: { slug: { $eq: slug } } as never,
        fields: ["name", "slug", "shortName", "typeLabel", "summary"],
        populate: {
          mapConfig: true,
          region: {
            fields: ["name", "slug", "typeLabel"],
            populate: {
              country: {
                fields: ["name", "slug", "regionTypeLabel"],
                populate: {
                  continent: { fields: ["name", "slug", "code"] },
                },
              },
            },
          },
          country: { fields: ["name", "slug"] },
          libraries: {
            fields: [
              "name",
              "slug",
              "summary",
              "libraryType",
              "operationalStatus",
            ],
            populate: { heroImage: true },
          },
        } as never,
        locale,
        status,
      })

      const area = results[0] ?? null

      let libraryCount = 0
      if (area?.id) {
        try {
          libraryCount = await strapi.db.query("api::library.library").count({
            where: {
              area: { id: { $eq: area.id } },
              ...(status === "published"
                ? { publishedAt: { $notNull: true } }
                : {}),
            },
          })
        } catch {
          // non-critical
        }
      }

      ctx.body = {
        data: area ? { ...area, libraryCount } : null,
        meta: {},
      }
    },

    // ── /areas/slugs ──────────────────────────────────────────────────────────
    async slugs(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = readStatus(ctx)

      const results = await strapi.documents("api::area.area").findMany({
        fields: ["slug", "locale"],
        populate: {
          region: { fields: ["slug"] },
          country: { fields: ["slug"] },
        } as never,
        locale,
        status,
      })

      ctx.body = { data: results, meta: {} }
    },

    // ── /areas/map-pins ───────────────────────────────────────────────────────
    // Returns area centroids/boundaries for interactive map rendering.
    // Accepts: regionSlug
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = readStatus(ctx)

      const filters: Record<string, unknown> = {}
      if (q.regionSlug) filters.region = { slug: { $eq: q.regionSlug } }

      const results = await strapi.documents("api::area.area").findMany({
        filters: filters as never,
        fields: ["name", "slug", "boundaryUrl"],
        populate: {
          mapConfig: true,
          region: { fields: ["slug"] },
          country: { fields: ["slug"] },
        } as never,
        locale,
        status,
      })

      type AreaWithMap = {
        documentId: string
        name?: string
        slug?: string
        boundaryUrl?: string | null
        mapConfig?: {
          centerLat?: number | null
          centerLng?: number | null
          boundingBoxNE?: string | null
          boundingBoxSW?: string | null
        } | null
        region?: { slug?: string } | null
        country?: { slug?: string } | null
      }

      const pins = (results as unknown as AreaWithMap[])
        .filter(
          (a) =>
            a.boundaryUrl || (a.mapConfig?.centerLat && a.mapConfig?.centerLng)
        )
        .map((a) => ({
          documentId: a.documentId,
          name: a.name,
          slug: a.slug,
          lat: a.mapConfig?.centerLat ?? null,
          lng: a.mapConfig?.centerLng ?? null,
          boundingBoxNE: a.mapConfig?.boundingBoxNE ?? null,
          boundingBoxSW: a.mapConfig?.boundingBoxSW ?? null,
          boundaryUrl: a.boundaryUrl ?? null,
          region: a.region ?? null,
          country: a.country ?? null,
        }))

      ctx.body = { data: pins, meta: { total: pins.length } }
    },
  })
)
