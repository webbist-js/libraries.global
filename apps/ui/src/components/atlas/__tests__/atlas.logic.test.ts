import { describe, expect, it } from "vitest"

import {
  applyFilters,
  type AtlasLibrary,
  EMPTY_FILTERS,
  inBounds,
  isOpenAt,
  isOpenLateOrSunday,
  layerAccess,
  layerDef,
  loosenSuggestions,
  mergeRanges,
  parseUrlState,
  toggleLayer,
  toUrlParams,
  typeGroupOf,
} from "../atlas.logic"

const weekdays9to5 = [
  [[540, 1020]],
  [[540, 1020]],
  [[540, 1020]],
  [[540, 1020]],
  [[540, 1020]],
  [],
  [],
]

function lib(p: Partial<AtlasLibrary>): AtlasLibrary {
  return {
    id: p.id ?? "x",
    name: "Library",
    slug: "library",
    type: "Public",
    status: "open",
    operator: "Municipality",
    city: null,
    country: null,
    region: null,
    path: null,
    tz: "UTC",
    hours: weekdays9to5,
    founded: null,
    closed: null,
    events: false,
    catalogue: false,
    access: [],
    services: [],
    complete: 50,
    lat: 55.86,
    lng: -4.27,
    ...p,
  }
}

// Wednesday 2026-09-23 10:30 UTC
const WED_1030 = new Date("2026-09-23T10:30:00Z")

describe("hours", () => {
  it("knows when a library is open", () => {
    expect(isOpenAt(weekdays9to5, 2, 630)).toBe(true)
    expect(isOpenAt(weekdays9to5, 2, 1020)).toBe(false)
    expect(isOpenAt(weekdays9to5, 6, 630)).toBe(false)
    expect(isOpenAt(null, 2, 630)).toBe(false)
  })

  it("merges back-to-back timeframes", () => {
    expect(
      mergeRanges([
        [600, 960],
        [480, 600],
        [1020, 1080],
      ])
    ).toEqual([
      [480, 960],
      [1020, 1080],
    ])
  })

  it("flags late or Sunday opening", () => {
    expect(isOpenLateOrSunday(weekdays9to5)).toBe(false)
    expect(
      isOpenLateOrSunday([...weekdays9to5.slice(0, 6), [[600, 960]]])
    ).toBe(true)
    expect(isOpenLateOrSunday([[[540, 1200]], [], [], [], [], [], []])).toBe(
      true
    )
  })
})

describe("filters", () => {
  const libs = [
    lib({ id: "a", type: "Public", access: ["Wheelchair access"] }),
    lib({ id: "b", type: "University", operator: "University", hours: null }),
    lib({ id: "c", type: "Monastic", operator: "Religious Institution" }),
    lib({ id: "d", status: "permanently_closed" }),
  ]

  it("hides permanently closed libraries", () => {
    expect(
      applyFilters(libs, EMPTY_FILTERS, WED_1030).map((l) => l.id)
    ).toEqual(["a", "b", "c"])
  })

  it("groups library types", () => {
    expect(typeGroupOf("University")).toBe("academic")
    expect(typeGroupOf("Municipal")).toBe("public")
    const f = { ...EMPTY_FILTERS, types: ["academic" as const] }
    expect(applyFilters(libs, f, WED_1030).map((l) => l.id)).toEqual(["b"])
  })

  it("filters by open now, excluding unknown hours", () => {
    const f = { ...EMPTY_FILTERS, opening: "now" as const }
    expect(applyFilters(libs, f, WED_1030).map((l) => l.id)).toEqual(["a", "c"])
  })

  it("filters by operator group and facility", () => {
    expect(
      applyFilters(
        libs,
        { ...EMPTY_FILTERS, operators: ["religious"] },
        WED_1030
      ).map((l) => l.id)
    ).toEqual(["c"])
    expect(
      applyFilters(
        libs,
        { ...EMPTY_FILTERS, facilities: ["Wheelchair access"] },
        WED_1030
      ).map((l) => l.id)
    ).toEqual(["a"])
  })

  it("suggests which filter to loosen, with gains", () => {
    const f = {
      ...EMPTY_FILTERS,
      opening: "now" as const,
      types: ["academic" as const],
    }
    expect(applyFilters(libs, f, WED_1030)).toHaveLength(0)
    // Biggest gain first: dropping the type brings back a and c; dropping
    // "Open now" brings back b.
    expect(loosenSuggestions(libs, f, WED_1030)).toEqual([
      expect.objectContaining({ label: "Include all library types", gain: 2 }),
      expect.objectContaining({ label: "Remove “Open now”", gain: 1 }),
    ])
  })
})

describe("layers", () => {
  it("gates by tier and readiness", () => {
    expect(layerAccess(layerDef("density"), "public")).toBe("available")
    expect(layerAccess(layerDef("complete"), "public")).toBe("signin")
    expect(layerAccess(layerDef("complete"), "free")).toBe("available")
    expect(layerAccess(layerDef("deprivation"), "free")).toBe("pro")
    expect(layerAccess(layerDef("mobile"), "public")).toBe("soon")
    // Not built yet: no sign-in prompt, but Pro layers still read as Pro.
    expect(layerAccess(layerDef("population"), "public")).toBe("soon")
    expect(layerAccess(layerDef("transit"), "free")).toBe("pro")
    expect(layerAccess(layerDef("transit"), "pro")).toBe("soon")
  })

  it("replaces a layer in the same exclusive group", () => {
    expect(toggleLayer(["density", "openLate"], "events")).toEqual({
      layers: ["openLate", "events"],
      replaced: "density",
    })
    expect(toggleLayer(["density"], "density")).toEqual({
      layers: [],
      replaced: null,
    })
  })
})

describe("viewport", () => {
  it("handles bounds across the antimeridian", () => {
    const fiji = lib({ lat: -18, lng: 179 })
    expect(
      inBounds(fiji, { west: 170, east: -170, south: -30, north: 0 })
    ).toBe(true)
    expect(inBounds(fiji, { west: -10, east: 10, south: -30, north: 0 })).toBe(
      false
    )
  })
})

describe("url state", () => {
  it("round-trips", () => {
    const state = {
      view: { lat: 55.86, lng: -4.27, zoom: 11 },
      filters: {
        ...EMPTY_FILTERS,
        types: ["public" as const],
        opening: "at" as const,
        atDay: 6,
        atMinutes: 720,
        facilities: ["Wheelchair access", "Wi-Fi"],
        founded: [1850, 2024] as [number, number],
      },
      layers: ["density" as const],
      library: "mitchell-library",
      list: true,
      projection: "flat" as const,
    }
    expect(parseUrlState(toUrlParams(state))).toEqual(state)
  })

  it("ignores junk", () => {
    const s = parseUrlState(
      new URLSearchParams("v=abc&type=robots&layers=nope,density&open=later")
    )
    expect(s.view).toBeNull()
    expect(s.filters.types).toEqual([])
    expect(s.layers).toEqual(["density"])
    expect(s.filters.opening).toBe("any")
  })
})
