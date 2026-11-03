import { factories } from "@strapi/strapi"

import { countChildCoverage } from "../../../utils/library-child-coverage"
import { centerFor, tallyLibrariesByChild } from "../../../utils/library-tally"
import { countLibrariesByType } from "../../../utils/library-type-counts"
import {
  areasWithLibraries,
  isPlaceSlug,
  regionsWithLibraries,
} from "../../../utils/place-catalogue"
import { countPlaceLibraries } from "../../../utils/place-library-scope"
import {
  FEATURED_LIBRARY_POPULATE,
  MAP_CONFIG_POPULATE,
  mediaPopulate,
  SEO_POPULATE,
} from "../../../utils/populate-shapes"
import { readLocale, readStatus } from "../../../utils/read-status"
import { scopedWhere } from "../../../utils/scoped-where"

interface AtlasPlaceRef {
  documentId: string
  name: string
  slug: string
}

interface AtlasCountryRow {
  documentId: string
  name: string
  slug: string
  iso2?: string | null
  iso3?: string | null
  summary?: string | null
  populationCount?: number | string | null
  populationYear?: number | null
  populationSource?: string | null
  populationSourceUrl?: string | null
  populationLicence?: string | null
  continent?: AtlasPlaceRef | null
  regions?: AtlasPlaceRef[] | null
}

