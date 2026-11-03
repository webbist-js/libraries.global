import { strapiAdapter } from "@strapi-community/plugin-better-auth"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

function fixture() {
  const findMany = vi.fn(async () => [])
  vi.stubGlobal("strapi", { documents: () => ({ findMany }) })
  const adapter = strapiAdapter()({
    advanced: { database: { generateId: "serial" } },
  })

  return { adapter, findMany }
}

describe("Strapi Better Auth adapter contract", () => {
  it("retains both bounds when a query repeats a field", async () => {
    const { adapter, findMany } = fixture()
    const after = new Date("2026-01-01T00:00:00Z")
    const before = new Date("2026-02-01T00:00:00Z")
    await adapter.findMany({
      model: "session",
      where: [
        { field: "expiresAt", operator: "gt", value: after },
        { field: "expiresAt", operator: "lt", value: before },
      ],
    })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          $and: [{ expiresAt: { $gt: after } }, { expiresAt: { $lt: before } }],
        },
      })
    )
  })

  it("does not drop the owner constraint when filtering accounts", async () => {
    const { adapter, findMany } = fixture()
    await adapter.findMany({
      model: "account",
      where: [
        { field: "userId", value: "7" },
        { field: "providerId", value: "credential" },
      ],
    })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          $and: [{ userId: { $eq: 7 } }, { providerId: { $eq: "credential" } }],
        },
      })
    )
  })
})

describe("atomic Better Auth fallbacks", () => {
  it("lets only one concurrent request consume a verification token", async () => {
    const row = {
      id: 1,
      documentId: "verification-document",
      identifier: "single-use-token",
      value: "owner",
      expiresAt: new Date("2030-01-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    }
    let present = true
    const deleteMany = vi.fn(async () => {
      const count = present ? 1 : 0
      present = false

      return { count }
    })
    vi.stubGlobal("strapi", {
      documents: () => ({ findFirst: async () => ({ ...row }) }),
      db: { query: () => ({ deleteMany }) },
    })
    const adapter = strapiAdapter()({
      advanced: { database: { generateId: "serial" } },
    })
    const consume = () =>
      adapter.consumeOne({
        model: "verification",
        where: [{ field: "identifier", value: row.identifier }],
      })
    const results = await Promise.all([consume(), consume()])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        $and: expect.arrayContaining([
          { identifier: { $eq: row.identifier } },
          { id: { $eq: 1 } },
        ]),
      },
    })
  })

  it("keeps the counter guard in the database update and reports a lost race", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }))
    vi.stubGlobal("strapi", { db: { query: () => ({ updateMany }) } })
    const adapter = strapiAdapter()({
      advanced: { database: { generateId: "serial" } },
      rateLimit: { enabled: true, storage: "database" },
    })
    const count = await adapter.updateMany({
      model: "rateLimit",
      where: [
        { field: "key", value: "login" },
        { field: "count", operator: "lt", value: 5 },
        { field: "count", value: 4 },
      ],
      update: { count: 5 },
    })
    expect(count).toBe(0)
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        $and: [
          { key: { $eq: "login" } },
          { count: { $lt: 5 } },
          { count: { $eq: 4 } },
        ],
      },
      data: { count: 5 },
    })
  })

  it("returns PostgreSQL int8 timestamps as numbers for retry arithmetic", async () => {
    const lastRequest = Date.now()
    vi.stubGlobal("strapi", {
      documents: () => ({
        findFirst: async () => ({
          id: 1,
          key: "login",
          count: 1,
          lastRequest: String(lastRequest),
        }),
      }),
    })
    const adapter = strapiAdapter()({
      advanced: { database: { generateId: "serial" } },
      rateLimit: { enabled: true, storage: "database" },
    })
    const row = await adapter.findOne<{ lastRequest: number }>({
      model: "rateLimit",
      where: [{ field: "key", value: "login" }],
    })
    expect(row?.lastRequest).toBe(lastRequest)
  })
})
