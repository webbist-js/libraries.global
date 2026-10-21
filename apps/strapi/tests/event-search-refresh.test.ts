import { describe, expect, it, vi } from "vitest"

import { refreshEventSearch } from "../src/utils/event-search-refresh"

function setup() {
  const set = vi.fn()
  const findMany = vi
    .fn()
    .mockResolvedValueOnce([
      { id: 1, documentId: "public", pendingReview: false },
      { id: 2, documentId: "pending", pendingReview: true },
    ])
    .mockResolvedValue([])
  const updateEntriesInMeilisearch = vi.fn(async () => [{ taskUid: 2 }])
  const strapi = {
    db: {},
    store: () => ({
      get: async () => ({ through: "2026-10-01T00:00:00Z" }),
      set,
    }),
    plugin: () => ({
      service: (name: string) =>
        name === "store"
          ? {
              getCredentials: async () => ({
                host: "http://search.test",
                apiKey: "dummy",
              }),
            }
          : { updateEntriesInMeilisearch },
    }),
    config: {
      get: () => ({
        event: {
          settings: { filterableAttributes: ["timeSlot"] },
          entriesQuery: { fields: ["title", "pendingReview"] },
        },
      }),
    },
    documents: () => ({ findMany }),
  }
  const fetchMock = vi.fn(async (url: URL) =>
    Response.json(
      url.pathname.startsWith("/tasks/")
        ? { status: "succeeded" }
        : url.pathname === "/indexes/event"
          ? { primaryKey: "_meilisearch_id" }
          : { taskUid: 1 }
    )
  )

  return { strapi, findMany, set, updateEntriesInMeilisearch, fetchMock }
}
describe("worker event search reconciliation", () => {
  it("reconciles raw worker writes through the plugin privacy filter and advances only after tasks succeed", async () => {
    const { strapi, findMany, set, updateEntriesInMeilisearch, fetchMock } =
      setup()
    await refreshEventSearch(strapi, fetchMock)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 200,
        sort: ["id:asc"],
        filters: expect.objectContaining({
          updatedAt: expect.objectContaining({ $gte: "2026-10-01T00:00:00Z" }),
        }),
      })
    )
    // Include pending rows: updateEntriesInMeilisearch removes any prior public projection for them.
    expect(updateEntriesInMeilisearch).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ pendingReview: true }),
        ]),
      })
    )
    expect(
      fetchMock.mock.calls.some(([url]) => url.pathname === "/tasks/2")
    ).toBe(true)
    expect(set).toHaveBeenCalledOnce()
  })
  it("retains the watermark after a failed write so retry cannot skip a batch", async () => {
    const { strapi, set, updateEntriesInMeilisearch, fetchMock } = setup()
    updateEntriesInMeilisearch.mockRejectedValue(new Error("offline"))
    await expect(refreshEventSearch(strapi, fetchMock)).rejects.toThrow(
      "offline"
    )
    expect(set).not.toHaveBeenCalled()
  })
})
