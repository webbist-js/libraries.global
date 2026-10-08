import {
  dayRoute,
  localDateTime,
  type PublicLiveState,
} from "@repo/shared-data"

import type { PublicMobileTimetable } from "@/lib/mobile/types"
import type { MobileStopHit } from "@/lib/mobile-stop-search"

export function coarseRing(lat: number, lng: number) {
  const dy = 250 / 111_320,
    dx = dy / Math.max(0.01, Math.cos((lat * Math.PI) / 180))

  return Array.from({ length: 49 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 48

    return [lng + dx * Math.cos(angle), lat + dy * Math.sin(angle)]
  })
}

export function mobileMapData(
  stops: MobileStopHit[],
  clusters: { lat: number; lng: number; count: number }[],
  libraries: PublicMobileTimetable[],
  live: Record<string, PublicLiveState>,
  now: Date
) {
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [],
    vehicles: GeoJSON.Feature<GeoJSON.Point>[] = [],
    rings: GeoJSON.Feature<GeoJSON.Polygon>[] = []
  const numbers = new Map<string, string>()
  for (const library of libraries.slice(0, 25)) {
    if (!library.timetable || library.status === "permanently_closed") continue
    const date = localDateTime(now, library.timezone).date
    const route = dayRoute(library.timetable, library.notices, date).filter(
      (row) => !row.cancelledBy
    )
    const state = live[library.documentId],
      fresh =
        !!state &&
        state.sharesLive &&
        ["here", "road", "late"].includes(state.kind)
    route.forEach((visit, i) =>
      numbers.set(`${library.documentId}_${visit.stopId}`, String(i + 1))
    )
    const coords = route.flatMap((visit) => {
      const stop = library.timetable!.stops.find(
        (row) => row.id === visit.stopId
      )

      return stop?.location ? [[stop.location.lng, stop.location.lat]] : []
    })
    if (coords.length > 1)
      lines.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { library: library.documentId, live: fresh },
      })
    if (!fresh) continue
    const stop = library.timetable.stops.find((row) => row.id === state.stopId)
    const next = library.timetable.stops.find(
      (row) => row.id === state.nextStopId
    )
    const between = !state.until && state.nextStopId
    const midpoint =
      between && stop?.location && next?.location
        ? {
            lat: (stop.location.lat + next.location.lat) / 2,
            lng:
              ((stop.location.lng +
                (((next.location.lng - stop.location.lng + 540) % 360) - 180) /
                  2 +
                540) %
                360) -
              180,
          }
        : null
    const position = state.position ?? (between ? midpoint : stop?.location)
    if (!position) continue
    vehicles.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [position.lng, position.lat] },
      properties: { library: library.documentId, label: library.name },
    })
    if (state.position)
      rings.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [coarseRing(position.lat, position.lng)],
        },
        properties: { library: library.documentId },
      })
  }

  return {
    stops: {
      type: "FeatureCollection" as const,
      features: stops.flatMap((stop) =>
        stop._geo
          ? [
              {
                type: "Feature" as const,
                geometry: {
                  type: "Point" as const,
                  coordinates: [stop._geo.lng, stop._geo.lat],
                },
                properties: {
                  id: stop.id,
                  label: stop.name,
                  number: numbers.get(stop.id) ?? "",
                },
              },
            ]
          : []
      ),
    },
    clusters: {
      type: "FeatureCollection" as const,
      features: clusters.map((cluster) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [cluster.lng, cluster.lat],
        },
        properties: { count: cluster.count },
      })),
    },
    routes: { type: "FeatureCollection" as const, features: lines },
    vehicles: { type: "FeatureCollection" as const, features: vehicles },
    rings: { type: "FeatureCollection" as const, features: rings },
  }
}
