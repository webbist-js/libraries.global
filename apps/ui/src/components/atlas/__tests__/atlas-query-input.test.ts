import { parseAtlasQueryRequest } from "@repo/shared-data"
import { expect, it } from "vitest"

import { atlasBuildingFilters, atlasViewportCamera } from "../atlas-query-input"
import { EMPTY_FILTERS } from "../atlas.logic"

it("accepts the actual negative globe zoom and wrapped camera without weakening the API schema", () => {
  const camera = atlasViewportCamera({
    zoom: -4.532749611678994,
    lat: 85.05112899999997,
    lng: -89.29051067485375,
    bounds: { west: -180, south: -3.3420127540796045, east: 180, north: 90 },
  })
  const { bbox, ...position } = camera
  expect(() =>
    parseAtlasQueryRequest({
      schemaVersion: 1,
      purpose: "viewport",
      scope: {
        filters: atlasBuildingFilters(EMPTY_FILTERS),
        accessibility: { enabled: false, selected: [], view: "matches" },
        bbox,
      },
      ...position,
      width: 1440,
      height: 1000,
      populations: ["listed"],
      drawingPreference: "current",
    })
  ).not.toThrow()
  expect(camera.zoom).toBe(0)
  expect(
    atlasViewportCamera({
      zoom: 4,
      lat: 0,
      lng: 1440,
      bounds: { west: 1430, east: 1450, south: -10, north: 10 },
    }).bbox
  ).toEqual({ west: -10, east: 10, south: -10, north: 10 })
})
it("keeps mobile-only controls out of the whole-country comparison request", () => {
  expect(() =>
    parseAtlasQueryRequest({
      schemaVersion: 1,
      purpose: "perCapita",
      scope: {
        filters: atlasBuildingFilters({
          ...EMPTY_FILTERS,
          mobileFrequency: ["weekly"],
          mobileSharesLive: true,
        }),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
    })
  ).not.toThrow()
})
