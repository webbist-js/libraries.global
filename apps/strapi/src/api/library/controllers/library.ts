import {
  libraryTypeName,
  normalizeOpeningSchedule,
  atlasWeeklyIntervals,
  effectiveLibraryWeekHours,
  noticeLocalDate,
  noticeAddDays,
  type LibraryNotice,
} from "@repo/shared-data"
import { factories } from "@strapi/strapi"

import {
  ATLAS_CACHE_CONTROL,
  getAtlasCache,
  setAtlasCache,
} from "../../../utils/atlas-cache"
import { BUILDING_LIBRARY_FILTER } from "../../../utils/library-building-filter"
import type { OpeningTimes } from "../../../utils/library-completeness"
import { countLibrariesByLocationPath } from "../../../utils/library-location-counts"
import { noticesForLibraries } from "../../../utils/library-notices"
import { readStatus } from "../../../utils/read-status"

// ── Atlas helpers ──────────────────────────────────────────────────────────

interface AtlasSource {
  id: number
  documentId: string
  name?: string
  slug?: string
  libraryType?: string
  operationalStatus?: string
  operatorType?: string | null
  city?: string | null
  location?: unknown
  openingTimes?: OpeningTimes
  timezone?: string | null
  foundedYear?: string | null
  openedYear?: string | null
  closedYear?: string | null
  hasActiveFeed?: boolean | null
  catalogueUrl?: string | null
  completeness?: number | null
  continent?: { slug?: string } | null
  country?: { slug?: string; name?: string } | null
  region?: { slug?: string; name?: string } | null
  accessibility?: { name?: string }[] | null
  services?: { name?: string }[] | null
  amenities?: { name?: string }[] | null
}

function year(v?: string | null): number | null {
  const m = v ? /\d{3,4}/.exec(v) : null

  return m ? Number(m[0]) : null
}

const names = (xs?: { name?: string }[] | null) =>
  (xs ?? []).map((x) => x.name).filter(Boolean)

function toAtlasProperties(l: AtlasSource, notices: LibraryNotice[] = []) {
  const date = noticeLocalDate(new Date(), l.timezone)
  const day = (new Date(`${date}T12:00Z`).getUTCDay() + 6) % 7
  const effective = effectiveLibraryWeekHours(
    l.openingTimes,
    notices,
    noticeAddDays(date, -day)
  )

  return {
    id: l.documentId,
    name: l.name ?? "",
    slug: l.slug ?? "",
    type: libraryTypeName(l.libraryType) ?? "Other",
    status: l.operationalStatus ?? "unknown",
    operator: l.operatorType ?? null,
    city: l.city ?? null,
    country: l.country?.name ?? null,
    region: l.region?.name ?? null,
    path:
      l.continent?.slug && l.country?.slug && l.region?.slug
        ? `/${l.continent.slug}/${l.country.slug}/${l.region.slug}/${l.slug}`
        : null,
    tz: l.timezone ?? null,
    hours: atlasWeeklyIntervals(effective),
    staffHours: atlasWeeklyIntervals({
      days: normalizeOpeningSchedule(effective).days.map((day) => ({
        ...day,
        timeframes: day.timeframes.filter(
          (frame) =>
            frame.staffing === "staffed" || frame.staffing === "volunteer"
        ),
      })),
    }),
    founded: year(l.foundedYear) ?? year(l.openedYear),
    closed: year(l.closedYear),
    events: Boolean(l.hasActiveFeed),
    catalogue: Boolean(l.catalogueUrl),
    access: names(l.accessibility),
    services: [...names(l.services), ...names(l.amenities)],
    // Stored on the record (see utils/library-completeness.ts); a row the
    // bootstrap backfill hasn't reached yet reads as 0.
    complete: l.completeness ?? 0,
  }
}

type AtlasFeature = {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: ReturnType<typeof toAtlasProperties>
}

/** Atlas keyset page. */
const ATLAS_PAGE = 1000

