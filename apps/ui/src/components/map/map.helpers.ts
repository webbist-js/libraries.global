// ── Basemap ───────────────────────────────────────────────────────────────────

/**
 * Credit for the CARTO Voyager basemap. Its style JSON carries no attribution,
 * and both OpenStreetMap (ODbL) and CARTO's terms require one on the map.
 */
export const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'

// ── Bounding box parser ───────────────────────────────────────────────────────

export function parseBounds(
  ne: string | null | undefined,
  sw: string | null | undefined
) {
  if (!ne || !sw) return null
  const neParts = ne.split(",").map(Number)
  const swParts = sw.split(",").map(Number)
  const neLat = neParts[0]
  const neLng = neParts[1]
  const swLat = swParts[0]
  const swLng = swParts[1]
  if (
    neLat === undefined ||
    neLng === undefined ||
    swLat === undefined ||
    swLng === undefined ||
    Number.isNaN(neLat) ||
    Number.isNaN(neLng) ||
    Number.isNaN(swLat) ||
    Number.isNaN(swLng)
  ) {
    return null
  }

  return { neLat, neLng, swLat, swLng } as const
}
