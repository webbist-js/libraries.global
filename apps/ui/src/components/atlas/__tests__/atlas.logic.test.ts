import { describe, expect, it } from "vitest"

import {
  applyFilters,
  hasAccessibility,
  accessibilityOptions,
  accessibilityLibraries,
  accessibilitySummary,
  type AtlasLibrary,
  EMPTY_FILTERS,
  inBounds,
  isOpenAt,
  isOpenLateOrSunday,
  layerAccess,
  layerDef,
  loosenSuggestions,
  mergeRanges,
  pinDependentLayers,
  parseUrlState,
  tierForPlan,
  toggleLayer,
  toUrlParams,
  typeGroupOf,
  withRequiredLibraryLocations,
  type LayerId,
  type Tier,
} from "@/components/atlas/atlas.logic"

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
    expect(layerAccess(layerDef("carAccess"), "pro")).toBe("available")
    expect(layerAccess(layerDef("mobile"), "public")).toBe("available")
    expect(layerAccess(layerDef("population"), "public")).toBe("signin")
    expect(layerAccess(layerDef("population"), "free")).toBe("available")
    expect(layerAccess(layerDef("reach"), "public")).toBe("pro")
    expect(layerAccess(layerDef("reach"), "free")).toBe("pro")
    expect(layerAccess(layerDef("reach"), "pro")).toBe("available")
    // Readiness wins, so no plan can unlock an unbuilt layer.
    expect(layerAccess(layerDef("transit"), "free")).toBe("soon")
    expect(layerAccess(layerDef("transit"), "pro")).toBe("soon")
  })

  it("replaces a layer in the same exclusive group", () => {
    expect(toggleLayer(["pins", "density", "openLate"], "events")).toEqual({
      layers: ["pins", "openLate", "events"],
      replaced: "density",
    })
    expect(toggleLayer(["density"], "density")).toEqual({
      layers: [],
      replaced: null,
    })
  })
  it("keeps Reach above one replaceable context background", () => {
    expect(toggleLayer(["pins", "reach"], "population")).toEqual({
      layers: ["pins", "reach", "population"],
      replaced: null,
    })
    expect(toggleLayer(["pins", "reach", "population"], "deprivation")).toEqual(
      { layers: ["pins", "reach", "deprivation"], replaced: "population" }
    )
    expect(toggleLayer(["pins", "deprivation"], "reach")).toEqual({
      layers: ["pins", "deprivation", "reach"],
      replaced: null,
    })
  })

  it.each(["access", "complete", "openLate"] as LayerId[])(
    "requires pins while %s is active and unlocks them when it is removed",
    (id) => {
      const enabled = toggleLayer([], id).layers
      expect(enabled).toEqual(["pins", id])
      expect(toggleLayer(enabled, "pins").layers).toEqual(enabled)
      const disabled = toggleLayer(enabled, id).layers
      expect(disabled).toEqual(["pins"])
      expect(toggleLayer(disabled, "pins").layers).toEqual([])
    }
  )

  it("keeps the dependency through exclusive replacements and multiple marker layers", () => {
    const legacy = withRequiredLibraryLocations(["access", "openLate"])
    expect(legacy).toEqual(["pins", "access", "openLate"])
    const replacement = toggleLayer(legacy, "complete")
    expect(replacement).toEqual({
      layers: ["pins", "openLate", "complete"],
      replaced: "access",
    })
    expect(withRequiredLibraryLocations(replacement.layers)).toEqual(
      replacement.layers
    )
    const remaining = toggleLayer(replacement.layers, "complete").layers
    expect(pinDependentLayers(remaining).map((def) => def.id)).toEqual([
      "openLate",
    ])
    expect(toggleLayer(remaining, "pins").layers).toEqual(remaining)
  })

  it("does not force pins for overlays or unavailable shared-link layers", () => {
    const overlays: LayerId[] = ["mobile", "density", "closures", "perCapita"]
    expect(withRequiredLibraryLocations(overlays)).toEqual(overlays)
    for (const [id, tier] of [
      ["access", "public"],
      ["founded", "pro"],
    ] as [LayerId, Tier][]) {
      const available = [id].filter(
        (layer) => layerAccess(layerDef(layer), tier) === "available"
      )
      expect(withRequiredLibraryLocations(available)).toEqual([])
    }
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
        types: ["public" as const, "mobile" as const],
        mobileFrequency: ["fortnightly" as const],
        mobileSharesLive: true,
        opening: "at" as const,
        atDay: 6,
        atMinutes: 720,
        facilities: ["Wheelchair access", "Wi-Fi"],
        founded: [1850, 2024] as [number, number],
      },
      layers: ["density" as const],
      accessibility: ["Hearing loop", "Quiet room"],
      accessibilityView: "compare" as const,
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
    expect(s.accessibilityView).toBe("matches")
  })
})