interface AtlasDatasetRow {
  key: string
  name: string
  publisher?: string | null
  licence?: string | null
  licenceUrl?: string | null
  sourceUrl?: string | null
}

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
          fields: [
            "name",
            "slug",
            "summary",
            "typeLabel",
            "areaTypeLabel",
            "areasSectionLabel",
          ],
          populate: { mapConfig: MAP_CONFIG_POPULATE },
        },
      }

      const extendedPopulate: Record<string, unknown> = {
        heroImage: mediaPopulate,
        mapConfig: MAP_CONFIG_POPULATE,
        nationalLibrary: {
          fields: ["name", "slug", "summary", "operationalStatus"],
          populate: {
            libraryType: { fields: ["name"] },
            heroImage: mediaPopulate,
          },
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
      const statistics = { libraries: true, children: true, types: true }
      let libraryCount = 0
      let libraryTypeCounts: { type: string; count: number }[] = []
      let regionCount = 0
      let tallies = new Map<string, { count: number; center: unknown }>()

      if (country?.id) {
        const scope = scopedWhere(status, locale)
        ;[libraryCount, regionCount] = await Promise.all([
          countPlaceLibraries(strapi, "country", country.documentId, {
            locale,
            status,
          }).catch(() => {
            statistics.libraries = false

            return 0
          }),
          strapi.db
            .query("api::region.region")
            .count({
              where: { country: { id: { $eq: country.id } }, ...scope },
            })
            .catch(() => {
              statistics.children = false

              return 0
            }),
        ])

        if ((libraryCount > 0 || !statistics.libraries) && country.documentId) {
          // Per-type counts and per-region tallies / map centres.
          ;[libraryTypeCounts, tallies] = await Promise.all([
            countLibrariesByType(strapi, "country", country.documentId, {
              locale,
              status,
            }).catch(() => {
              statistics.types = false

              return []
            }),
            tallyLibrariesByChild(strapi, {
              parent: "country",
              parentDocumentId: country.documentId,
              child: "region",
              locale,
              status,
            }).catch(() => {
              statistics.children = false

              return new Map()
            }),
          ])
        }
      }

      const coverage =
        country?.documentId && statistics.libraries && statistics.children
          ? await countChildCoverage(strapi, {
              parent: "country",
              parentDocumentId: country.documentId,
              child: "region",
              descendant: "area",
              locale,
              status,
            }).catch(() => null)
          : null

      type RegionRow = {
        documentId: string
        mapConfig?: { centerLat?: unknown; centerLng?: unknown } | null
      } & Record<string, unknown>

      const regions = (
        (country as { regions?: RegionRow[] } | null)?.regions ?? []
      ).map(({ mapConfig, ...region }) => {
        const tally = tallies.get(region.documentId) as
          | {
              count: number
              placeBasedCount: number
              center: { lat: number; lng: number } | null
            }
          | undefined

        return {
          ...region,
          libraryCount: tally?.count ?? 0,
          descendantWithRecords: coverage
            ? (coverage.withRecords.get(region.documentId) ?? 0)
            : null,
          descendantTotal: coverage
            ? (coverage.total.get(region.documentId) ?? 0)
            : null,
          placeBasedCount:
            (tally as { placeBasedCount?: number } | undefined)
              ?.placeBasedCount ?? 0,
          center: centerFor(mapConfig, tally),
        }
      })

      ctx.body = {
        data: country
          ? {
              ...country,
              regions,
              libraryCount,
              statistics,
              regionCount,
              libraryTypeCounts,
            }
          : null,
        meta: {},
      }
    },

    // ── /countries/atlas ──────────────────────────────────────────────────────
    // Every published country with its ISO codes, for the Atlas country
    // picker; the UI joins them to map boundaries (keyed by iso3).
    async atlasList(ctx) {
      const locale = readLocale(ctx)
      const rows = (await strapi.documents("api::country.country").findMany({
        fields: ["name", "slug", "iso2", "iso3"],
        populate: { continent: { fields: ["slug"] } },
        locale,
        status: "published",
        limit: 500,
      } as never)) as {
        documentId: string
        name: string
        slug: string
        iso2?: string | null
        iso3?: string | null
        continent?: { slug?: string } | null
      }[]

      ctx.set("Cache-Control", "public, max-age=300")
      ctx.body = {
        data: rows.map((row) => ({
          documentId: row.documentId,
          name: row.name,
          slug: row.slug,
          iso2: row.iso2?.toUpperCase() || null,
          iso3: row.iso3?.toUpperCase() || null,
          continent: row.continent?.slug ?? null,
        })),
      }
    },

    // ── /countries/atlas/:slug ────────────────────────────────────────────────
    // One country for the Atlas country drawer: population, library and
    // per-type counts, its regions by library count, and the registered
    // Datasets named in `?datasets=` (keys from the library index facet).
    async atlasDetail(ctx) {
      const slug = String((ctx.params as { slug?: string }).slug ?? "").trim()
      if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))
        return ctx.badRequest("Invalid country")
      const locale = readLocale(ctx)
      const status = "published" as const

      const [country] = (await strapi
        .documents("api::country.country")
        .findMany({
          filters: { slug: { $eq: slug } },
          fields: [
            "name",
            "slug",
            "iso2",
            "iso3",
            "summary",
            "populationCount",
            "populationYear",
            "populationSource",
            "populationSourceUrl",
            "populationLicence",
          ],
          populate: {
            continent: { fields: ["name", "slug"] },
            regions: { fields: ["name", "slug"] },
          },
          locale,
          status,
          limit: 1,
        } as never)) as AtlasCountryRow[]
      if (!country) {
        ctx.body = { data: null }

        return
      }

      const options = { locale, status }
      const [libraryCount, libraryTypeCounts, tallies] = await Promise.all([
        countPlaceLibraries(strapi, "country", country.documentId, options)
          .then((n: number) => n)
          .catch(() => null),
        countLibrariesByType(strapi, "country", country.documentId, options)
          .then((rows: { type: string; count: number }[]) => rows)
          .catch(() => null),
        tallyLibrariesByChild(strapi, {
          parent: "country",
          parentDocumentId: country.documentId,
          child: "region",
          locale,
          status,
        }).catch(() => null),
      ])
      const regions = (country.regions ?? [])
        .map((region) => ({
          name: region.name,
          slug: region.slug,
          libraryCount:
            (tallies?.get(region.documentId) as { count?: number } | undefined)
              ?.count ?? 0,
        }))
        .filter((region) => region.libraryCount > 0)
        .sort(
          (a, b) =>
            b.libraryCount - a.libraryCount || a.name.localeCompare(b.name)
        )

      const keys = String((ctx.query as { datasets?: string }).datasets ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter((key) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(key))
        .slice(0, 20)
      const datasets = keys.length
        ? (
            (await strapi.documents("api::dataset.dataset").findMany({
              filters: { key: { $in: keys } },
              fields: [
                "key",
                "name",
                "publisher",
                "licence",
                "licenceUrl",
                "sourceUrl",
              ],
              limit: keys.length,
            } as never)) as AtlasDatasetRow[]
          ).map(({ key, name, publisher, licence, licenceUrl, sourceUrl }) => ({
            key,
            name,
            publisher: publisher ?? null,
            licence: licence ?? null,
            licenceUrl: licenceUrl ?? null,
            sourceUrl: sourceUrl ?? null,
          }))
        : []

      ctx.set("Cache-Control", "public, max-age=300")
      ctx.body = {
        data: {
          documentId: country.documentId,
          name: country.name,
          slug: country.slug,
          iso2: country.iso2 ?? null,
          iso3: country.iso3?.toUpperCase() || null,
          summary: country.summary ?? null,
          continent: country.continent
            ? { name: country.continent.name, slug: country.continent.slug }
            : null,
          population: country.populationCount
            ? {
                count: Number(country.populationCount),
                year: country.populationYear ?? null,
                source: country.populationSource ?? null,
                sourceUrl: country.populationSourceUrl ?? null,
                licence: country.populationLicence ?? null,
              }
            : null,
          libraryCount,
          libraryTypeCounts,
          regionCount: (country.regions ?? []).length,
          regions: regions.slice(0, 12),
          datasets,
        },
      }
    },

    // ── /countries/atlas/:slug/places?region= ────────────────────────────────
    // The Atlas place filters: the country's regions with libraries and, for
    // a chosen region, its areas with libraries (documentIds scope queries).
    async atlasPlaces(ctx) {
      const slug = String((ctx.params as { slug?: string }).slug ?? "").trim()
      const regionSlug = String(
        (ctx.query as { region?: string }).region ?? ""
      ).trim()
      if (!isPlaceSlug(slug) || (regionSlug && !isPlaceSlug(regionSlug)))
        return ctx.badRequest("Invalid place")
      const options = { locale: readLocale(ctx) }
      const parent = await regionsWithLibraries(strapi, slug, options)
      if (!parent) {
        ctx.body = { data: null }

        return
      }
      const areas = regionSlug
        ? ((await areasWithLibraries(strapi, slug, regionSlug, options))
            ?.areas ?? [])
        : []

      ctx.set("Cache-Control", "public, max-age=300")
      ctx.body = { data: { regions: parent.regions, areas } }
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
