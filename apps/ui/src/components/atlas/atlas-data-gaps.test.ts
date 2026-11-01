import { describe, expect, it } from "vitest"

import type { AtlasContextRelease } from "@/lib/atlas-context"

import {
  contextDataGap,
  contextReleaseAtLocation,
  reachDataGap,
} from "./atlas-data-gaps"

const release: AtlasContextRelease = {
  id: "ie-census",
  theme: "carAccess",
  country: "IE",
  name: "Ireland",
  year: 2022,
  edition: "Census 2022",
  boundary: "ED",
  source: "CSO",
  sourceUrl: "https://www.cso.ie",
  licence: "CC BY 4.0",
  attribution: "CSO",
  note: "",
  bounds: { west: -11, east: -6, south: 51, north: 56 },
}
const context = { release, releases: [release], loading: false, error: false }
describe("Atlas data gap detection", () => {
  it("does not turn loading or a real zero into missing population", () => {
    expect(
      contextDataGap({ ...context, release: null, loading: true })
    ).toBeNull()
    expect(
      contextDataGap({
        ...context,
        grid: true,
        point: { area: null, density: 0 },
      })
    ).toBeNull()
    expect(
      contextDataGap({
        ...context,
        grid: true,
        point: { area: null, density: null },
      })?.reasons
    ).toEqual(["missingPopulation"])
  })
  it("distinguishes a service failure from missing geographic coverage", () => {
    expect(contextDataGap({ ...context, error: true })?.reasons).toEqual([
      "temporaryFailure",
    ])
    expect(
      contextDataGap({
        ...context,
        release: null,
        location: { lat: 42, lng: 12 },
      })?.reasons
    ).toEqual(["outsideCoverage"])
    expect(
      contextDataGap({ ...context, location: { lat: 42, lng: 12 } })?.reasons
    ).toEqual(["outsideCoverage"])
    expect(
      contextDataGap({ ...context, point: { area: null } })?.reasons
    ).toEqual(["missingArea"])
  })
  it("does not fall back to another country or guess between overlapping editions", () => {
    expect(
      contextReleaseAtLocation([release], "", { lat: 42, lng: 12 })
    ).toBeNull()
    expect(contextReleaseAtLocation([release], "", { lat: 53, lng: -7 })).toBe(
      release
    )
    const overlapping = { ...release, id: "another-edition" }
    expect(
      contextReleaseAtLocation([release, overlapping], "", { lat: 53, lng: -7 })
    ).toBeNull()
    expect(
      contextReleaseAtLocation([release, overlapping], overlapping.id, {
        lat: 53,
        lng: -7,
      })
    ).toBe(overlapping)
    expect(
      contextDataGap({
        ...context,
        release: null,
        location: { lat: 53, lng: -7 },
      })?.reasons
    ).toEqual(["chooseEdition"])
  })
  it("explains a missing value within a known reporting area", () => {
    expect(
      contextDataGap({
        ...context,
        point: {
          area: {
            code: "ED-1",
            name: "Example ED",
            value: null,
            bounds: release.bounds,
          },
        },
      })?.reasons
    ).toEqual(["missingValue"])
  })
  it("retains specific publisher limitations for partial releases", () => {
    expect(
      contextDataGap({
        ...context,
        release: {
          ...release,
          coverage: {
            status: "partial",
            gaps: ["Two reporting areas were withheld by the publisher."],
          },
        },
      })
    ).toMatchObject({
      reasons: ["partialSource"],
      details: ["Two reporting areas were withheld by the publisher."],
    })
  })
  it("keeps missing routing, population and community calculations distinct", () => {
    expect(reachDataGap({ state: "pending" })).toBeNull()
    expect(reachDataGap({ state: "unroutable" })?.reasons).toEqual([
      "unroutable",
    ])
    expect(reachDataGap({ state: "missing_population" })?.reasons).toEqual([
      "missingPopulation",
    ])
    expect(reachDataGap({ state: "ready" })).toBeNull()
    expect(
      reachDataGap(
        { state: "ready", community: { state: "insufficient" } },
        true
      )?.reasons
    ).toEqual(["communityInsufficient"])
    expect(
      reachDataGap(
        {
          state: "partial",
          excludedLibraries: 2,
          unavailableLibraries: 1,
          warnings: ["One library could not be routed."],
          community: { state: "incomplete" },
        },
        true
      )
    ).toMatchObject({
      count: 3,
      reasons: ["partialReach", "communityIncomplete"],
      details: ["One library could not be routed."],
    })
  })
})
