import { DEFAULT_LOCALE } from "@repo/shared-data"
import { factories } from "@strapi/strapi"

import { noticesForLibraries } from "../../../utils/library-notices"
import { centerFor, tallyLibrariesByChild } from "../../../utils/library-tally"
import { countLibrariesByType } from "../../../utils/library-type-counts"
import {
  countPlaceLibraries,
  PLACE_LIBRARY_FILTERS,
} from "../../../utils/place-library-scope"
import {
  FEATURED_LIBRARY_POPULATE,
  MAP_CONFIG_POPULATE,
  mediaPopulate,
  SEO_POPULATE,
} from "../../../utils/populate-shapes"
import { readStatus } from "../../../utils/read-status"
import { regionIdsWithLibraries } from "../../../utils/region-library-ids"
import { scopedWhere } from "../../../utils/scoped-where"

/** The most slugs one `withLibraries=1` page returns. */
const REGION_SLUGS_MAX_LIMIT = 1000

/**
 * The query parameters `/regions/slugs` reads. Each must be absent or a
 * single string: a repeated key or a bracketed object is refused rather than
 * silently ignored (mirrors `/libraries/slugs`'s `stringQuery`).
 */
function stringQuery(
  q: Record<string, unknown>,
  keys: readonly string[]
): Record<string, string | undefined> | null {
  const out: Record<string, string | undefined> = {}
  for (const key of keys) {
    const value = q[key]
    if (value === undefined) continue
    if (typeof value !== "string") return null
    out[key] = value
  }

  return out
}

