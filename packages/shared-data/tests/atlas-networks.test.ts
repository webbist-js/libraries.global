import { expect, it } from "vitest"

import {
  emptyAtlasFilters,
  projectAtlasLibrary,
  atlasResolveScope,
  atlasMatchesProjection,
  atlasMeiliFilter,
  atlasTileFilter,
  parseAtlasScope,
  parseAtlasNetworkReachResult,
  parseAtlasNetworkReachRequest,
} from "../index"

it("derives service geography without accepting browser-supplied shapes", () => {
  const request = {
    schemaVersion: 1,
    networkId: "one",
    mode: "walking",
    scope: {
      filters: emptyAtlasFilters(),
      accessibility: { enabled: false, selected: [], view: "matches" },
    },
  }
  expect(parseAtlasNetworkReachRequest(request).areaCode).toBeUndefined()
  expect(() =>
    parseAtlasNetworkReachRequest({ ...request, areaCodes: [] })
  ).toThrow()
  expect(() =>
    parseAtlasNetworkReachRequest({ ...request, members: [] })
  ).toThrow()
})

it("rejects percentages and gaps that cannot be supported by the population totals", () => {
  const geometry = {
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
    release: "one",
    source: "Fixture",
    sourceUrl: "https://example.test",
    licence: "CC0",
    year: 2020,
  }
  const result = {
    schemaVersion: 1,
    state: "ready",
    kind: "network",
    libraryId: "network-one",
    networkId: "one",
    networkName: "One",
    coordinateHash: "a".repeat(64),
    selectionHash: "a".repeat(64),
    areaCode: "E06000016",
    mode: "walking",
    calculatedAt: new Date().toISOString(),
    method: "fixture",
    snapDistanceMetres: 0,
    network: source,
    population: source,
    warnings: [],
    totalResidents: 100,
    selectedLibraries: 2,
    excludedLibraries: 0,
    unavailableLibraries: 0,
    contours: [5, 10, 15, 30].map((minutes) => ({
      minutes,
      residents: 80,
      coveredFraction: 1,
      geometry,
      percent: 80,
      outsideResidents: 20,
      gapGeometry: geometry,
    })),
  }
  expect(
    parseAtlasNetworkReachResult(result).contours[0]!.outsideResidents
  ).toBe(20)
  expect(() =>
    parseAtlasNetworkReachResult({
      ...result,
      unavailableLibraries: 1,
      state: "partial",
    })
  ).toThrow()
  expect(() =>
    parseAtlasNetworkReachResult({ ...result, totalResidents: 70 })
  ).toThrow()
  expect(() =>
    parseAtlasNetworkReachResult({
      ...result,
      contours: result.contours.map((band) => ({
        ...band,
        outsideResidents: 30,
      })),
    })
  ).toThrow()
})

it("uses the same institutional membership in projections, search and tile filters", () => {
  const row = projectAtlasLibrary(
    {
      documentId: "one",
      locale: "en",
      published: true,
      name: "One",
      slug: "one",
      location: { lat: 52, lng: 0 },
      networks: [{ documentId: "network1", name: "Network", slug: "network" }],
    },
    { atlasId: 1, canonicalLocale: "en", now: new Date() }
  )!
  const scope = {
    filters: { ...emptyAtlasFilters(), networks: ["network1"] },
    accessibility: { enabled: false, selected: [], view: "matches" as const },
  }
  const resolved = atlasResolveScope(scope, { version: "one", entries: [] })
  expect(atlasMatchesProjection(row, resolved, new Date())).toBe(true)
  expect(
    atlasMatchesProjection({ ...row, network_ids: [] }, resolved, new Date())
  ).toBe(false)
  expect(
    atlasMeiliFilter(resolved, { now: new Date(), timezones: [] })
  ).toContain('network_ids = "network1"')
  expect(JSON.stringify(atlasTileFilter(resolved))).toContain(",network1,")
  expect(() =>
    parseAtlasScope({
      ...scope,
      filters: { ...scope.filters, networks: ['bad" OR true'] },
    })
  ).toThrow()
})
