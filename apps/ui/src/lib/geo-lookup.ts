// apps/ui/src/lib/geo-lookup.ts
// Nominatim (OpenStreetMap) geocoding — no API key required.
// Nominatim usage policy requires a descriptive User-Agent.

import { CONTINENT_COUNTRIES } from "@/lib/data/continents"
import { COUNTRIES } from "@/lib/data/countries"

export interface GeoResult {
  lat: number
  lng: number
  /** ISO 3166-1 alpha-2, upper-case e.g. "GB" */
  countryCode: string | null
  /** Our country slug e.g. "united-kingdom" */
  countrySlug: string | null
  /** Our continent slug e.g. "europe" */
  continentSlug: string | null
  displayName: string
}

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
  address?: {
    country_code?: string
  }
}

/** Resolve a free-text place name to lat/lng + country/continent slugs. */
export async function geocodePlaceName(
  query: string
): Promise<GeoResult | null> {
  if (query.trim().length < 2) return null

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "libraries.global/1.0 (https://libraries.global)",
      },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as NominatimHit[]
    if (!data.length) return null

    const hit = data[0]
    const iso2 = (hit.address?.country_code ?? "").toUpperCase()
    const country = COUNTRIES.find((c) => c.code === iso2) ?? null
    const continentSlug = iso2 ? resolveContinent(iso2) : null

    return {
      lat: Number.parseFloat(hit.lat),
      lng: Number.parseFloat(hit.lon),
      countryCode: iso2 || null,
      countrySlug: country?.slug ?? null,
      continentSlug,
      displayName: hit.display_name,
    }
  } catch {
    return null
  }
}

function resolveContinent(iso2: string): string | null {
  for (const [slug, codes] of Object.entries(CONTINENT_COUNTRIES)) {
    if (codes.includes(iso2)) return slug
  }

  return null
}
