import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { atlasGeometryAreaKm2, parseAtlasPolygon } from "../atlas/geometry"
import { atlasPopulationDensity } from "../atlas/population-density"
import { parseAtlasReachRequest, parseAtlasReachResult } from "../atlas/reach"

const ring: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
]

describe("analytical geometry and inputs", () => {
  it("matches the native service's published contract conformance cases", () => {
    const fixtures = JSON.parse(
      readFileSync(
        new URL(
          "../../../apps/analysis/contracts/conformance.json",
          import.meta.url
        ),
        "utf8"
      )
    ) as {
      name: string
      contract: "request" | "result"
      valid: boolean
      value: unknown
    }[]
    for (const fixture of fixtures) {
      const parse =
        fixture.contract === "request"
          ? parseAtlasReachRequest
          : parseAtlasReachResult
      if (fixture.valid)
        expect(() => parse(fixture.value), fixture.name).not.toThrow()
      else expect(() => parse(fixture.value), fixture.name).toThrow()
    }
  })
  it("measures spherical area and subtracts holes independently of winding", () => {
    const shell = atlasGeometryAreaKm2({ type: "Polygon", coordinates: [ring] })
    expect(shell).toBeCloseTo(12363.718, 2)
    expect(
      atlasGeometryAreaKm2({
        type: "Polygon",
        coordinates: [[...ring].reverse()],
      })
    ).toBe(shell)
    const hole: [number, number][] = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.8, 0.8],
      [0.2, 0.8],
      [0.2, 0.2],
    ]
    expect(
      atlasGeometryAreaKm2({ type: "Polygon", coordinates: [ring, hole] })
    ).toBeLessThan(shell)
  })
  it("distinguishes unknown population from a known zero", () => {
    expect(atlasPopulationDensity(1000, 20)).toBe(50)
    expect(atlasPopulationDensity(0, 20)).toBe(0)
    expect(atlasPopulationDensity(null, 20)).toBeNull()
    expect(() => atlasPopulationDensity(1000, 0)).toThrow()
  })
  it("bounds untrusted geometry and rejects open rings", () => {
    expect(() =>
      parseAtlasPolygon({ type: "Polygon", coordinates: [ring] }, 4)
    ).toThrow()
    expect(() =>
      parseAtlasPolygon({ type: "Polygon", coordinates: [ring.slice(0, 4)] })
    ).toThrow()
  })
  it("accepts only published-library lookup inputs, never browser coordinates or provider URLs", () => {
    expect(
      parseAtlasReachRequest({
        schemaVersion: 1,
        libraryId: "abc123",
        mode: "walking",
      }).mode
    ).toBe("walking")
    expect(() =>
      parseAtlasReachRequest({
        schemaVersion: 1,
        libraryId: "abc123",
        mode: "driving",
      })
    ).toThrow()
    expect(() =>
      parseAtlasReachRequest({
        schemaVersion: 1,
        libraryId: "abc123",
        mode: "walking",
        lat: 0,
      })
    ).toThrow()
  })
})
