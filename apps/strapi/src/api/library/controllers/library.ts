import { factories } from "@strapi/strapi"

// ── Atlas helpers ──────────────────────────────────────────────────────────

interface AtlasSource {
  documentId: string
  name?: string
  slug?: string
  libraryType?: string
  operationalStatus?: string
  operatorType?: string | null
  city?: string | null
  location?: unknown
  openingTimes?: {
    days?: {
      day: string
      enabled?: boolean
      timeframes?: { startTime: string; endTime: string }[]
    }[]
  } | null
  timezone?: string | null
  foundedYear?: string | null
  openedYear?: string | null
  closedYear?: string | null
  hasActiveFeed?: boolean | null
  catalogueUrl?: string | null
  streetAddress?: string | null
  summary?: string | null
  description?: unknown
  website?: string | null
  phone?: string | null
  email?: string | null
  continent?: { slug?: string } | null
  country?: { slug?: string; name?: string } | null
  region?: { slug?: string; name?: string } | null
  heroImage?: { url?: string } | null
  accessibility?: { name?: string }[] | null
  services?: { name?: string }[] | null
  amenities?: { name?: string }[] | null
  collectionStats?: unknown[] | null
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

/** Opening hours as 7 arrays (Mon–Sun) of [startMin, endMin]; null when unknown. */
function compactHours(o: AtlasSource["openingTimes"]): number[][][] | null {
  const days = o?.days
  if (!Array.isArray(days)) return null
  const out = DAYS.map((key) => {
    const d = days.find((x) => x.day === key)
    if (!d?.enabled) return []

    return (d.timeframes ?? [])
      .filter((tf) => tf.startTime && tf.endTime)
      .map((tf) => [minutes(tf.startTime), minutes(tf.endTime)])
  })

  return out.some((d) => d.length > 0) ? out : null
}

function year(v?: string | null): number | null {
  const m = v ? /\d{3,4}/.exec(v) : null

  return m ? Number(m[0]) : null
}

/** Same eight sections as the library page's "About this record" panel. */
function completeness(l: AtlasSource, hours: unknown): number {
  const sections = [
    Boolean(l.heroImage),
    Boolean(hours),
    Boolean(l.streetAddress),
    Boolean(l.location),
    Boolean(
      l.accessibility?.length || l.services?.length || l.amenities?.length
    ),
    Boolean(
      l.summary ||
      (Array.isArray(l.description) && l.description.length) ||
      l.collectionStats?.length
    ),
    Boolean(l.foundedYear || l.openedYear),
    Boolean(l.website || l.phone || l.email),
  ]

  return Math.round((sections.filter(Boolean).length / sections.length) * 100)
}

const names = (xs?: { name?: string }[] | null) =>
  (xs ?? []).map((x) => x.name).filter(Boolean)

function toAtlasProperties(l: AtlasSource) {
  const hours = compactHours(l.openingTimes)

  return {
    id: l.documentId,
    name: l.name ?? "",
    slug: l.slug ?? "",
    type: l.libraryType ?? "Other",
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
    hours,
    founded: year(l.foundedYear) ?? year(l.openedYear),
    closed: year(l.closedYear),
    events: Boolean(l.hasActiveFeed),
    catalogue: Boolean(l.catalogueUrl),
    access: names(l.accessibility),
    services: [...names(l.services), ...names(l.amenities)],
    complete: completeness(l, hours),
  }
}

export default factories.createCoreController(
  "api::library.library",
  ({ strapi }) => ({
    /**
     * GET /libraries/map-pins
     * Returns libraries with location data for map rendering.
     * Accepts one of: regionSlug, countrySlug, continentSlug
     */
    async mapPins(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const status = q.status === "draft" ? "draft" : "published"

      const filters: Record<string, unknown> = {}
      if (q.areaSlug) {
        filters.area = { slug: { $eq: q.areaSlug } }
      } else if (q.regionSlug) {
        filters.region = { slug: { $eq: q.regionSlug } }
      } else if (q.countrySlug) {
        filters.country = { slug: { $eq: q.countrySlug } }
      } else if (q.continentSlug) {
        filters.continent = { slug: { $eq: q.continentSlug } }
      }

      // Optional type / status filters (comma-separated values)
      if (q.libraryTypes) {
        const types = q.libraryTypes.split(",").filter(Boolean)
        if (types.length > 0) filters.libraryType = { $in: types }
      }
      if (q.operationalStatuses) {
        const statuses = q.operationalStatuses.split(",").filter(Boolean)
        if (statuses.length > 0) filters.operationalStatus = { $in: statuses }
      }

      const results = await strapi.documents("api::library.library").findMany({
        filters: filters as never,
        fields: [
          "name",
          "slug",
          "libraryType",
          "operationalStatus",
          "city",
          "location",
          "summary",
        ],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
          heroImage: { fields: ["url"] },
        } as never,
        locale,
        status,
        pagination: { pageSize: 500, page: 1 },
      })

      // Only return entries that have valid { lat, lng } location data
      const pins = results.filter((lib: unknown) => {
        const l = lib as { location?: unknown }
        if (
          !l.location ||
          typeof l.location !== "object" ||
          Array.isArray(l.location)
        )
          return false
        const { lat, lng } = l.location as { lat?: unknown; lng?: unknown }

        return typeof lat === "number" && typeof lng === "number"
      })

      ctx.body = { data: pins, meta: { total: pins.length } }
    },

    /**
     * GET /libraries/atlas
     * Every published library as a compact GeoJSON FeatureCollection for the
     * Atlas Explorer map. Filtering happens client-side, so this carries the
     * filterable fields (type, status, operator, hours, facilities…) rather
     * than display copy. Detail comes from the normal library endpoints when a
     * pin is opened.
     */
    async atlas(ctx) {
      const q = ctx.query as Record<string, string | undefined>
      const locale = typeof q.locale === "string" ? q.locale : undefined
      const PAGE = 500
      const rows: AtlasSource[] = []
      for (let page = 1; page <= 200; page++) {
        const batch = (await strapi.documents("api::library.library").findMany({
          fields: [
            "name",
            "slug",
            "libraryType",
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
            "streetAddress",
            "summary",
            "description",
            "website",
            "phone",
            "email",
          ],
          populate: {
            continent: { fields: ["slug"] },
            country: { fields: ["slug", "name"] },
            region: { fields: ["slug", "name"] },
            heroImage: { fields: ["url"] },
            accessibility: { fields: ["name"] },
            services: { fields: ["name"] },
            amenities: { fields: ["name"] },
            collectionStats: true,
          } as never,
          locale,
          status: "published",
          pagination: { page, pageSize: PAGE },
        })) as unknown as AtlasSource[]
        rows.push(...batch)
        if (batch.length < PAGE) break
      }

      const features = rows.flatMap((lib) => {
        const loc = lib.location as { lat?: unknown; lng?: unknown } | null
        if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number")
          return []

        return [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
            properties: toAtlasProperties(lib),
          },
        ]
      })

      ctx.set("Cache-Control", "public, max-age=300")
      ctx.body = { type: "FeatureCollection", features }
    },
  })
)
