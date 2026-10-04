import { factories } from "@strapi/strapi"

import { centerFor, tallyLibrariesByChild } from "../../../utils/library-tally"
import { countLibrariesByType } from "../../../utils/library-type-counts"
import {
  FEATURED_LIBRARY_POPULATE,
  MAP_CONFIG_POPULATE,
  mediaPopulate,
  SEO_POPULATE,
} from "../../../utils/populate-shapes"
import { readStatus } from "../../../utils/read-status"
import { scopedWhere } from "../../../utils/scoped-where"

/** Library rows returned with a region — enough for its list and gap chips. */
const REGION_LIBRARY_LIMIT = 100

type SiblingRow = {
  documentId: string
  name: string
  slug: string
  typeLabel?: string | null
  mapConfig?: { centerLat?: unknown; centerLng?: unknown } | null
}

export default factories.createCoreController(
  "api::region.region",
  ({ strapi }) => ({
    // ── /regions/detail/:slug ─────────────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = readStatus(ctx)

      const basePopulate: Record<string, unknown> = {
        country: {
          fields: [
            "name",
            "slug",
            "capitalCity",
            "regionTypeLabel",
            "regionsSectionLabel",
            "areaTypeLabel",
            "areasSectionLabel",
          ],
          populate: {
            continent: { fields: ["name", "slug", "code"] },
          },
        },
      }

      const extendedPopulate: Record<string, unknown> = {
        continent: { fields: ["name", "slug", "code"] },
        heroImage: mediaPopulate,
        mapConfig: MAP_CONFIG_POPULATE,
        featuredLibraries: FEATURED_LIBRARY_POPULATE,
        seo: SEO_POPULATE,
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
      let libraryTypeCounts: { type: string; count: number }[] = []
      let areaCount = 0
      let libraries: unknown[] = []
      let center: { lat: number; lng: number } | null = null
      let siblings: {
        name: string
        slug: string
        typeLabel: string | null
        libraryCount: number
        center: { lat: number; lng: number } | null
      }[] = []

      const countryDocumentId = (
        region as { country?: { documentId?: string } | null } | null
      )?.country?.documentId

      if (region?.id) {
        const scope = scopedWhere(status, locale)
        ;[libraryCount, areaCount] = await Promise.all([
          strapi.db
            .query("api::library.library")
            .count({ where: { region: { id: { $eq: region.id } }, ...scope } })
            .catch(() => 0),
          strapi.db
            .query("api::area.area")
            .count({ where: { region: { id: { $eq: region.id } }, ...scope } })
            .catch(() => 0),
        ])
      }

      if (region?.documentId) {
        // Type counts, the library list (list, map pins, missing-detail
        // chips) and the sibling regions of the same country (the "Nearby"
        // card) are independent of each other.
        const [typeCounts, rows, nearby] = await Promise.all([
          libraryCount > 0
            ? countLibrariesByType(strapi, "region", region.documentId, {
                locale,
                status,
              }).catch(() => [])
            : Promise.resolve([]),
          libraryCount > 0
            ? strapi
                .documents("api::library.library")
                .findMany({
                  filters: {
                    region: { documentId: { $eq: region.documentId } },
                  } as never,
                  fields: [
                    "name",
                    "slug",
                    "libraryType",
                    "city",
                    "district",
                    "summary",
                    "openingTimes",
                    "timezone",
                    "location",
                    "website",
                    "phone",
                    "email",
                    "streetAddress",
                    "operationalStatus",
                    "featured",
                  ] as never,
                  populate: {
                    heroImage: mediaPopulate,
                    accessibility: { fields: ["documentId"] },
                    services: { fields: ["documentId"] },
                    amenities: { fields: ["documentId"] },
                  } as never,
                  sort: [{ featured: "desc" }, { name: "asc" }] as never,
                  limit: REGION_LIBRARY_LIMIT,
                  locale,
                  status,
                })
                .catch(() => [])
            : Promise.resolve([]),
          countryDocumentId
            ? Promise.all([
                tallyLibrariesByChild(strapi, {
                  parent: "country",
                  parentDocumentId: countryDocumentId,
                  child: "region",
                  locale,
                  status,
                }),
                strapi.documents("api::region.region").findMany({
                  filters: {
                    country: { documentId: { $eq: countryDocumentId } },
                  } as never,
                  fields: ["name", "slug", "typeLabel"] as never,
                  populate: { mapConfig: MAP_CONFIG_POPULATE } as never,
                  locale,
                  status,
                }),
              ]).catch(() => null)
            : Promise.resolve(null),
        ])

        libraryTypeCounts = typeCounts
        libraries = rows

        if (nearby) {
          const [tallies, siblingRows] = nearby
          center = centerFor(
            (region as { mapConfig?: SiblingRow["mapConfig"] }).mapConfig,
            tallies.get(region.documentId)
          )
          siblings = (siblingRows as unknown as SiblingRow[])
            .filter((row) => row.documentId !== region.documentId)
            .map((row) => {
              const tally = tallies.get(row.documentId)

              return {
                name: row.name,
                slug: row.slug,
                typeLabel: row.typeLabel ?? null,
                libraryCount: tally?.count ?? 0,
                center: centerFor(row.mapConfig, tally),
              }
            })
        }
      }

      ctx.body = {
        data: region
          ? {
              ...region,
              libraryCount,
              areaCount,
              libraryTypeCounts,
              libraries,
              center,
              siblings,
            }
          : null,
        meta: {},
      }
    },

    // ── /regions/map-pins ─────────────────────────────────────────────────────
    // Returns region centroids (from mapConfig) for interactive map rendering.
    // Accepts one of: countrySlug, continentSlug
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = readStatus(ctx)

      const filters: Record<string, unknown> = {}
      if (q.countrySlug) filters.country = { slug: { $eq: q.countrySlug } }
      else if (q.continentSlug)
        filters.continent = { slug: { $eq: q.continentSlug } }

      const results = await strapi.documents("api::region.region").findMany({
        filters: filters as never,
        fields: ["name", "slug", "boundaryUrl"],
        populate: {
          mapConfig: MAP_CONFIG_POPULATE,
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
      const status = readStatus(ctx)

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
