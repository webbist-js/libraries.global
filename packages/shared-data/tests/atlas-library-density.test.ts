import { describe, expect, it } from "vitest"

import {
  atlasCellId,
  atlasInBounds,
  atlasDensityBounds,
  atlasDensityCell,
  atlasDensityCounts,
  atlasDensityFromPoints,
  atlasDensityResolution,
  atlasDensityIndexProjection,
  parseAtlasDensitySettings,
  DEFAULT_ATLAS_DENSITY,
  emptyAtlasFilters,
  parseAtlasQueryRequest,
} from "../index"

const points = [
  { lat: 51.5, lng: -0.1 },
  { lat: 51.5001, lng: -0.1001 },
  { lat: 60, lng: 10 },
  { lat: 0, lng: 179.99 },
  { lat: 0, lng: -179.99 },
]
const world = { west: -180, east: 180, south: -90, north: 90 }
describe("library density geography", () => {
  it("preserves every record at all prepared and street resolutions", () => {
    for (let z = 0; z <= 20; z++) {
      const cells = atlasDensityCounts(points, z)
      expect(cells.reduce((sum, cell) => sum + cell.total, 0)).toBe(
        points.length
      )
      expect(
        cells.every((cell) => atlasDensityCell(cell.id, cell.total).areaKm2 > 0)
      ).toBe(true)
    }
    expect(atlasDensityResolution(24)).toBe(20)
    expect(atlasDensityResolution(14, 6)).toBe(6)
  })
  it("uses geographic area rather than treating Mercator cells as equal area", () => {
    const equator = atlasDensityCell(atlasCellId({ lat: 0, lng: 0 }, 10), 10)
    const north = atlasDensityCell(atlasCellId({ lat: 60, lng: 0 }, 10), 10)
    expect(equator.areaKm2 / north.areaKm2).toBeGreaterThan(3.9)
    expect(north.per100Km2 / equator.per100Km2).toBeGreaterThan(3.9)
    expect(atlasDensityCell(equator.id, 0).per100Km2).toBe(0)
    expect(() => atlasDensityCell(equator.id, -1)).toThrow()
  })
  it("includes whole boundary cells and neighbours across the antimeridian", () => {
    const wrapped = atlasDensityBounds(
      { west: 179.99, east: -179.99, south: -0.01, north: 0.01 },
      12
    )
    expect(wrapped.west).toBeGreaterThan(wrapped.east)
    expect(atlasInBounds({ lat: 0, lng: 179.9 }, wrapped)).toBe(true)
    expect(atlasInBounds({ lat: 0, lng: -179.9 }, wrapped)).toBe(true)
    expect(atlasInBounds({ lat: 0, lng: 0 }, wrapped)).toBe(false)
    expect(atlasDensityBounds(world, 4)).toMatchObject({
      west: -180,
      east: 180,
    })
  })
  it("does not change a cell count when the viewport clips its edge", () => {
    const bbox = {
      west: -0.10005,
      east: -0.09999,
      south: 51.49999,
      north: 51.50005,
    }
    const a = atlasDensityFromPoints(points, bbox, 10, 14)
    const b = atlasDensityFromPoints(points, { ...bbox, west: -0.1002 }, 10, 14)
    const id = atlasCellId(points[0]!, 14)
    expect(a.exactTotal).toBe(1)
    expect(b.exactTotal).toBe(1)
    expect(a.cells.find((cell) => cell.id === id)?.total).toBe(2)
    expect(b.cells.find((cell) => cell.id === id)?.total).toBe(2)
  })
  it("upgrades old index rows without changing their other facts or epoch markers", () => {
    const old = { documentId: "one", latitude: 51.5, longitude: -0.1 }
    expect(atlasDensityIndexProjection(old)).toMatchObject({
      ...old,
      atlas_cell_20: atlasCellId(points[0]!, 20),
    })
    expect(atlasDensityIndexProjection({ documentId: "marker" })).toEqual({
      documentId: "marker",
    })
  })
})
it("bounds shared URL settings and the server request contract", () => {
  expect(parseAtlasDensitySettings(new URLSearchParams())).toEqual(
    DEFAULT_ATLAS_DENSITY
  )
  expect(
    parseAtlasDensitySettings(
      new URLSearchParams("densityDetail=99&densityOpacity=NaN")
    )
  ).toEqual(DEFAULT_ATLAS_DENSITY)
  const request = {
    schemaVersion: 1,
    purpose: "viewport",
    scope: {
      filters: emptyAtlasFilters(),
      bbox: world,
      accessibility: { enabled: false, selected: [], view: "matches" },
    },
    zoom: 8,
    centre: { lat: 0, lng: 0 },
    width: 800,
    height: 600,
    populations: ["listed"],
    drawingPreference: "current",
    libraryDensity: { detail: 14, scale: "fixed" },
  }
  expect(parseAtlasQueryRequest(request)).toMatchObject({
    libraryDensity: request.libraryDensity,
  })
  expect(() =>
    parseAtlasQueryRequest({
      ...request,
      libraryDensity: { detail: 21, scale: "fixed" },
    })
  ).toThrow()
  expect(() =>
    parseAtlasQueryRequest({
      ...request,
      libraryDensity: { detail: "auto", scale: "fixed", filter: "arbitrary" },
    })
  ).toThrow()
})
