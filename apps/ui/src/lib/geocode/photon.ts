import "server-only"

import { type Place, toPlaces } from "./place"

// komoot's public Photon: OpenStreetMap data, no key, fair use. Set
// PHOTON_URL to use a self-hosted Photon instead.
const DEFAULT_URL = "https://photon.komoot.io"
const USER_AGENT =
  "libraries.global (https://libraries.global; info@libraries.global)"

async function photon(
  path: "/api" | "/reverse",
  params: Record<string, string>
): Promise<Place[]> {
  const base = process.env.PHOTON_URL || DEFAULT_URL
  const url = new URL(`${base.endsWith("/") ? base.slice(0, -1) : base}${path}`)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    // The same query gives everyone the same places: keep answers a day.
    next: { revalidate: 86_400 },
  })
  if (!res.ok) throw new Error(`Photon answered ${res.status}`)

  return toPlaces(await res.json())
}

/** Up to six places matching a name or address. Throws when Photon fails. */
export function searchPlaces(query: string): Promise<Place[]> {
  return photon("/api", { q: query, limit: "6", lang: "en" })
}

/**
 * The place nearest a point, or null. The point is rounded to five decimal
 * places (about a metre) so nearby pins share a cache entry. Throws when
 * Photon fails.
 */
export async function reversePlace(
  lat: number,
  lng: number
): Promise<Place | null> {
  const [place] = await photon("/reverse", {
    lat: lat.toFixed(5),
    lon: lng.toFixed(5),
    limit: "1",
    lang: "en",
  })

  return place ?? null
}
