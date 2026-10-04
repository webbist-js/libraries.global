// The browser's side of the geocoding proxy (/api/geocode/*).

import type { Place } from "./place"

/** Places matching `query`. Throws when the search is down or limited. */
export async function findPlaces(
  query: string,
  signal?: AbortSignal
): Promise<Place[]> {
  const res = await fetch(
    `/api/geocode/search?q=${encodeURIComponent(query)}`,
    { signal }
  )
  if (!res.ok) throw new Error(`Location search failed: ${res.status}`)
  const json = (await res.json()) as { data?: Place[] }

  return json.data ?? []
}

/** The place nearest a point, or null when there's none or it failed. */
export async function placeNear(
  lat: number,
  lng: number
): Promise<Place | null> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Place | null }

    return json.data ?? null
  } catch {
    return null
  }
}
