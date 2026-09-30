import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const invalidateSessionProfile = vi.fn()
vi.mock("@/lib/session-profile", () => ({ invalidateSessionProfile }))

const { POST } = await import("@/app/api/internal/session/invalidate/route")

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/internal/session/invalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

const SECRET = { "X-Service-Secret": "bridge-secret" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
})

afterEach(() => vi.unstubAllEnvs())

describe("POST /api/internal/session/invalidate", () => {
  it("returns 401 without the secret", async () => {
    const res = await post({ baUserId: "u1" })
    expect(res.status).toBe(401)
    expect(invalidateSessionProfile).not.toHaveBeenCalled()
  })

  it("returns 401 for a wrong secret", async () => {
    const res = await post({ baUserId: "u1" }, { "X-Service-Secret": "nope" })
    expect(res.status).toBe(401)
    expect(invalidateSessionProfile).not.toHaveBeenCalled()
  })

  it("returns 401 when no bridge secret is configured", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
    const res = await post({ baUserId: "u1" }, { "X-Service-Secret": "" })
    expect(res.status).toBe(401)
    expect(invalidateSessionProfile).not.toHaveBeenCalled()
  })

  it.each([
    ["not JSON", "{"],
    ["no baUserId", {}],
    ["an empty baUserId", { baUserId: "" }],
    ["a non-string baUserId", { baUserId: 42 }],
    ["an over-long baUserId", { baUserId: "x".repeat(201) }],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await post(body, SECRET)
    expect(res.status).toBe(400)
    expect(invalidateSessionProfile).not.toHaveBeenCalled()
  })

  it("invalidates the cached profile and returns 204", async () => {
    const res = await post({ baUserId: "u1" }, SECRET)
    expect(res.status).toBe(204)
    expect(invalidateSessionProfile).toHaveBeenCalledExactlyOnceWith("u1")
  })
})
