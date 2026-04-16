import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::continent.continent",
  ({ strapi }) => ({
    // ── /homepage/continents ─────────────────────────────────────────────────
    async homepage(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const continentService = strapi.service("api::continent.continent") as {
        getHomepageSummaries: (params: {
          locale?: string
          status: "draft" | "published"
        }) => Promise<unknown[]>
      }

      const data = await continentService.getHomepageSummaries({
        locale,
        status,
      })

      ctx.body = {
        data,
        meta: {},
      }
    },

    // ── /continents/detail/:slug ─────────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      // Base populate — always safe (fields exist in original schema)
      const basePopulate: Record<string, unknown> = {
        countries: { fields: ["name", "slug", "summary", "capitalCity"] },
      }

      const extendedPopulate: Record<string, unknown> = {
        mapConfig: true,
        featuredLibraries: {
          populate: {
            heroImage: true,
            continent: { fields: ["name", "slug", "code"] },
            country: { fields: ["name", "slug"] },
            region: { fields: ["name", "slug"] },
          },
        },
        // Dynamic zones require the `on` syntax in Strapi v5
        sections: {
          on: {
            "sections.editorial-block": { populate: { image: true } },
            "sections.cta-banner": true,
            "sections.quick-links": { populate: { links: true } },
          },
        },
        seo: { populate: { metaImage: true } },
      }

      const results = await strapi
        .documents("api::continent.continent")
        .findMany({
          filters: { slug: { $eq: slug } } as Record<string, unknown>,
          locale,
          status,
          populate: { ...basePopulate, ...extendedPopulate },
        })
        .catch(async () => {
          // Fall back to base populate only if extended fields aren't migrated yet
          return strapi.documents("api::continent.continent").findMany({
            filters: { slug: { $eq: slug } } as Record<string, unknown>,
            locale,
            status,
            populate: basePopulate,
          })
        })

      const continent = results[0] ?? null

      // ── Computed aggregates ─────────────────────────────────────────────────
      let libraryCount = 0
      let regionCount = 0

      if (continent?.id) {
        try {
          libraryCount = await strapi.db.query("api::library.library").count({
            where: {
              continent: { id: { $eq: continent.id } },
              ...(status === "published"
                ? { publishedAt: { $notNull: true } }
                : {}),
            },
          })
        } catch {
          // non-critical
        }

        try {
          regionCount = await strapi.db.query("api::region.region").count({
            where: {
              continent: { id: { $eq: continent.id } },
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
        data: continent ? { ...continent, libraryCount, regionCount } : null,
        meta: {},
      }
    },

    // ── /continents/map-pins ─────────────────────────────────────────────────
    // Returns all continents with boundary URL + bounding box for the world map
    async mapPins(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const results = await strapi
        .documents("api::continent.continent")
        .findMany({
          fields: ["name", "slug", "boundaryUrl"],
          populate: { mapConfig: true } as never,
          locale,
          status,
        })

      const pins = results.map((c: unknown) => {
        const cont = c as {
          documentId: string
          name: string
          slug: string
          boundaryUrl?: string | null
          mapConfig?: {
            centerLat?: number | null
            centerLng?: number | null
            boundingBoxNE?: string | null
            boundingBoxSW?: string | null
          } | null
        }

        return {
          documentId: cont.documentId,
          name: cont.name,
          slug: cont.slug,
          lat: cont.mapConfig?.centerLat ?? null,
          lng: cont.mapConfig?.centerLng ?? null,
          boundingBoxNE: cont.mapConfig?.boundingBoxNE ?? null,
          boundingBoxSW: cont.mapConfig?.boundingBoxSW ?? null,
          boundaryUrl: cont.boundaryUrl ?? null,
        }
      })

      ctx.body = { data: pins, meta: { total: pins.length } }
    },

    // ── /continents/slugs ────────────────────────────────────────────────────
    // Returns slug + locale pairs for all published continents — used by
    // generateStaticParams on the continent page.
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const results = await strapi
        .documents("api::continent.continent")
        .findMany({
          fields: ["slug", "locale"],
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
