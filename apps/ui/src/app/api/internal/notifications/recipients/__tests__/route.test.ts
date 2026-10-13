import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authDbPool: { query } }))
import { POST } from "../route"

beforeEach(() => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
  query.mockReset()
  query.mockResolvedValue({
    rows: [{ id: "owner", email: "verified@example.org" }],
  })
})
afterEach(() => vi.unstubAllEnvs())
it("requires service authentication before accessing account addresses", async () => {
  const res = await POST(
    new Request("http://localhost/api/internal/notifications/recipients", {
      method: "POST",
      body: JSON.stringify({ ids: ["owner"] }),
    })
  )
  expect(res.status).toBe(401)
  expect(query).not.toHaveBeenCalled()
})
it("looks up only verified addresses with bound ids and disables caching", async () => {
  const res = await POST(
    new Request("http://localhost/api/internal/notifications/recipients", {
      method: "POST",
      headers: { "x-service-secret": "fixture" },
      body: JSON.stringify({ ids: ["owner"] }),
    })
  )
  expect(res.status).toBe(200)
  expect(res.headers.get("cache-control")).toContain("no-store")
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('"emailVerified" = true'),
    [["owner"]]
  )
})
