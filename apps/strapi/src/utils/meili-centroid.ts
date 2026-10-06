/**
 * The mean `_geo` position of one page of libraries matching a Meilisearch
 * filter: a drive's "baseline.centroid" (spec §5.1), the point a drive's
 * "Near me" ordering measures against. One 1,000-hit page is a sample, not
 * every task, but it's a stable-enough centre for that purpose (ADR-0004: a
 * full scan is never on the table).
 */

type GeoHit = { _geo?: { lat?: unknown; lng?: unknown } }

/** The number form of `v`, or `null` when it isn't finite. */
function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v)

  return Number.isFinite(n) ? n : null
}

/**
 * The mean `_geo` of up to 1,000 libraries matching `filter`, or `null`
 * when none of them carry a location. Throws on a non-2xx response.
 */
export async function centroidOf(
  filter: string
): Promise<{ lat: number; lng: number } | null> {
  const host = process.env.MEILISEARCH_HOST ?? "http://localhost:7700"
  const apiKey = process.env.MEILISEARCH_ADMIN_API_KEY ?? ""

  const res = await fetch(`${host}/indexes/library/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      q: "",
      filter,
      limit: 1000,
      attributesToRetrieve: ["_geo"],
    }),
  })

  if (!res.ok) {
    throw new Error(
      `Meilisearch centroid search failed: ${res.status} ${res.statusText}`
    )
  }

  const json = (await res.json()) as { hits?: GeoHit[] }
  let sumLat = 0
  let sumLng = 0
  let count = 0

  for (const hit of json.hits ?? []) {
    const lat = toFiniteNumber(hit._geo?.lat)
    const lng = toFiniteNumber(hit._geo?.lng)
    if (lat === null || lng === null) continue
    sumLat += lat
    sumLng += lng
    count += 1
  }

  return count > 0 ? { lat: sumLat / count, lng: sumLng / count } : null
}
