import { normalizeMobileTimetable } from "@repo/shared-data"
import { afterEach, describe, expect, it, vi } from "vitest"

import { fixtureMobileTimetable } from "../../../../../../qa/tests/playwright/helpers/access-fixtures"
import { fetchRoadRoutes } from "../road-routes"
import { routeItineraries } from "../route-itineraries"
import type { PublicMobileTimetable } from "../types"

const library: PublicMobileTimetable = {
  documentId: "mobile",
  name: "Demo",
  path: null,
  timezone: "Europe/London",
  status: "open",
  updatedAt: "2026-10-08",
  notices: [],
  timetable: normalizeMobileTimetable(fixtureMobileTimetable()),
}
const date = "2026-10-08"
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("mobile road routing", () => {
  it("shows the complete cycle in All stops and only the chosen days in today/week", () => {
    const all = routeItineraries(library, date, "any")
    const today = routeItineraries(library, date, "today")
    expect(today).toHaveLength(1)
    expect(all.length).toBeGreaterThan(today.length)
    expect(new Set(all.flatMap((route) => route.stopIds)).size).toBe(6)
    expect(today[0]?.stopIds).toEqual([
      "stopfx0001",
      "stopfx0003",
      "stopfx0005",
      "stopfx0006",
    ])
    expect(routeItineraries(library, date, "week").length).toBeLessThan(
      all.length
    )
  })
  it("doesn't bridge an unlocated stop or draw across different days", () => {
    const timetable = structuredClone(library.timetable!)
    timetable.stops.find((stop) => stop.id === "stopfx0003")!.location = null
    const routes = routeItineraries({ ...library, timetable }, date, "today")
    expect(routes.map((route) => route.stopIds)).toEqual([
      ["stopfx0005", "stopfx0006"],
    ])
    expect(
      routeItineraries(
        { ...library, status: "permanently_closed" },
        date,
        "any"
      )
    ).toEqual([])
  })
  it("requests driving geometry in timetable order and preserves the road bends", async () => {
    const geometry = {
      type: "LineString",
      coordinates: [
        [-5.070423, 50.153944],
        [-5.075, 50.15],
        [-5.092492, 50.148025],
        [-5.077968, 50.154345],
        [-5.076207, 50.151915],
      ],
    }
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ code: "Ok", routes: [{ geometry }] }))
    vi.stubGlobal("fetch", fetch)
    const result = await fetchRoadRoutes(library, date, "today")
    expect(result.routes[0]?.geometry).toEqual(geometry)
    expect(result.unavailable).toBe(false)
    const url = new URL(String(fetch.mock.calls[0]![0]))
    expect(url.pathname).toContain(
      "/route/v1/driving/-5.070423,50.153944;-5.092492,50.148025;-5.077968,50.154345;-5.076207,50.151915"
    )
    expect(url.searchParams.get("radiuses")).toBe("100;100;100;100")
  })
  it("keeps unavailable or invalid road geometry out of the map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ code: "NoRoute" }))
    )
    expect(await fetchRoadRoutes(library, date, "today")).toEqual({
      routes: [],
      unavailable: true,
    })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await fetchRoadRoutes(library, date, "today")).toEqual({
      routes: [],
      unavailable: true,
    })
  })
})
