import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::library.library",
  ({ strapi }) => ({
    /**
     * GET /libraries/map-pins
     * Returns libraries with location data for map rendering.
     * Accepts one of: regionSlug, countrySlug, continentSlug
     */
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = q.status === "draft" ? "draft" : "published"

      const filters: Record<string, unknown> = {}
      if (q.areaSlug) {
        filters.area = { slug: { $eq: q.areaSlug } }
      } else if (q.regionSlug) {
        filters.region = { slug: { $eq: q.regionSlug } }
      } else if (q.countrySlug) {
        filters.country = { slug: { $eq: q.countrySlug } }
      } else if (q.continentSlug) {
        filters.continent = { slug: { $eq: q.continentSlug } }
      }

      // Optional type / status filters (comma-separated values)
      if (q.libraryTypes) {
        const types = q.libraryTypes.split(",").filter(Boolean)
        if (types.length > 0) filters.libraryType = { $in: types }
      }
      if (q.operationalStatuses) {
        const statuses = q.operationalStatuses.split(",").filter(Boolean)
        if (statuses.length > 0) filters.operationalStatus = { $in: statuses }
      }

      const results = await strapi.documents("api::library.library").findMany({
        filters: filters as never,
        fields: [
          "name",
          "slug",
          "libraryType",
          "operationalStatus",
          "city",
          "location",
          "summary",
        ],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
          heroImage: { fields: ["url"] },
        } as never,
        locale,
        status,
        pagination: { pageSize: 500, page: 1 },
      })

      // Only return entries that have valid { lat, lng } location data
      const pins = results.filter((lib: unknown) => {
        const l = lib as { location?: unknown }
        if (
          !l.location ||
          typeof l.location !== "object" ||
          Array.isArray(l.location)
        )
          return false
        const { lat, lng } = l.location as { lat?: unknown; lng?: unknown }

        return typeof lat === "number" && typeof lng === "number"
      })

      ctx.body = { data: pins, meta: { total: pins.length } }
    },
  })
)
