import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import factory from "../src/middlewares/beta-gate"

const next = vi.fn()
const tokens = { hash: vi.fn((key) => `hash:${key}`), getByAccessKey: vi.fn() }
const strapi: any = { config: { get: () => "/api" }, service: () => tokens }
const ctx = (path: string, headers = {}) => ({
  path,
  method: "GET",
  request: { headers },
  set: vi.fn(),
  status: 200,
  body: undefined as unknown,
})
beforeEach(() => {
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "service-test")
  vi.clearAllMocks()
  tokens.getByAccessKey.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())
describe("CMS beta origin gate", () => {
  it.each([
    "/api/libraries",
    "/API/libraries",
    "//api/libraries",
    "/api/events",
    "/api/subscribers",
  ])("refuses anonymous %s", async (path) => {
    const c = ctx(path)
    await factory(null, { strapi })(c, next)
    expect(c.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
  it("allows bridge reads and valid content API credentials", async () => {
    await factory(null, { strapi })(
      ctx("/api/libraries", { "x-service-secret": "service-test" }),
      next
    )
    expect(next).toHaveBeenCalledOnce()
    tokens.getByAccessKey.mockResolvedValue({
      kind: "content-api",
      expiresAt: null,
    })
    await factory(null, { strapi })(
      ctx("/api/libraries", { authorization: "Bearer server-token" }),
      next
    )
    expect(next).toHaveBeenCalledTimes(2)
  })
  it("rejects expired and admin tokens", async () => {
    for (const token of [
      { kind: "content-api", expiresAt: "2000-01-01" },
      { kind: "admin" },
    ]) {
      tokens.getByAccessKey.mockResolvedValue(token)
      const c = ctx("/api/libraries", { authorization: "Bearer bad" })
      await factory(null, { strapi })(c, next)
      expect(c.status).toBe(401)
    }
    expect(next).not.toHaveBeenCalled()
  })
  it("preserves admin access and gate-off behaviour", async () => {
    await factory(null, { strapi })(ctx("/admin"), next)
    vi.stubEnv("BETA_GATE_ENABLED", "false")
    await factory(null, { strapi })(ctx("/api/libraries"), next)
    expect(next).toHaveBeenCalledTimes(2)
  })
})