/** A non-negative integer query value: `fallback` when absent, null below `min` or malformed, clamped to `max`. */
function pageInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER
): number | null {
  if (raw === undefined || raw === "") return fallback
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)

  return n >= min ? Math.min(n, max) : null
}

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
      const statistics = {
        libraries: true,
        children: true,
        types: true,
        preview: true,
      }
      let libraryCount = 0
      let libraryTypeCounts: { type: string; count: number }[] = []
      let areaCount = 0
      let libraries: unknown[] = []
      let areas: unknown[] = []
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
          countPlaceLibraries(strapi, "region", region.documentId, {
            locale,
            status,
          }).catch(() => {
            statistics.libraries = false

            return 0
          }),
          strapi.db
            .query("api::area.area")
            .count({ where: { region: { id: { $eq: region.id } }, ...scope } })
            .catch(() => {
              statistics.children = false

              return 0
            }),
        ])
      }

      if (region?.documentId) {
        try {
          const [areaRows, areaTallies] = await Promise.all([
            strapi.documents("api::area.area").findMany({
              filters: {
                region: { documentId: { $eq: region.documentId } },
              } as never,
              fields: ["name", "slug"],
              locale,
              status,
              sort: "name:asc" as never,
              limit: 1000,
            }),
            tallyLibrariesByChild(strapi, {
              parent: "region",
              parentDocumentId: region.documentId,
              child: "area",
              locale,
              status,
            }),
          ])
          if (areaRows.length < areaCount) statistics.children = false
          areas = areaRows.map((area) => ({
            ...area,
            libraryCount: areaTallies.get(area.documentId)?.count ?? 0,
            placeBasedCount:
              areaTallies.get(area.documentId)?.placeBasedCount ?? 0,
          }))
        } catch {
          statistics.children = false
        }
        // Type counts, the library list (list, map pins, missing-detail
        // chips) and the sibling regions of the same country (the "Nearby"
        // card) are independent of each other.
        const [typeCounts, rows, nearby] = await Promise.all([
          libraryCount > 0 || !statistics.libraries
            ? countLibrariesByType(strapi, "region", region.documentId, {
                locale,
                status,
              }).catch(() => {
                statistics.types = false

                return []
              })
            : Promise.resolve([]),
          libraryCount > 0 || !statistics.libraries
            ? strapi
                .documents("api::library.library")
                .findMany({
                  filters: {
                    region: { documentId: { $eq: region.documentId } },
                    ...PLACE_LIBRARY_FILTERS,
                  } as never,
                  fields: [
                    "name",
                    "slug",
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
                    "mobileTimetable",
                    "absentFacilities",
                  ] as never,
                  populate: {
                    libraryType: { fields: ["name"] },
                    homeLibrary: { fields: ["name", "slug"] },
                    heroImage: mediaPopulate,
                    accessibility: { fields: ["documentId"] },
                    services: { fields: ["documentId"] },
                    amenities: { fields: ["documentId"] },
                  } as never,
                  sort: [{ featured: "desc" }, { name: "asc" }] as never,
                  limit: REGION_LIBRARY_LIMIT,
                  locale: DEFAULT_LOCALE,
                  status,
                })
                .catch(() => {
                  statistics.preview = false

                  return []
                })
            : Promise.resolve([]),
          countryDocumentId
            ? Promise.all([
                tallyLibrariesByChild(strapi, {
                  parent: "country",
                  parentDocumentId: countryDocumentId,
                  child: "region",
                  locale: DEFAULT_LOCALE,
                  status,
                }),
                strapi.documents("api::region.region").findMany({
                  filters: {
                    country: { documentId: { $eq: countryDocumentId } },
                  } as never,
                  fields: ["name", "slug", "typeLabel"] as never,
                  populate: { mapConfig: MAP_CONFIG_POPULATE } as never,
                  locale: DEFAULT_LOCALE,
                  status,
                }),
              ]).catch(() => null)
            : Promise.resolve(null),
        ])

        libraryTypeCounts = typeCounts
        const notices = await noticesForLibraries(
          strapi,
          rows.map((row) => row.documentId)
        ).catch(() => null)
        libraries = rows.map((row) => ({
          ...row,
          ...(notices ? { notices: notices.get(row.documentId) ?? [] } : {}),
        }))

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
              statistics,
              areaCount,
              areas,
              libraryTypeCounts,
              libraries,
              center,
              siblings,
            }
          : null,
        meta: {},
      }
    },

    // ── /regions/slugs ────────────────────────────────────────────────────────
    // Returns slug + locale pairs for regions — used by generateStaticParams
    // on the region page. Always pages by id keyset like `/libraries/slugs`
    // (`after`, `limit` capped at REGION_SLUGS_MAX_LIMIT, `meta.next`): no
    // caller may load every Region in one unbounded read.
    //
    // `withLibraries=1` prerenders only Regions with at least one published
    // library: the rest render on demand (`dynamicParams`). It filters to the
    // documentIds one grouped query (`regionIdsWithLibraries`) says have a
    // library — never a per-region count. Without it, every Region is paged
    // the same way, just unfiltered (no caller still needs an unpaged read).
    async slugs(ctx) {
      const q = stringQuery(ctx.query as Record<string, unknown>, [
        "locale",
        "after",
        "limit",
        "withLibraries",
      ])
      if (!q) return ctx.badRequest("Query parameters must be single strings")
      const locale = q.locale
      const status = readStatus(ctx)
      const after = pageInt(q.after, 0, 0)
      const limit = pageInt(
        q.limit,
        REGION_SLUGS_MAX_LIMIT,
        1,
        REGION_SLUGS_MAX_LIMIT
      )
      if (after === null || limit === null)
        return ctx.badRequest("after must be >= 0 and limit between 1 and 1000")

      if (q.withLibraries !== "1") {
        const results = (await strapi.documents("api::region.region").findMany({
          ...(after > 0 ? { filters: { id: { $gt: after } } as never } : {}),
          fields: ["slug", "locale"],
          populate: {
            country: { fields: ["slug"] },
            continent: { fields: ["slug"] },
          },
          locale,
          status,
          sort: "id:asc" as never,
          limit,
        })) as unknown as { id?: number }[]

        const last = results.at(-1)?.id
        const next =
          results.length === limit && typeof last === "number" ? last : null

        ctx.body = {
          data: results,
          meta: { after, limit, count: results.length, next },
        }

        return
      }

      const documentIds = [
        ...(await regionIdsWithLibraries(strapi, { locale, status })),
      ]
      if (documentIds.length === 0) {
        ctx.body = { data: [], meta: { after, limit, count: 0, next: null } }

        return
      }

      const results = (await strapi.documents("api::region.region").findMany({
        filters: {
          $and: [
            { documentId: { $in: documentIds } },
            ...(after > 0 ? [{ id: { $gt: after } }] : []),
          ],
        } as never,
        fields: ["slug", "locale"],
        populate: {
          country: { fields: ["slug"] },
          continent: { fields: ["slug"] },
        },
        locale,
        status,
        sort: "id:asc" as never,
        limit,
      })) as unknown as { id?: number }[]

      const last = results.at(-1)?.id
      const next =
        results.length === limit && typeof last === "number" ? last : null

      ctx.body = {
        data: results,
        meta: { after, limit, count: results.length, next },
      }
    },
  })
)
