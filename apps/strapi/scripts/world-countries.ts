/**
 * Pure mapping from the boundary seed (apps/ui/public/boundaries/seed-data.json)
 * to Strapi Country rows. No I/O: populate-world-countries.ts does the writes.
 *
 * The seed's `continents/<name>` keys hold one array of countries per
 * continent (Natural Earth). The Americas come as a single `americas` list;
 * Strapi has `north-america` and `south-america` and never `americas`, so
 * the list is split by ISO code. Other keys (`countries/*`, `regions/*`)
 * describe sub-country features and are ignored.
 */

export type ContinentSlug =
  | "africa"
  | "asia"
  | "europe"
  | "oceania"
  | "north-america"
  | "south-america"

export type SeedCountry = {
  name: string
  code: string
  slug: string
  centroidLat: number
  centroidLng: number
  bboxNorth: number
  bboxSouth: number
  bboxEast: number
  bboxWest: number
  boundaryUrl: string
  sourceAttribution: string
}

/** ISO 3166-1 alpha-2 codes of the South American countries and territories. */
export const SOUTH_AMERICA_ISO2: ReadonlySet<string> = new Set([
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "EC",
  "GY",
  "PY",
  "PE",
  "SR",
  "UY",
  "VE",
  "FK",
  "GF",
])

const PASS_THROUGH: ReadonlySet<string> = new Set([
  "africa",
  "asia",
  "europe",
  "oceania",
  "north-america",
  "south-america",
])

/**
 * Natural Earth gives some countries a placeholder code ("-99") or a
 * non-ISO one. Known sovereign countries get their real code back; anything
 * else (disputed or uninhabited features) gets no iso2.
 */
const ISO2_OVERRIDES: Readonly<Record<string, string>> = {
  france: "FR",
  norway: "NO",
  kosovo: "XK",
  taiwan: "TW",
}

/**
 * The Strapi continent slug for a seed country. `seedContinent` is the seed
 * key or its suffix (`continents/americas` or `americas`). An American
 * feature without an ISO code falls back to its centroid: south of the
 * equator is South America.
 */
export function continentSlugFor(
  seedContinent: string,
  iso2: string,
  centroidLat?: number
): ContinentSlug {
  const key = seedContinent.replace(/^continents\//, "").toLowerCase()
  if (key === "americas") {
    const code = iso2.toUpperCase()
    if (SOUTH_AMERICA_ISO2.has(code)) return "south-america"
    if (
      !/^[A-Z]{2}$/.test(code) &&
      centroidLat !== undefined &&
      centroidLat < 0
    )
      return "south-america"

    return "north-america"
  }
  if (PASS_THROUGH.has(key)) return key as ContinentSlug

  throw new Error(`Unknown seed continent: ${seedContinent}`)
}

/** The ISO 3166-1 alpha-2 code to store, or null when the seed has none. */
export function iso2For(c: SeedCountry): string | null {
  const override = ISO2_OVERRIDES[c.slug]
  if (override) return override
  const code = String(c.code ?? "").toUpperCase()

  return /^[A-Z]{2}$/.test(code) ? code : null
}

function isSeedCountry(v: unknown): v is SeedCountry {
  if (!v || typeof v !== "object") return false
  const o = v as Record<string, unknown>

  return (
    typeof o.name === "string" &&
    o.name.length > 0 &&
    typeof o.slug === "string" &&
    o.slug.length > 0 &&
    typeof o.code === "string" &&
    [
      "centroidLat",
      "centroidLng",
      "bboxNorth",
      "bboxSouth",
      "bboxEast",
      "bboxWest",
    ].every((k) => typeof o[k] === "number" && Number.isFinite(o[k]))
  )
}

/** Every country in the seed's `continents/*` lists, with its Strapi continent. */
export function countriesFromSeed(
  seed: Record<string, unknown>
): { continentSlug: string; country: SeedCountry }[] {
  const out: { continentSlug: string; country: SeedCountry }[] = []
  for (const [key, value] of Object.entries(seed)) {
    if (!key.startsWith("continents/") || !Array.isArray(value)) continue
    for (const entry of value) {
      if (!isSeedCountry(entry)) continue
      out.push({
        continentSlug: continentSlugFor(key, entry.code, entry.centroidLat),
        country: entry,
      })
    }
  }

  return out
}

/** A zoom level that roughly fits the bounding box, clamped to 2–10. */
function zoomFor(c: SeedCountry): number {
  const latSpan = Math.abs(c.bboxNorth - c.bboxSouth)
  const lngSpan = Math.abs(c.bboxEast - c.bboxWest)
  const span = Math.max(latSpan, lngSpan, 0.01)
  const zoom = Math.round(Math.log2(360 / span))

  return Math.min(10, Math.max(2, zoom))
}

/**
 * The `shared.map-config` component for a country. Bounding boxes are
 * "lat,lng" strings, as `parseBounds` in the UI's map.helpers.ts reads them.
 */
export function mapConfigFor(c: SeedCountry): Record<string, unknown> {
  return {
    centerLat: c.centroidLat,
    centerLng: c.centroidLng,
    defaultZoom: zoomFor(c),
    boundingBoxNE: `${c.bboxNorth},${c.bboxEast}`,
    boundingBoxSW: `${c.bboxSouth},${c.bboxWest}`,
    mapStyle: "standard",
  }
}

/**
 * Splits seed rows into those with a valid ISO 3166-1 alpha-2 code (after
 * `iso2For`) and those without. Rows without one (disputed or uninhabited
 * Natural Earth features such as Bir Tawil) are never imported as countries.
 */
export function splitByIso2<T extends { country: SeedCountry }>(
  rows: T[]
): { importable: T[]; skipped: T[] } {
  const importable: T[] = []
  const skipped: T[] = []
  for (const row of rows)
    (iso2For(row.country) ? importable : skipped).push(row)

  return { importable, skipped }
}