/**
 * The query parameters these endpoints read. Each must be absent or a single
 * string: a repeated key (`?locale=a&locale=b`) or a bracketed object is
 * refused rather than silently ignored.
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

export default factories.createCoreController(
  "api::library.library",
  ({ strapi }) => ({
    /**
     * GET /libraries/by-slug/:slug
     * The core `find` with the slug pinned, under the detail populate shape
     * (routes/library-by-slug.ts). Locale, status and sort pass through as
     * for the list route; the client's own filters are replaced, so a slug
     * read can never widen into a scan.
     */
    async findBySlug(ctx) {
      const { slug } = ctx.params as { slug?: unknown }
      if (
        typeof slug !== "string" ||
        slug.length === 0 ||
        slug.length > 255 ||
        !/^[a-z0-9][a-z0-9._-]*$/i.test(slug)
      )
        return ctx.badRequest("Invalid slug")
      const {
        filters: _ignored,
        pagination: _page,
        ...rest
      } = (ctx.query ?? {}) as Record<string, unknown>
      ctx.query = {
        ...rest,
        filters: { slug: { $eq: slug } },
        pagination: { pageSize: 5 },
      }

      return super.find(ctx)
    },

    /**
     * GET /libraries/atlas
     * Every published library as a compact GeoJSON FeatureCollection for the
     * Atlas Explorer map. Filtering happens client-side, so this carries the
     * filterable fields (type, status, operator, hours, facilities…) rather
     * than display copy. Detail comes from the normal library endpoints when a
     * pin is opened.
     *
     * The collection is built by walking the table in id order and memoised
     * for five minutes per locale (cleared by any library write).
     */
    async atlas(ctx) {
      if (process.env.ATLAS_LEGACY_SOURCE_ENABLED === "false") {
        ctx.status = 410
        ctx.body = { error: "The bulk Atlas source has been retired" }

        return
      }
      const q = stringQuery(ctx.query as Record<string, unknown>, ["locale"])
      if (!q) return ctx.badRequest("Query parameters must be single strings")
      const locale = q.locale

      const build = async () => {
        const rows: AtlasSource[] = []
        let lastId = 0
        for (;;) {
          const batch = (await strapi
            .documents("api::library.library")
            .findMany({
              // Scheduled mobile services are drawn as stop pins, not a depot.
              filters: {
                id: { $gt: lastId },
                ...BUILDING_LIBRARY_FILTER,
              } as never,
              fields: [
                "name",
                "slug",
                "operationalStatus",
                "operatorType",
                "city",
                "location",
                "openingTimes",
                "timezone",
                "foundedYear",
                "openedYear",
                "closedYear",
                "hasActiveFeed",
                "catalogueUrl",
                "completeness",
              ] as never,
              populate: {
                libraryType: { fields: ["name"] },
                continent: { fields: ["slug"] },
                country: { fields: ["slug", "name"] },
                region: { fields: ["slug", "name"] },
                accessibility: { fields: ["name"] },
                services: { fields: ["name"] },
                amenities: { fields: ["name"] },
              } as never,
              locale,
              status: "published",
              sort: "id:asc" as never,
              limit: ATLAS_PAGE,
            })) as unknown as AtlasSource[]
          rows.push(...batch)
          const last = batch.at(-1)
          if (batch.length < ATLAS_PAGE || typeof last?.id !== "number") break
          lastId = last.id
        }

        const notices = new Map<string, LibraryNotice[]>()
        for (let start = 0; start < rows.length; start += 100) {
          const chunk = await noticesForLibraries(
            strapi,
            rows.slice(start, start + 100).map((row) => row.documentId)
          )
          for (const [id, values] of chunk) notices.set(id, values)
        }
        const features = rows.flatMap((lib): AtlasFeature[] => {
          const loc = lib.location as { lat?: unknown; lng?: unknown } | null
          if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number")
            return []

          return [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
              properties: toAtlasProperties(
                lib,
                notices.get(lib.documentId) ?? []
              ),
            },
          ]
        })

        return { type: "FeatureCollection" as const, features }
      }

      const key = locale ?? ""
      const collection = await (getAtlasCache<
        Awaited<ReturnType<typeof build>>
      >(key) ?? setAtlasCache(key, build()))

      ctx.set("Cache-Control", ATLAS_CACHE_CONTROL)
      ctx.body = collection
    },

    /**
     * GET /libraries/slugs?after=0&start=0&limit=1000
     * Slug, locale and location slugs for every library, in id order, for
     * sitemaps and static params. `limit` is capped at SLUGS_MAX_LIMIT.
     * Callers page by keyset: pass `meta.next` back as `after` (null on the
     * last page). `start` skips rows after that, so a sitemap file can jump
     * to its first row once and walk by keyset from there.
     */
    async slugs(ctx) {
      const q = stringQuery(ctx.query as Record<string, unknown>, [
        "locale",
        "after",
        "start",
        "limit",
      ])
      if (!q) return ctx.badRequest("Query parameters must be single strings")
      const after = pageInt(q.after, 0, 0)
      const start = pageInt(q.start, 0, 0)
      const limit = pageInt(q.limit, SLUGS_MAX_LIMIT, 1, SLUGS_MAX_LIMIT)
      if (after === null || start === null || limit === null)
        return ctx.badRequest(
          "after and start must be >= 0 and limit between 1 and 1000"
        )
      const status = readStatus(ctx)

      const results = (await strapi.documents("api::library.library").findMany({
        ...(after > 0 ? { filters: { id: { $gt: after } } as never } : {}),
        fields: ["slug", "locale", "updatedAt"],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
        } as never,
        locale: q.locale,
        status,
        sort: "id:asc" as never,
        start,
        limit,
      })) as unknown as { id?: number }[]
      const last = results.at(-1)?.id
      const next =
        results.length === limit && typeof last === "number" ? last : null

      ctx.body = {
        data: results,
        meta: { after, start, limit, count: results.length, next },
      }
    },

    /**
     * GET /libraries/slugs/count
     * How many libraries `/libraries/slugs` would walk, so the sitemap index
     * can size its files without reading every row.
     */
    async slugsCount(ctx) {
      const q = stringQuery(ctx.query as Record<string, unknown>, ["locale"])
      if (!q) return ctx.badRequest("Query parameters must be single strings")

      const count = await strapi.documents("api::library.library").count({
        locale: q.locale,
        status: readStatus(ctx),
      } as never)

      ctx.body = { count }
    },

    /**
     * GET /libraries/location-counts
     * Published libraries per continent, continent/country and
     * continent/country/region slug path, from one grouped query. The
     * sitemap lists a location page only once it has records.
     */
    async locationCounts(ctx) {
      const q = stringQuery(ctx.query as Record<string, unknown>, ["locale"])
      if (!q) return ctx.badRequest("Query parameters must be single strings")

      ctx.body = {
        data: await countLibrariesByLocationPath(strapi, {
          locale: q.locale,
          status: readStatus(ctx),
        }),
      }
    },
  })
)

/** The most slugs one page returns. */
const SLUGS_MAX_LIMIT = 1000

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
