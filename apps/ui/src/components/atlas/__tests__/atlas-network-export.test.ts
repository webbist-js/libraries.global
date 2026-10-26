import type {
  AtlasNetworkReachResult,
  AtlasPolygonGeometry,
} from "@repo/shared-data"
import { expect, it } from "vitest"

import { buildAtlasNetworkExport } from "../atlas-network-export"

const geometry: AtlasPolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
}
const source = {
  release: "source-v1",
  source: "Fixture",
  sourceUrl: "https://example.test",
  licence: "CC0",
  year: 2020,
}
const result: AtlasNetworkReachResult = {
  schemaVersion: 1,
  kind: "network",
  libraryId: "network-one",
  coordinateHash: "a".repeat(64),
  snapDistanceMetres: 0,
  networkId: "one",
  networkName: '=formula "quoted"',
  areaCode: "E06000016",
  method: "fixture",
  state: "ready",
  mode: "walking",
  excludedLibraries: 0,
  selectedLibraries: 1,
  unavailableLibraries: 0,
  totalResidents: 100,
  selectionHash: "a".repeat(64),
  calculatedAt: "2026-10-25T00:00:00Z",
  population: source,
  network: source,
  warnings: [],
  reportingArea: {
    name: "Area",
    version: "boundary-v1",
    sourceUrl: "https://example.test/boundary",
    licence: "OGL",
  },
  analysis: {
    schemaVersion: 2,
    eligibleLibraries: [
      {
        libraryId: "branch",
        coordinateHash: "b".repeat(64),
        lat: 52,
        lng: 0,
        country: "GB-ENG",
      },
    ],
    serviceLibraries: 1,
    filteredOutLibraries: 0,
    routingRelease: "source-v1",
    communityRelease: null,
  },
  contours: ([5, 10, 15, 30] as const).map((minutes, i) => ({
    minutes,
    residents: [10, 25, 55, 90][i]!,
    coveredFraction: 1,
    percent: [10, 25, 55, 90][i]!,
    outsideResidents: 100 - [10, 25, 55, 90][i]!,
    empty: false,
    geometry,
    gapGeometry: geometry,
  })),
}
it("retains the legacy CSV header and escapes formula-like names", () => {
  const csv = buildAtlasNetworkExport(result, 15, "csv")
  expect(csv.split("\r\n")).toHaveLength(5)
  expect(csv.split("\r\n")[0]).toBe(
    '"network","area","reportingAreas","reportingAreaName","method","state","excludedLibraries","warnings","mode","populationYear","populationSource","populationLicence","routingLicence","filters","reportingBoundary","reportingBoundaryVersion","reportingBoundaryLicence","networkSource","calculatedAt","selectionHash","selectedLibraries","unavailableLibraries","totalResidents","minutes","residents","coveredFraction","percent","outsideResidents","empty"'
  )
  expect(csv).toContain('"\'=formula ""quoted"""')
})
it("preserves GeoJSON features while adding versioned provenance and exports exact bands in JSON", () => {
  const geo = JSON.parse(buildAtlasNetworkExport(result, 15, "geojson"))
  expect(geo.features).toHaveLength(8)
  expect(geo.analysis.exportSchemaVersion).toBe(2)
  expect(geo.analysis.eligibleLibraries[0].libraryId).toBe("branch")
  const json = JSON.parse(buildAtlasNetworkExport(result, 15, "json"))
  expect(json.selectedMinutes).toBe(15)
  expect(json.result.analysis).toEqual(result.analysis)
  expect(
    json.distribution.map((b: { residents: number }) => b.residents)
  ).toEqual([10, 15, 30, 35, 10])
})

it("exports only the generated time without inventing journey bands", () => {
  const single = {
    ...result,
    requestedMinutes: 15 as const,
    contours: [result.contours[2]!],
  }
  const json = JSON.parse(buildAtlasNetworkExport(single, 15, "json"))
  expect(json.distribution).toBeNull()
  expect(json.result.requestedMinutes).toBe(15)
  expect(json.result.contours).toHaveLength(1)
  expect(buildAtlasNetworkExport(single, 15, "csv").split("\r\n")).toHaveLength(
    2
  )
  expect(
    JSON.parse(buildAtlasNetworkExport(single, 15, "geojson")).features
  ).toHaveLength(2)
})
