import { expect, it } from "vitest"

import { atlasLocalAreaCode } from "../atlas/local-boundaries"
import {
  atlasAccessColor,
  atlasLocalGeography,
  atlasPeoplePerLibrary,
  emptyAtlasFilters,
  onsLocalPopulation,
  parseAtlasQueryRequest,
} from "../index"

it("uses reciprocal rates without fabricating a finite value for no libraries", () => {
  expect(atlasPeoplePerLibrary(5, 100000)).toBe(20000)
  expect(atlasPeoplePerLibrary(0, 100000)).toBeNull()
  expect(atlasPeoplePerLibrary(10, null)).toBeNull()
  expect(() => atlasPeoplePerLibrary(-1, 1000)).toThrow()
  expect(atlasAccessColor(0)).toBe(atlasAccessColor(1.99))
  expect(atlasAccessColor(2)).not.toBe(atlasAccessColor(1.99))
  expect(atlasAccessColor(null)).not.toBe(atlasAccessColor(0))
})
it("assigns current district codes independently of the CMS hierarchy", () => {
  expect(atlasLocalGeography.areas).toHaveLength(361)
  for (const [lat, lng, code] of [
    [53.8, -1.55, "E08000035"],
    [51.507, -0.128, "E09000033"],
    [50.72, -1.88, "E06000058"],
    [55.864, -4.25, "S12000049"],
    [54.596, -5.929, "N09000003"],
  ] as const)
    expect(atlasLocalAreaCode({ lat, lng })).toBe(code)
  expect(atlasLocalAreaCode({ lat: 40, lng: -73 })).toBeNull()
  expect(atlasLocalAreaCode({ lat: 51, lng: -5 })).toBeNull()
})
it("rejects a viewport denominator and invalid area choices", () => {
  const query = {
    schemaVersion: 1,
    purpose: "libraryAccess",
    level: "local",
    scope: {
      filters: emptyAtlasFilters(),
      accessibility: { enabled: false, selected: [], view: "matches" },
    },
  }
  expect(parseAtlasQueryRequest(query)).toEqual(query)
  expect(() => parseAtlasQueryRequest({ ...query, level: "council" })).toThrow()
  expect(() =>
    parseAtlasQueryRequest({
      ...query,
      scope: {
        ...query.scope,
        bbox: { west: -2, east: -1, south: 50, north: 51 },
      },
    })
  ).toThrow()
})
const observation = {
  dataset: { value: "NM_2002_1" },
  geography: { geogcode: "E06000065", description: "North Yorkshire" },
  gender: { value: 0 },
  c_age: { value: 200 },
  measures: { value: 20100 },
  unit: { value: "PER" },
  time: { value: 2024 },
  obs_status: { value: "A" },
  obs_value: { value: 633692 },
}
it("validates year, units, exact codes, duplicates and complete population batches", () => {
  const feed = { header: { truncated: "false" }, obs: [observation] },
    at = "2026-10-09T12:00:00Z"
  expect(onsLocalPopulation(feed, ["E06000065"], at)[0]).toMatchObject({
    population: 633692,
    year: 2024,
    reportingCode: "E06000065",
    method: "direct",
  })
  for (const replacement of [
    { time: { value: 2025 } },
    { geography: { geogcode: "old" } },
    { gender: { value: 1 } },
    { obs_value: { value: null } },
    { unit: { value: "percent" } },
  ])
    expect(() =>
      onsLocalPopulation(
        { ...feed, obs: [{ ...observation, ...replacement }] },
        ["E06000065"],
        at
      )
    ).toThrow()
  expect(() =>
    onsLocalPopulation(
      { ...feed, obs: [observation, observation] },
      ["E06000065", "E06000058"],
      at
    )
  ).toThrow()
  expect(() =>
    onsLocalPopulation(
      { ...feed, header: { truncated: "true" } },
      ["E06000065"],
      at
    )
  ).toThrow()
})
