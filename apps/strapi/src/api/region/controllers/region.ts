import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::region.region",
  ({ strapi }) => ({
    // ── /regions/detail/:slug ─────────────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const basePopulate: Record<string, unknown> = {
        country: {
          fields: ["name", "slug", "capitalCity", "regionTypeLabel"],
          populate: {
            continent: { fields: ["name", "slug", "code"] },
          },
        },
        seo: { populate: { metaImage: true } },
      }

      const extendedPopulate: Record<string, unknown> = {
        continent: { fields: ["name", "slug", "code"] },
        heroImage: true,
        serviceHighlights: true,
        collections: { populate: { image: true } },
        mapConfig: true,
        featuredLibraries: {
          populate: {
            heroImage: true,
            continent: { fields: ["name", "slug", "code"] },
            country: { fields: ["name", "slug"] },
            region: { fields: ["name", "slug"] },
          },
        },
        areas: {
          fields: ["name", "slug", "summary", "typeLabel"],
        },
        sections: {
          on: {
            "sections.editorial-block": { populate: { image: true } },
            "sections.cta-banner": true,
            "sections.quick-links": { populate: { links: true } },
          },
        },
      }

      const results = await strapi
        .documents("api::region.region")
        .findMany({
          filters: { slug: { $eq: slug } } as Record<string, unknown>,
          locale,
          status,
          populate: { ...basePopulate, ...extendedPopulate },
        })
        .catch(async (err: unknown) => {
          strapi.log.error(
            "[region.detail] populate failed, using base only:",
            err
          )

          return strapi.documents("api::region.region").findMany({
            filters: { slug: { $eq: slug } } as Record<string, unknown>,
            locale,
            status,
            populate: basePopulate,
          })
        })

      const region = results[0] ?? null

      // ── Computed aggregates ─────────────────────────────────────────────────
      let libraryCount = 0
      let areaCount = 0

      if (region?.id) {
        try {
          libraryCount = await strapi.db.query("api::library.library").count({
            where: {
              region: { id: { $eq: region.id } },
              ...(status === "published"
                ? { publishedAt: { $notNull: true } }
                : {}),
            },
          })
        } catch {
          // non-critical
        }

        try {
          areaCount = await strapi.db.query("api::area.area").count({
            where: {
              region: { id: { $eq: region.id } },
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
        data: region ? { ...region, libraryCount, areaCount } : null,
        meta: {},
      }
    },

    // ── /regions/map-pins ─────────────────────────────────────────────────────
    // Returns region centroids (from mapConfig) for interactive map rendering.
    // Accepts one of: countrySlug, continentSlug
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = q.status === "draft" ? "draft" : "published"

      const filters: Record<string, unknown> = {}
      if (q.countrySlug) filters.country = { slug: { $eq: q.countrySlug } }
      else if (q.continentSlug)
        filters.continent = { slug: { $eq: q.continentSlug } }

      const results = await strapi.documents("api::region.region").findMany({
        filters: filters as never,
        fields: ["name", "slug", "boundaryUrl"],
        populate: {
          mapConfig: true,
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
        } as never,
        locale,
        status,
      })

      type RegionWithMap = {
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
        continent?: { slug?: string } | null
        country?: { slug?: string } | null
      }

      const pins = (results as unknown as RegionWithMap[])
        .filter(
          (r) =>
            r.boundaryUrl || (r.mapConfig?.centerLat && r.mapConfig?.centerLng)
        )
        .map((r) => ({
          documentId: r.documentId,
          name: r.name,
          slug: r.slug,
          lat: r.mapConfig?.centerLat ?? null,
          lng: r.mapConfig?.centerLng ?? null,
          boundingBoxNE: r.mapConfig?.boundingBoxNE ?? null,
          boundingBoxSW: r.mapConfig?.boundingBoxSW ?? null,
          boundaryUrl: r.boundaryUrl ?? null,
          continent: r.continent ?? null,
          country: r.country ?? null,
        }))

      ctx.body = { data: pins, meta: { total: pins.length } }
    },

    // ── /regions/slugs ────────────────────────────────────────────────────────
    // Returns slug + locale pairs for all published regions — used by
    // generateStaticParams on the region page.
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const results = await strapi.documents("api::region.region").findMany({
        fields: ["slug", "locale"],
        populate: {
          country: { fields: ["slug"] },
          continent: { fields: ["slug"] },
        },
        locale,
        status,
      })

      ctx.body = {
        data: results,
        meta: {},
      }
    },
  })
)
