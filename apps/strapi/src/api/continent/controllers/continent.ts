import { factories } from "@strapi/strapi"

import { centerFor, tallyLibrariesByChild } from "../../../utils/library-tally"
import { countLibrariesByType } from "../../../utils/library-type-counts"
import {
  FEATURED_LIBRARY_POPULATE,
  MAP_CONFIG_POPULATE,
  SEO_POPULATE,
} from "../../../utils/populate-shapes"
import { readStatus } from "../../../utils/read-status"
import { scopedWhere } from "../../../utils/scoped-where"

export default factories.createCoreController(
  "api::continent.continent",
  ({ strapi }) => ({
    // ── /homepage/continents ─────────────────────────────────────────────────
    async homepage(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = readStatus(ctx)

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
      const status = readStatus(ctx)

      // Base populate — always safe (fields exist in original schema)
      const basePopulate: Record<string, unknown> = {
        countries: {
          fields: ["name", "slug", "capitalCity", "iso2"],
          populate: { mapConfig: MAP_CONFIG_POPULATE },
        },
      }

      const extendedPopulate: Record<string, unknown> = {
        mapConfig: MAP_CONFIG_POPULATE,
        featuredLibraries: FEATURED_LIBRARY_POPULATE,
        seo: SEO_POPULATE,
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
      let libraryTypeCounts: { type: string; count: number }[] = []
      let regionCount = 0
      let tallies = new Map<string, { count: number; center: unknown }>()

      if (continent?.id) {
        const scope = scopedWhere(status, locale)
        ;[libraryCount, regionCount] = await Promise.all([
          strapi.db
            .query("api::library.library")
            .count({
              where: { continent: { id: { $eq: continent.id } }, ...scope },
            })
            .catch(() => 0),
          strapi.db
            .query("api::region.region")
            .count({
              where: { continent: { id: { $eq: continent.id } }, ...scope },
            })
            .catch(() => 0),
        ])

        if (libraryCount > 0 && continent.documentId) {
          // Per-type counts and per-country tallies / map centres.
          ;[libraryTypeCounts, tallies] = await Promise.all([
            countLibrariesByType(strapi, "continent", continent.documentId, {
              locale,
              status,
            }).catch(() => []),
            tallyLibrariesByChild(strapi, {
              parent: "continent",
              parentDocumentId: continent.documentId,
              child: "country",
              locale,
              status,
            }).catch(() => new Map()),
          ])
        }
      }

      type CountryRow = {
        documentId: string
        mapConfig?: { centerLat?: unknown; centerLng?: unknown } | null
      } & Record<string, unknown>

      const countries = (
        (continent as { countries?: CountryRow[] } | null)?.countries ?? []
      ).map(({ mapConfig, ...country }) => {
        const tally = tallies.get(country.documentId) as
          | { count: number; center: { lat: number; lng: number } | null }
          | undefined

        return {
          ...country,
          libraryCount: tally?.count ?? 0,
          center: centerFor(mapConfig, tally),
        }
      })

      ctx.body = {
        data: continent
          ? {
              ...continent,
              countries,
              libraryCount,
              regionCount,
              libraryTypeCounts,
            }
          : null,
        meta: {},
      }
    },

    // ── /continents/map-pins ─────────────────────────────────────────────────
    // Returns all continents with boundary URL + bounding box for the world map
    async mapPins(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = readStatus(ctx)

      const results = await strapi
        .documents("api::continent.continent")
        .findMany({
          fields: ["name", "slug", "boundaryUrl"],
          populate: { mapConfig: MAP_CONFIG_POPULATE } as never,
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
      const status = readStatus(ctx)

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
