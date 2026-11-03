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
