/**
 * Places a libraryOn record in the atlas's own UK places. The world place
 * import made England's Regions the ceremonial counties and its Areas the 296
 * districts (with GSS codes); Scotland's, Wales's and Northern Ireland's
 * Regions are their councils. libraryOn's authority slug fits none of that
 * (a unitary council or a pre-2015 NI county is not a Region), so the
 * library's coordinates decide: postcodes.io (ONS data, OGL v3) gives the
 * council at that point, matched to an English Area by GSS code and to any
 * other Region by name. Nothing here creates a place.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { normaliseName } from "./ingests/gazetteer/match"

/** The council a point falls in, as postcodes.io names it. */
export interface District {
  /** "England", "Scotland", "Wales" or "Northern Ireland". */
  country: string
  name: string
  /** GSS code, e.g. "E07000039". */
  code: string
}

export const COUNTRY_SLUG: Record<string, string> = {
  England: "england",
  Scotland: "scotland",
  Wales: "wales",
  "Northern Ireland": "northern-ireland",
}

/** postcodes.io's spelling → the atlas's, where normalising can't join them. */
const REGION_ALIASES: Record<string, string> = {
  "Na h-Eileanan Siar": "Nah-Eileanan Siar",
}

export interface PlaceIndex {
  /** England: district GSS code → its Area and the Area's Region. */
  areasByGss: Map<string, { regionId: string; areaId: string }>
  /** `regionKey(country, name)` → every Region with that name. */
  regionsByName: Map<string, string[]>
}

export type Placement =
  | { countrySlug: string; regionId: string; areaId: string | null }
  | { error: string }

export function regionKey(countrySlug: string, name: string): string {
  return `${countrySlug}:${normaliseName(REGION_ALIASES[name] ?? name)}`
}

export function placeLibrary(
  district: District | null,
  index: PlaceIndex
): Placement {
  if (!district) return { error: "no council found at its location" }
  const countrySlug = COUNTRY_SLUG[district.country]
  if (!countrySlug)
    return { error: `outside the four UK nations (${district.country})` }

  if (countrySlug === "england") {
    const hit = index.areasByGss.get(district.code)

    return hit
      ? { countrySlug, ...hit }
      : { error: `no Area with GSS code ${district.code} (${district.name})` }
  }

  const hits =
    index.regionsByName.get(regionKey(countrySlug, district.name)) ?? []
  if (hits.length === 1)
    return { countrySlug, regionId: hits[0]!, areaId: null }

  return {
    error:
      hits.length === 0
        ? `no Region named ${district.name} in ${district.country}`
        : `${hits.length} Regions named ${district.name} in ${district.country}`,
  }
}

// ── postcodes.io ──────────────────────────────────────────────────────────────

const POSTCODES_IO = "https://api.postcodes.io/postcodes"
const BATCH = 100 // postcodes.io's bulk limit

export interface Point {
  lat: number
  lng: number
  postcode?: string | null
}

interface PostcodeResult {
  country: string
  admin_district: string | null
  codes: { admin_district: string }
}

const pointKey = (p: Point) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`

function toDistrict(r: PostcodeResult | null | undefined): District | null {
  if (!r?.admin_district || !r.codes?.admin_district) return null

  return {
    country: r.country,
    name: r.admin_district,
    code: r.codes.admin_district,
  }
}

async function post<T>(body: unknown): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(POSTCODES_IO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) return ((await res.json()) as { result: T }).result
      if (res.status < 500 && res.status !== 429)
        throw new Error(`postcodes.io ${res.status}: ${await res.text()}`)
      if (attempt >= 3) throw new Error(`postcodes.io ${res.status}`)
    } catch (err) {
      if (attempt >= 3) throw err
    }
    await new Promise((r) => setTimeout(r, attempt * 2000))
  }
}

/**
 * Each point's council: the nearest postcode within 2 km, else the record's
 * own postcode. Answers are cached in `cacheFile` by coordinates, so a re-run
 * only asks about records whose location changed.
 */
export async function districtsFor(
  points: Point[],
  cacheFile: string
): Promise<(District | null)[]> {
  const cache: Record<string, District | null> = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, "utf8"))
    : {}
  const missing = points.filter((p) => !(pointKey(p) in cache))

  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    const near = await post<{ result: PostcodeResult[] | null }[]>({
      geolocations: batch.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
        radius: 2000,
        limit: 1,
      })),
    })
    const unplaced: Point[] = []
    batch.forEach((p, j) => {
      const d = toDistrict(near[j]?.result?.[0])
      if (d || !p.postcode) cache[pointKey(p)] = d
      else unplaced.push(p)
    })
    if (unplaced.length > 0) {
      const byPostcode = await post<{ result: PostcodeResult | null }[]>({
        postcodes: unplaced.map((p) => p.postcode),
      })
      unplaced.forEach((p, j) => {
        cache[pointKey(p)] = toDistrict(byPostcode[j]?.result)
      })
    }
  }

  if (missing.length > 0) {
    mkdirSync(path.dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
  }

  return points.map((p) => cache[pointKey(p)] ?? null)
}
