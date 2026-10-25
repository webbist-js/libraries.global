import { expect, it, vi } from "vitest"

import {
  comparableSourceFact,
  districtAt,
  downloadLibraryOn,
} from "../../scripts/ingests/england/libraryon/ingest"

it("compares refreshed component facts independently of CMS IDs and key order", () => {
  expect(
    comparableSourceFact([{ id: 7, days: ["Monday"], opens: "09:00" }])
  ).toEqual(
    comparableSourceFact([{ opens: "09:00", days: ["Monday"], id: 82 }])
  )
  expect(comparableSourceFact({ id: 7, lat: 51 })).not.toEqual(
    comparableSourceFact({ id: 7, lat: 52 })
  )
})

it("requires a complete stable LibraryOn snapshot and unique source IDs", async () => {
  const row = { id: 1, attributes: { name: "A", ref: null } }
  const loader = vi
    .fn()
    .mockResolvedValueOnce({
      data: [row],
      meta: { pagination: { page: 1, total: 1 } },
    })
    .mockResolvedValueOnce({
      data: [],
      meta: { pagination: { page: 2, total: 1 } },
    })
  expect(await downloadLibraryOn(loader)).toEqual([row])
  const duplicate = vi
    .fn()
    .mockResolvedValueOnce({
      data: [row],
      meta: { pagination: { page: 1, total: 2 } },
    })
    .mockResolvedValueOnce({
      data: [row],
      meta: { pagination: { page: 2, total: 2 } },
    })
  await expect(downloadLibraryOn(duplicate)).rejects.toThrow("duplicate")
  const incomplete = vi
    .fn()
    .mockResolvedValueOnce({
      data: [row],
      meta: { pagination: { page: 1, total: 2 } },
    })
    .mockResolvedValueOnce({
      data: [],
      meta: { pagination: { page: 2, total: 2 } },
    })
  await expect(downloadLibraryOn(incomplete)).rejects.toThrow("Incomplete")
})

it("places by exact polygons, respects holes and refuses overlapping districts", () => {
  const feature = {
    properties: { LAD25CD: "E1", LAD25NM: "One" },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
          [1, 1],
        ],
      ],
    },
  }
  expect(districtAt([feature], 3, 3)).toBe(feature)
  expect(districtAt([feature], 1.5, 1.5)).toBeUndefined()
  expect(districtAt([feature], 8, 8)).toBeUndefined()
  expect(() => districtAt([feature, { ...feature }], 3, 3)).toThrow(
    "Overlapping"
  )
})
