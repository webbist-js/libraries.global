import { describe, expect, it, vi } from "vitest"

import adminController from "../../src/plugins/events/server/controllers/admin"

const ctxOf = (over: any = {}) => ({
  params: { documentId: "cred00000000000000000001" },
  request: { body: {} },
  state: { user: { id: 9 } },
  set: vi.fn(),
  ...over,
})

function strapiWith(service: any) {
  return { plugin: () => ({ service: () => service }) } as any
}

describe("events admin controller", () => {
  it("looks up bounded published libraries without exposing content-API access", async () => {
    const findMany = vi.fn(async () => [
      { documentId: "lib1", name: "British Library" },
    ])
    const strapi = { documents: vi.fn(() => ({ findMany })) }
    const ctx = ctxOf({
      query: { q: " British ", limit: 999, populate: "*", status: "draft" },
    })
    await adminController({ strapi }).searchLibraries(ctx)
    expect(strapi.documents).toHaveBeenCalledWith("api::library.library")
    expect(findMany).toHaveBeenCalledWith({
      filters: { name: { $containsi: "British" } },
      fields: ["name", "entityRef"],
      status: "published",
      limit: 10,
      sort: ["name:asc", "id:asc"],
    })
    expect(ctx.body.data).toHaveLength(1)
  })
  it("rejects malformed library searches before querying", async () => {
    const documents = vi.fn()
    const ctx = ctxOf({ query: { q: ["British"] } })
    await adminController({ strapi: { documents } }).searchLibraries(ctx)
    expect(ctx.status).toBe(400)
    expect(documents).not.toHaveBeenCalled()
  })
  it("reveals one slot with no-store and the admin as actor", async () => {
    const service = { reveal: vi.fn(async () => ({ apiKey: "v" })) }
    const ctx: any = ctxOf({ request: { body: { slot: "pending" } } })
    await adminController({ strapi: strapiWith(service) }).revealCredential(ctx)
    expect(service.reveal).toHaveBeenCalledWith(
      "cred00000000000000000001",
      "pending",
      "admin:9"
    )
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(ctx.body).toEqual({ data: { apiKey: "v" } })
  })

  it("refuses an unknown slot", async () => {
    const ctx: any = ctxOf({ request: { body: { slot: "other" } } })
    await adminController({ strapi: strapiWith({}) }).revealCredential(ctx)
    expect(ctx.status).toBe(400)
  })

  it("tests in-process and never calls a worker", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const service = { test: vi.fn(async () => ({ result: "ok" })) }
    const ctx: any = ctxOf()
    await adminController({ strapi: strapiWith(service) }).testCredential(ctx)
    expect(ctx.body).toEqual({ result: "ok" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
