import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::area.area",
  ({ strapi }) => ({
    // ── /areas/map-pins ───────────────────────────────────────────────────────
    // Returns area centroids/boundaries for interactive map rendering.
    // Accepts: regionSlug
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = q.status === "draft" ? "draft" : "published"

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
