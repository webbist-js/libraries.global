// Latitude and longitude as the Index editor stores them: decimal degrees
// in text boxes.

export const isLatitude = (n: number) => Number.isFinite(n) && Math.abs(n) <= 90
export const isLongitude = (n: number) =>
  Number.isFinite(n) && Math.abs(n) <= 180

const DECIMAL = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/

/** A typed coordinate as a number: plain decimal degrees, else NaN. */
export function readCoord(text: string): number {
  const t = text.trim()

  return DECIMAL.test(t) ? Number(t) : Number.NaN
}

/** Six decimal places (about 10 cm) without trailing zeros: "51.5297". */
export function formatCoord(n: number): string {
  return String(Number(n.toFixed(6)) || 0)
}

/** Whether a latitude or longitude box is blank or holds a number in range. */
export function coordIsValid(axis: "lat" | "lng", text: string): boolean {
  if (!text.trim()) return true
  const n = readCoord(text)

  return axis === "lat" ? isLatitude(n) : isLongitude(n)
}

/**
 * Both coordinates from one pasted string: "51.5297, -0.1271" (as Google
 * Maps copies them), "51.5297 -0.1271" or "(51.5297, -0.1271)". Null unless
 * there are exactly two numbers and both are in range.
 */
export function parseCoordinatePair(
  text: string
): { lat: number; lng: number } | null {
  const parts = text
    .trim()
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(/[\s,]+/)
    .filter(Boolean)
  if (parts.length !== 2) return null
  const lat = readCoord(parts[0] ?? "")
  const lng = readCoord(parts[1] ?? "")

  return isLatitude(lat) && isLongitude(lng) ? { lat, lng } : null
}
