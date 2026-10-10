import { addDays, dayRoute } from "@repo/shared-data"

import type { MobileVisitFilter } from "@/lib/mobile-stop-search"

import type { PublicMobileTimetable } from "./types"

export type RoadItinerary = {
  stopIds: string[]
  coordinates: [number, number][]
}

/** Each day's order comes from the timetable. Never join different service days
 * or bridge a stop without a pin. Five weeks covers every cycle and monthly visit. */
export function routeItineraries(
  library: PublicMobileTimetable,
  date: string,
  mode: MobileVisitFilter
): RoadItinerary[] {
  const tt = library.timetable
  if (!tt || library.status === "permanently_closed") return []
  const dates = new Set(
    Array.from(
      { length: mode === "any" ? 35 : mode === "week" ? 7 : 1 },
      (_, i) => addDays(date, i)
    )
  )
  if (mode === "any")
    for (const visit of tt.visits)
      if (visit.repeat.kind === "dates")
        for (const day of visit.repeat.dates)
          if (day >= date && day <= addDays(date, 365)) dates.add(day)
  const stops = new Map(tt.stops.map((stop) => [stop.id, stop]))
  const unique = new Map<string, RoadItinerary>()
  for (const day of [...dates].sort().slice(0, 100)) {
    let segment: RoadItinerary = { stopIds: [], coordinates: [] }
    const flush = () => {
      if (segment.coordinates.length > 1)
        unique.set(segment.stopIds.join(","), segment)
      segment = { stopIds: [], coordinates: [] }
    }
    for (const visit of dayRoute(tt, library.notices, day).filter(
      (visit) => !visit.cancelledBy
    )) {
      const stop = stops.get(visit.stopId)
      if (!stop?.location) {
        flush()
        continue
      }
      segment.stopIds.push(stop.id)
      segment.coordinates.push([stop.location.lng, stop.location.lat])
    }
    flush()
  }

  return [...unique.values()]
}
