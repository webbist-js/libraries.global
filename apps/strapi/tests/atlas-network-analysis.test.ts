import { emptyAtlasFilters } from "@repo/shared-data"
import { expect, it, vi } from "vitest"

import { requestAtlasNetworkReach } from "../src/utils/atlas-network-analysis"

const request = {
  schemaVersion: 1,
  networkId: "one",
  areaCode: "E06000001",
  mode: "walking",
  scope: {
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
}
it("rechecks the current network before accessing cached jobs", async () => {
  const findOne = vi.fn().mockResolvedValue(null),
    db = vi.fn()
  const strapi = { documents: () => ({ findOne }), db: { connection: db } }
  expect(
    (await requestAtlasNetworkReach(strapi, request, "a".repeat(64), 20)).status
  ).toBe(404)
  expect(db).not.toHaveBeenCalled()
})
it("rejects browser-supplied members, arbitrary polygons and map bounds", async () => {
  const documents = vi.fn(),
    strapi = { documents }
  await expect(
    requestAtlasNetworkReach(
      strapi,
      { ...request, members: [] },
      "a".repeat(64),
      20
    )
  ).rejects.toThrow()
  await expect(
    requestAtlasNetworkReach(
      strapi,
      {
        ...request,
        scope: {
          ...request.scope,
          bbox: { west: 0, east: 1, south: 0, north: 1 },
        },
      },
      "a".repeat(64),
      20
    )
  ).rejects.toThrow()
  expect(documents).not.toHaveBeenCalled()
})
it("refuses oversized services before projection lookups, cache reads or job admission", async () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({
    documentId: String(index),
    libraryType: { name: "Public" },
  }))
  const db = vi.fn()
  const strapi = {
    documents: (uid: string) =>
      uid.includes("library-network")
        ? {
            findOne: async () => ({ documentId: "one", name: "Large service" }),
          }
        : { findMany: async () => rows },
    db: { connection: db },
  }
  const response = await requestAtlasNetworkReach(
    strapi,
    request,
    "a".repeat(64),
    20
  )
  expect(response.body).toMatchObject({
    state: "unsupported",
    message: expect.stringContaining("50"),
  })
  expect(db).not.toHaveBeenCalled()
})
