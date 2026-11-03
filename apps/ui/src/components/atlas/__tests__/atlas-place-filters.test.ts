import { describe, expect, it } from "vitest"

import {
  applyFilters,
  atlasPlaceScope,
  EMPTY_FILTERS,
  parseUrlState,
  toUrlParams,
  type AtlasLibrary,
} from "../atlas.logic"

const lib = (path: string | null, country = "England"): AtlasLibrary =>
  ({
    id: path ?? "x",
    name: "Library",
    slug: "library",
    type: "Public",
    status: "open",
    operator: null,
    city: null,
    country,
    region: "Norfolk",
    path,
    tz: null,
    hours: null,
    founded: null,
    closed: null,
    events: false,
    catalogue: false,
    access: [],
    services: [],
    complete: 0,
    lat: 52.6,
    lng: 1.3,
  }) as AtlasLibrary

describe("Atlas place filters", () => {
  const norfolk = lib("/europe/england/norfolk/loddon-library")
  const broadland = lib("/europe/england/norfolk/broadland/acle-library")
  const wales = lib("/europe/wales/cardiff/central-library", "Wales")

  it("narrows by country, region and area using each library's path", () => {
    const now = new Date()
    const country = { ...EMPTY_FILTERS, country: { slug: "england" } }
    expect(applyFilters([norfolk, broadland, wales], country, now)).toEqual([
      norfolk,
      broadland,
    ])
    const area = {
      ...country,
      region: { slug: "norfolk" },
      area: { slug: "broadland" },
    }
    expect(applyFilters([norfolk, broadland, wales], area, now)).toEqual([
      broadland,
    ])
  })

  it("scopes queries to the deepest place with an id", () => {
    expect(
      atlasPlaceScope({
        ...EMPTY_FILTERS,
        country: { slug: "england", id: "c1" },
        region: { slug: "norfolk", id: "r1" },
        area: { slug: "broadland" },
      })
    ).toEqual({ level: "region", id: "r1" })
    expect(atlasPlaceScope(EMPTY_FILTERS)).toBeUndefined()
  })

  it("keeps places in the URL, each only under the one before", () => {
    const params = toUrlParams({
      view: null,
      filters: {
        ...EMPTY_FILTERS,
        country: { slug: "england", id: "c1", name: "England" },
        region: { slug: "norfolk" },
        area: { slug: "broadland" },
      },
      layers: ["pins"],
      accessibility: [],
      accessibilityView: "matches",
      library: null,
      list: false,
      projection: "globe",
    } as never)
    expect(params.get("country")).toBe("england")
    expect(params.get("area")).toBe("broadland")
    const parsed = parseUrlState(new URLSearchParams("region=norfolk"))
    expect(parsed.filters.region).toBeUndefined()
    expect(parseUrlState(params).filters.area).toEqual({ slug: "broadland" })
  })
})
