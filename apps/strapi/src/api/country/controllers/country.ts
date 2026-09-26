import { factories } from "@strapi/strapi"

import { countLibrariesByType } from "../../../utils/library-type-counts"

export default factories.createCoreController(
  "api::country.country",
  ({ strapi }) => ({
    // ── /countries/detail/:slug ───────────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const basePopulate: Record<string, unknown> = {
        continent: { fields: ["name", "slug", "code"] },
        regions: { fields: ["name", "slug", "summary", "typeLabel"] },
      }

      const extendedPopulate: Record<string, unknown> = {
        heroImage: true,
        mapConfig: true,
        nationalLibrary: {
          fields: [
            "name",
            "slug",
            "summary",
            "libraryType",
            "operationalStatus",
          ],
          populate: { heroImage: true },
        },
        featuredLibraries: {
          populate: {
            heroImage: true,
            continent: { fields: ["name", "slug", "code"] },
            country: { fields: ["name", "slug"] },
            region: { fields: ["name", "slug"] },
          },
        },
        seo: { populate: { metaImage: true } },
      }

      const results = await strapi
        .documents("api::country.country")
        .findMany({
          filters: { slug: { $eq: slug } } as Record<string, unknown>,
          locale,
          status,
          populate: { ...basePopulate, ...extendedPopulate },
        })
        .catch(async (err: unknown) => {
          strapi.log.error(
            "[country.detail] populate failed, using base only:",
            err
          )

          return strapi.documents("api::country.country").findMany({
            filters: { slug: { $eq: slug } } as Record<string, unknown>,
            locale,
            status,
            populate: basePopulate,
          })
        })

      const country = results[0] ?? null

      // ── Computed aggregates ─────────────────────────────────────────────────
      let libraryCount = 0
      let libraryTypeCounts: { type: string; count: number }[] = []
      let regionCount = 0

      if (country?.id) {
        try {
          libraryCount = await strapi.db.query("api::library.library").count({
            where: {
              country: { id: { $eq: country.id } },
              ...(status === "published"
                ? { publishedAt: { $notNull: true } }
                : {}),
            },
          })
        } catch {
          // non-critical
        }

        if (libraryCount > 0 && country.documentId) {
          libraryTypeCounts = await countLibrariesByType(
            strapi,
            "country",
            country.documentId,
            { locale, status }
          )
        }

        try {
          regionCount = await strapi.db.query("api::region.region").count({
            where: {
              country: { id: { $eq: country.id } },
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
        data: country
          ? { ...country, libraryCount, regionCount, libraryTypeCounts }
          : null,
        meta: {},
      }
    },

    // ── /countries/map-pins ───────────────────────────────────────────────────
    // Returns country centroids (from mapConfig) for interactive map rendering.
    // Accepts: continentSlug
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = q.status === "draft" ? "draft" : "published"

      const filters: Record<string, unknown> = {}
      if (q.continentSlug)
        filters.continent = { slug: { $eq: q.continentSlug } }

      const results = await strapi.documents("api::country.country").findMany({
        filters: filters as never,
        fields: ["name", "slug", "boundaryUrl"],
        populate: {
          mapConfig: true,
          continent: { fields: ["slug"] },
        } as never,
        locale,
        status,
      })

      type CountryWithMap = {
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
      }

      const pins = (results as unknown as CountryWithMap[])
        .filter(
          (c) =>
            c.boundaryUrl || (c.mapConfig?.centerLat && c.mapConfig?.centerLng)
        )
        .map((c) => ({
          documentId: c.documentId,
          name: c.name,
          slug: c.slug,
          lat: c.mapConfig?.centerLat ?? null,
          lng: c.mapConfig?.centerLng ?? null,
          boundingBoxNE: c.mapConfig?.boundingBoxNE ?? null,
          boundingBoxSW: c.mapConfig?.boundingBoxSW ?? null,
          boundaryUrl: c.boundaryUrl ?? null,
          continent: c.continent ?? null,
        }))

      ctx.body = { data: pins, meta: { total: pins.length } }
    },

    // ── /countries/slugs ──────────────────────────────────────────────────────
    // Returns slug + locale pairs for all published countries — used by
    // generateStaticParams on the country page.
    async slugs(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const results = await strapi.documents("api::country.country").findMany({
        fields: ["slug", "locale"],
        populate: {
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
