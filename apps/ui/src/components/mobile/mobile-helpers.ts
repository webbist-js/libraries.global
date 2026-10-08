import type { MobileStop } from "@repo/shared-data"

export function stopDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const rad = Math.PI / 180,
    dy = (b.lat - a.lat) * rad,
    dx = (b.lng - a.lng) * rad

  return (
    6371 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dy / 2) ** 2 +
            Math.cos(a.lat * rad) *
              Math.cos(b.lat * rad) *
              Math.sin(dx / 2) ** 2
        )
      )
    )
  )
}
export function nearestStops(
  stops: MobileStop[],
  location: { lat: number; lng: number }
) {
  return stops
    .flatMap((stop) =>
      stop.location
        ? [{ stop, km: stopDistanceKm(location, stop.location) }]
        : []
    )
    .sort((a, b) => a.km - b.km)
    .slice(0, 5)
}
export function stopDirections(stop: MobileStop) {
  return stop.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${stop.location.lat},${stop.location.lng}`
    : null
}
