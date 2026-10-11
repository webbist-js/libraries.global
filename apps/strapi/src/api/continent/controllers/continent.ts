import { factories } from "@strapi/strapi"

import { countChildCoverage } from "../../../utils/library-child-coverage"
import { centerFor, tallyLibrariesByChild } from "../../../utils/library-tally"
import { countLibrariesByType } from "../../../utils/library-type-counts"
import { countPlaceLibraries } from "../../../utils/place-library-scope"
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
          fields: [
            "name",
            "slug",
            "capitalCity",
            "iso2",
            "regionTypeLabel",
            "regionsSectionLabel",
          ],
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
      const statistics = { libraries: true, children: true, types: true }
      let libraryCount = 0
      let libraryTypeCounts: { type: string; count: number }[] = []
      let regionCount = 0
      let regionsWithLibraries: number | null = null
      let tallies = new Map<string, { count: number; center: unknown }>()

      if (continent?.id) {
        const scope = scopedWhere(status, locale)
        ;[libraryCount, regionCount] = await Promise.all([
          countPlaceLibraries(strapi, "continent", continent.documentId, {
            locale,
            status,
          }).catch(() => {
            statistics.libraries = false

            return 0
          }),
          strapi.db
            .query("api::region.region")
            .count({
              where: { continent: { id: { $eq: continent.id } }, ...scope },
            })
            .catch(() => {
              statistics.children = false

              return 0
            }),
        ])

        if (
          (libraryCount > 0 || !statistics.libraries) &&
          continent.documentId
        ) {
          // Per-type counts and per-country tallies / map centres.
          ;[libraryTypeCounts, tallies] = await Promise.all([
            countLibrariesByType(strapi, "continent", continent.documentId, {
              locale,
              status,
            }).catch(() => {
              statistics.types = false

              return []
            }),
            tallyLibrariesByChild(strapi, {
              parent: "continent",
              parentDocumentId: continent.documentId,
              child: "country",
              locale,
              status,
            }).catch(() => {
              statistics.children = false

              return new Map()
            }),
          ])
        }
      }

      if (continent?.documentId && statistics.libraries) {
        regionsWithLibraries = await tallyLibrariesByChild(strapi, {
          parent: "continent",
          parentDocumentId: continent.documentId,
          child: "region",
          locale,
          status,
        })
          .then((counts) => counts.size)
          .catch(() => null)
      }

      const coverage =
        continent?.documentId && statistics.libraries && statistics.children
          ? await countChildCoverage(strapi, {
              parent: "continent",
              parentDocumentId: continent.documentId,
              child: "country",
              descendant: "region",
              locale,
              status,
            }).catch(() => null)
          : null

      type CountryRow = {
        documentId: string
        mapConfig?: { centerLat?: unknown; centerLng?: unknown } | null
      } & Record<string, unknown>

      const countries = (
        (continent as { countries?: CountryRow[] } | null)?.countries ?? []
      ).map(({ mapConfig, ...country }) => {
        const tally = tallies.get(country.documentId) as
          | {
              count: number
              placeBasedCount: number
              center: { lat: number; lng: number } | null
            }
          | undefined

        return {
          ...country,
          libraryCount: tally?.count ?? 0,
          descendantWithRecords: coverage
            ? (coverage.withRecords.get(country.documentId) ?? 0)
            : null,
          descendantTotal: coverage
            ? (coverage.total.get(country.documentId) ?? 0)
            : null,
          placeBasedCount:
            (tally as { placeBasedCount?: number } | undefined)
              ?.placeBasedCount ?? 0,
          center: centerFor(mapConfig, tally),
        }
      })

      ctx.body = {
        data: continent
          ? {
              ...continent,
              countries,
              libraryCount,
              statistics,
              regionCount,
              regionsWithLibraries,
              libraryTypeCounts,
            }
          : null,
        meta: {},
      }
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
