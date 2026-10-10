import "server-only"

import type { MobileVisitFilter } from "@/lib/mobile-stop-search"

import { routeItineraries } from "./route-itineraries"
import type { PublicMobileTimetable, MobileRoadRoute } from "./types"

/** The host is deployment configuration, never a request parameter. Public stop
 * coordinates only; live positions are never sent to the routing provider. */
export async function fetchRoadRoutes(
  library: PublicMobileTimetable,
  date: string,
  mode: MobileVisitFilter
) {
  const itineraries = routeItineraries(library, date, mode)
  const routes: MobileRoadRoute[] = []
  let unavailable = false
  // Bound work independently of the worldwide stop index.
  if (
    itineraries.length > 40 ||
    itineraries.some((route) => route.coordinates.length > 100)
  )
    return { routes, unavailable: true }
  const host =
    process.env.MOBILE_ROUTING_URL ?? "https://router.project-osrm.org"
  for (let i = 0; i < itineraries.length; i += 2) {
    const results = await Promise.allSettled(
      itineraries.slice(i, i + 2).map(async (itinerary) => {
        const url = new URL(
          `/route/v1/driving/${itinerary.coordinates.map((point) => point.join(",")).join(";")}`,
          host
        )
        url.search = new URLSearchParams({
          geometries: "geojson",
          overview: "full",
          steps: "false",
          alternatives: "false",
          continue_straight: "false",
          radiuses: itinerary.coordinates.map(() => "100").join(";"),
        }).toString()
        const response = await fetch(url, {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(8000),
        })
        if (!response.ok) throw new Error("Road routing unavailable")
        const data = await response.json()
        const geometry = data.routes?.[0]?.geometry
        if (
          data.code !== "Ok" ||
          geometry?.type !== "LineString" ||
          !Array.isArray(geometry.coordinates) ||
          geometry.coordinates.length < 2 ||
          geometry.coordinates.length > 20000 ||
          !geometry.coordinates.every(
            (point: unknown) =>
              Array.isArray(point) &&
              point.length === 2 &&
              point.every(Number.isFinite) &&
              Math.abs(point[0]) <= 180 &&
              Math.abs(point[1]) <= 90
          )
        )
          throw new Error("Invalid road route")

        return { stopIds: itinerary.stopIds, geometry } as MobileRoadRoute
      })
    )
    for (const result of results) {
      if (result.status === "fulfilled") routes.push(result.value)
      else unavailable = true
    }
  }

  return { routes, unavailable }
}
