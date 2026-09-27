import type { LibraryMapPin } from "./map.types"

// ── Layer / source ID constants ───────────────────────────────────────────────

export const LIBRARY_LAYERS = [
  "library-clusters",
  "library-cluster-count",
  "library-pins",
] as const

export const LIBRARY_SOURCES = ["libraries"] as const
export const GEO_LAYERS = ["geo-fills", "geo-outlines"] as const
export const GEO_SOURCES = ["geo-areas"] as const

// ── Basemap ───────────────────────────────────────────────────────────────────

/**
 * Credit for the CARTO Voyager basemap. Its style JSON carries no attribution,
 * and both OpenStreetMap (ODbL) and CARTO's terms require one on the map.
 */
export const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'

// ── Label maps ────────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<string, string> = {
  national: "National",
  public: "Public",
  academic: "Academic",
  special: "Special",
  government: "Government",
  school: "School",
  digital: "Digital",
  preservation: "Preservation",
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const

export function getTodayHours(
  openingTimes: unknown
): { timeRange: string; closesIn: string | null; isOpen: boolean } | null {
  if (!openingTimes || typeof openingTimes !== "object") return null
  const data = openingTimes as {
    days?: {
      day: string
      enabled: boolean
      timeframes: { startTime: string; endTime: string }[]
    }[]
  }
  if (!Array.isArray(data.days)) return null

  const todayKey = DAY_KEYS[new Date().getDay()]
  const todayEntry = data.days.find((d) => d.day === todayKey)
  if (!todayEntry?.enabled || !todayEntry.timeframes?.length) return null

  const firstTf = todayEntry.timeframes[0]!
  const lastTf = todayEntry.timeframes.at(-1)!
  const timeRange = `${firstTf.startTime} – ${lastTf.endTime}`

  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const openMin = timeToMinutes(firstTf.startTime)
  const closeMin = timeToMinutes(lastTf.endTime)

  if (cur < openMin || cur >= closeMin) {
    return { timeRange, closesIn: null, isOpen: false }
  }

  const remaining = closeMin - cur
  const h = Math.floor(remaining / 60)
  const m = remaining % 60
  const closesIn = h > 0 ? `closes in ${h}h ${m}m` : `closes in ${m}m`

  return { timeRange, closesIn, isOpen: true }
}

// ── Coordinate formatting ─────────────────────────────────────────────────────

export function formatCoord(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`
  const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`

  return `${latStr} ${lngStr}`
}

// ── Operational status label ──────────────────────────────────────────────────

export function operationalLabel(status?: string | null): string {
  switch (status) {
    case "open":
      return "Open"
    case "temporarily_closed":
      return "Temporarily Closed"
    case "permanently_closed":
      return "Permanently Closed"
    case "seasonal":
      return "Seasonal"
    case "appointment_only":
      return "By Appointment"

    default:
      return "Unknown"
  }
}

// ── URL builders ──────────────────────────────────────────────────────────────

export function buildLibraryHref(pin: LibraryMapPin): string | null {
  const c = pin.continent?.slug
  const co = pin.country?.slug
  const r = pin.region?.slug
  const s = pin.slug
  if (c && co && r && s) return `/${c}/${co}/${r}/${s}`

  return null
}

// ── API fetch helper ──────────────────────────────────────────────────────────

export async function fetchMapPins<T>(
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const query = new URLSearchParams(params)
  try {
    const res = await fetch(`/api/public-proxy/api/${path}?${query}`)
    if (!res.ok) return []
    const json = (await res.json()) as { data?: T[] }

    return json.data ?? []
  } catch {
    return []
  }
}

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