describe("tierForPlan", () => {
  it("maps known plans and fails closed on anything else", () => {
    expect(tierForPlan("public")).toBe("public")
    expect(tierForPlan("free")).toBe("free")
    expect(tierForPlan("pro")).toBe("pro")
    expect(tierForPlan("team")).toBe("pro")
    for (const plan of ["platinum", "PRO", "", null, undefined])
      expect(tierForPlan(plan)).toBe("free")
  })
})

describe("accessibility layers", () => {
  it("distinguishes complete and partial records without treating missing facts as absence", () => {
    const selected = ["Hearing loop", "Quiet room"]
    const libraries = [
      lib({ id: "match", access: selected }),
      lib({ id: "partial", access: ["Hearing loop"] }),
      lib({ id: "different", access: ["Accessible toilets"] }),
      lib({ id: "unknown", access: [] }),
    ]
    expect(accessibilitySummary(libraries, selected)).toEqual({
      total: 4,
      matches: 1,
      partial: 1,
      unconfirmed: 3,
    })
    expect(
      accessibilityLibraries(libraries, selected, "matches").map((l) => l.id)
    ).toEqual(["match"])
    expect(
      accessibilityLibraries(libraries, selected, "gaps").map((l) => l.id)
    ).toEqual(["partial", "different", "unknown"])
    expect(accessibilityLibraries(libraries, selected, "compare")).toEqual(
      libraries
    )
    expect(accessibilitySummary(libraries)).toEqual({
      total: 4,
      matches: 3,
      partial: 0,
      unconfirmed: 1,
    })
  })

  it("handles empty populations and preserves the comparison choice in shared URLs", () => {
    expect(accessibilitySummary([], ["Quiet room"])).toEqual({
      total: 0,
      matches: 0,
      partial: 0,
      unconfirmed: 0,
    })
    for (const view of ["matches", "compare", "gaps"] as const) {
      const state = parseUrlState(
        new URLSearchParams(
          `layers=access&access=Quiet+room&accessView=${view}`
        )
      )
      expect(parseUrlState(toUrlParams(state)).accessibilityView).toBe(view)
    }
    expect(
      parseUrlState(new URLSearchParams("accessView=negative"))
        .accessibilityView
    ).toBe("matches")
  })
  it("highlights any recorded feature or every chosen feature, without guessing step-free access", () => {
    const library = lib({ access: ["Hearing loop", "Quiet room"] })
    expect(hasAccessibility(library)).toBe(true)
    expect(hasAccessibility(library, ["Hearing loop", "Quiet room"])).toBe(true)
    expect(
      hasAccessibility(library, ["Hearing loop", "Step-free access"])
    ).toBe(false)
    expect(hasAccessibility(lib({ access: [] }))).toBe(false)
    expect(
      accessibilityOptions(
        [library],
        ["Braille signage"],
        ["Accessible toilets"]
      )
    ).toEqual([
      { name: "Accessible toilets", count: 0 },
      { name: "Braille signage", count: 0 },
      { name: "Hearing loop", count: 1 },
      { name: "Quiet room", count: 1 },
    ])
  })
  it("starts with library pins and preserves explicit layer selections", () => {
    expect(parseUrlState(new URLSearchParams()).layers).toEqual(["pins"])
    expect(parseUrlState(new URLSearchParams("layers=mobile")).layers).toEqual([
      "mobile",
    ])
    expect(parseUrlState(new URLSearchParams("layers=")).layers).toEqual([])
  })
  it("lets readers choose Mobile independently from Public", () => {
    const mobile = lib({ type: "Mobile" })
    expect(
      applyFilters(
        [mobile],
        { ...EMPTY_FILTERS, types: ["public"] },
        new Date()
      )
    ).toEqual([])
    expect(
      applyFilters(
        [mobile],
        { ...EMPTY_FILTERS, types: ["mobile"] },
        new Date()
      )
    ).toEqual([mobile])
  })
})
