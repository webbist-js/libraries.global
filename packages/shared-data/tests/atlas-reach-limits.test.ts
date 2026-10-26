import { expect, it } from "vitest"

import {
  atlasNetworkReachLimit,
  atlasNetworkReachMode,
  atlasReachBoundsAreLocal,
  atlasReachViewLimit,
} from "../index"

const local = { west: -3.2, east: -3, south: 53.3, north: 53.5 }
it("admits rural services for one time and keeps Team capacity bounded", () => {
  const service = {
    eligibleLibraries: 30,
    bounds: local,
    areaCodes: ["S12000034"],
  }
  expect(atlasNetworkReachMode(service)).toBe("single")
  expect(atlasNetworkReachLimit(service)).toBeNull()
  expect(atlasNetworkReachMode({ ...service, eligibleLibraries: 75 })).toBe(
    "libraries"
  )
  expect(atlasNetworkReachMode({ ...service, eligibleLibraries: 75 }, 2)).toBe(
    "single"
  )
  expect(atlasNetworkReachMode({ ...service, eligibleLibraries: 101 }, 2)).toBe(
    "libraries"
  )
  expect(
    atlasNetworkReachMode(
      { ...service, bounds: { west: -8, east: 2, south: 50, north: 60 } },
      2
    )
  ).toBe("area")
})
it("requires local zoom and a bounded visible library count", () => {
  expect(atlasReachViewLimit(8, 429)).toBe("zoom")
  expect(atlasReachViewLimit(10.99, 1)).toBe("zoom")
  expect(atlasReachViewLimit(11, 100)).toBeNull()
  expect(atlasReachViewLimit(12, 101)).toBe("busy")
  expect(atlasReachViewLimit(12, null)).toBe("busy")
  expect(atlasReachViewLimit(Number.NaN, 1)).toBe("zoom")
})
it("bounds the service and its full reporting area, regardless of library filters", () => {
  const service = {
    eligibleLibraries: 50,
    bounds: local,
    areaCodes: ["E08000015"],
  }
  expect(atlasNetworkReachLimit(service)).toBeNull()
  expect(atlasNetworkReachLimit({ ...service, eligibleLibraries: 51 })).toBe(
    "libraries"
  )
  expect(
    atlasNetworkReachLimit({
      ...service,
      bounds: { west: -8, east: 2, south: 50, north: 60 },
    })
  ).toBe("area")
  // A single origin does not make a large reporting district cheap to integrate.
  expect(
    atlasNetworkReachLimit({
      ...service,
      eligibleLibraries: 1,
      areaCodes: ["S12000017"],
    })
  ).toBe("area")
  expect(atlasReachBoundsAreLocal({ ...local, west: Number.NaN })).toBe(false)
  expect(atlasReachBoundsAreLocal({ ...local, east: -4 })).toBe(false)
  expect(atlasReachBoundsAreLocal(null)).toBe(false)
})
