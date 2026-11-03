import { describe, expect, it } from "vitest"

import { betaPublicRequest } from "@/lib/beta/scope"
import { needsBasicAuth } from "@/lib/proxies/basic-auth-scope"

import { isTeamApiPath, teamApiPlaceRoute } from "../paths"

describe("API keys work without browser beta or Basic Auth cookies", () => {
  it.each([
    "/api/v1/libraries",
    "/api/v1/libraries/GB-BL-001",
    "/api/v1/libraries/europe:united-kingdom:scotland:national-library-of-scotland",
    "/api/v1/libraries/europe%3Aunited-kingdom%3Ascotland%3Anational-library-of-scotland",
    "/api/v1/search/libraries",
    "/api/v1/places",
    "/api/v1/places/england",
    "/api/v1/places/england/norfolk",
    "/api/v1/places/england/libraries",
    "/api/v1/places/england/norfolk/broadland/libraries",
  ])("exempts only the implemented machine route %s", (path) => {
    expect(isTeamApiPath(path)).toBe(true)
    expect(needsBasicAuth(path)).toBe(false)
    expect(
      betaPublicRequest(path, path.includes("/search/") ? "POST" : "GET")
    ).toBe(true)
  })
  it.each([
    "/api/v1/admin",
    "/api/v1/libraries/export",
    "/api/v1/libraries/library00000000000000001",
    "/api/v1/libraries/europe%3Agb%3Aeng%3Abad%2Fpath",
    "/api/v1/libraries/europe%253Agb%253Aeng%253Acentral",
    "/api/v1/libraries/europe%3Agb%3Aeng%3A%ZZ",
    `/api/v1/libraries/europe:gb:eng:${"x".repeat(256)}`,
    "/api/v1/libraries/../users",
    "/api/v1/libraries-x",
    "/api/staff/team/team000000000000000001/api",
    "/api/v1/search/libraries/extra",
    "/api/v1/places/england/norfolk/broadland",
    "/api/v1/places/libraries",
    "/api/v1/places/England",
    "/api/v1/places/a/b/c/d/libraries",
    "/api/v1/placesx",
  ])("keeps %s behind the browser gates", (path) => {
    expect(isTeamApiPath(path)).toBe(false)
    expect(needsBasicAuth(path)).toBe(true)
    expect(betaPublicRequest(path, "GET")).toBe(false)
  })
})

describe("place routes", () => {
  it("browses countries, regions and areas, and lists libraries at each level", () => {
    expect(teamApiPlaceRoute([])).toEqual({ kind: "places" })
    expect(teamApiPlaceRoute(["england", "norfolk"])).toEqual({
      kind: "places",
      country: "england",
      region: "norfolk",
    })
    expect(
      teamApiPlaceRoute(["england", "norfolk", "broadland", "libraries"])
    ).toEqual({
      kind: "libraries",
      country: "england",
      region: "norfolk",
      area: "broadland",
    })
    expect(teamApiPlaceRoute(["libraries"])).toBeNull()
    expect(teamApiPlaceRoute(["england", "norfolk", "broadland"])).toBeNull()
  })
})
