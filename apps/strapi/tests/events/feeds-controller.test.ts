import { beforeEach, describe, expect, it, vi } from "vitest"

import feedsController from "../../src/plugins/events/server/controllers/feeds"
import routes from "../../src/plugins/events/server/routes/content-api"

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "bridge"
})

const ctxOf = (headers: Record<string, string>, extra: any = {}) => ({
  request: { headers, body: {} },
  params: {},
  set: vi.fn(),
  ...extra,
})

describe("feeds controller", () => {
  it("answers 401 without the bridge secret", async () => {
    const ctx: any = ctxOf({ "x-ba-user-id": "u1" })
    await feedsController({
      strapi: { plugin: () => ({ service: () => ({}) }) },
    }).list(ctx)
    expect(ctx.status).toBe(401)
  })

  it("passes the bridge user to the service and wraps the result", async () => {
    const list = vi.fn(async () => ({ libraries: [] }))
    const ctx: any = ctxOf({
      "x-service-secret": "bridge",
      "x-ba-user-id": "u1",
    })
    await feedsController({
      strapi: { plugin: () => ({ service: () => ({ list }) }) },
    }).list(ctx)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }))
    expect(ctx.body).toEqual({ data: { libraries: [] } })
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "no-store")
  })

  it("maps a service error to its status", async () => {
    const pause = vi.fn(async () => ({
      error: { status: 404, name: "not_found", message: "Feed not found." },
    }))
    const ctx: any = ctxOf(
      { "x-service-secret": "bridge", "x-ba-user-id": "u1" },
      { params: { documentId: "a".repeat(24) } }
    )
    await feedsController({
      strapi: { plugin: () => ({ service: () => ({ pause }) }) },
    }).pause(ctx)
    expect(ctx.status).toBe(404)
  })

  it("no longer exposes credential-submit", () => {
    expect((routes as any[]).some((r) => r.path === "/credential-submit")).toBe(
      false
    )
  })
})
