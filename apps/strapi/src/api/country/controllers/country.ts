import { factories } from "@strapi/strapi"

import { centerFor, tallyLibrariesByChild } from "../../../utils/library-tally"
import { countLibrariesByType } from "../../../utils/library-type-counts"
import {
  FEATURED_LIBRARY_POPULATE,
  MAP_CONFIG_POPULATE,
  mediaPopulate,
  SEO_POPULATE,
} from "../../../utils/populate-shapes"
import { readLocale, readStatus } from "../../../utils/read-status"
import { scopedWhere } from "../../../utils/scoped-where"

export default factories.createCoreController(
  "api::country.country",
  ({ strapi }) => ({
    // ── /countries/detail/:slug ───────────────────────────────────────────────
    async detail(ctx) {
      const { slug } = ctx.params as { slug: string }
      const locale = readLocale(ctx)
      const status = readStatus(ctx)

      const basePopulate: Record<string, unknown> = {
        continent: { fields: ["name", "slug", "code"] },
        regions: {
          fields: ["name", "slug", "summary", "typeLabel"],
          populate: { mapConfig: MAP_CONFIG_POPULATE },
        },
      }

      const extendedPopulate: Record<string, unknown> = {
        heroImage: mediaPopulate,
        mapConfig: MAP_CONFIG_POPULATE,
        nationalLibrary: {
          fields: [
            "name",
            "slug",
            "summary",
            "libraryType",
            "operationalStatus",
          ],
          populate: { heroImage: mediaPopulate },
        },
        featuredLibraries: FEATURED_LIBRARY_POPULATE,
        seo: SEO_POPULATE,
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
      let tallies = new Map<string, { count: number; center: unknown }>()

      if (country?.id) {
        const scope = scopedWhere(status, locale)
        ;[libraryCount, regionCount] = await Promise.all([
          strapi.db
            .query("api::library.library")
            .count({
              where: { country: { id: { $eq: country.id } }, ...scope },
            })
            .catch(() => 0),
          strapi.db
            .query("api::region.region")
            .count({
              where: { country: { id: { $eq: country.id } }, ...scope },
            })
            .catch(() => 0),
        ])

        if (libraryCount > 0 && country.documentId) {
          // Per-type counts and per-region tallies / map centres.
          ;[libraryTypeCounts, tallies] = await Promise.all([
            countLibrariesByType(strapi, "country", country.documentId, {
              locale,
              status,
            }).catch(() => []),
            tallyLibrariesByChild(strapi, {
              parent: "country",
              parentDocumentId: country.documentId,
              child: "region",
              locale,
              status,
            }).catch(() => new Map()),
          ])
        }
      }

      type RegionRow = {
        documentId: string
        mapConfig?: { centerLat?: unknown; centerLng?: unknown } | null
      } & Record<string, unknown>

      const regions = (
        (country as { regions?: RegionRow[] } | null)?.regions ?? []
      ).map(({ mapConfig, ...region }) => {
        const tally = tallies.get(region.documentId) as
          | { count: number; center: { lat: number; lng: number } | null }
          | undefined

        return {
          ...region,
          libraryCount: tally?.count ?? 0,
          center: centerFor(mapConfig, tally),
        }
      })

      ctx.body = {
        data: country
          ? {
              ...country,
              regions,
              libraryCount,
              regionCount,
              libraryTypeCounts,
            }
          : null,
        meta: {},
      }
    },

    // ── /countries/slugs ──────────────────────────────────────────────────────
    // Returns slug + locale pairs for all published countries — used by
    // generateStaticParams on the country page.
    async slugs(ctx) {
      const locale = readLocale(ctx)
      const status = readStatus(ctx)

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
