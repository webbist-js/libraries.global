import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE, validBetaPass } from "@/lib/beta/access"

const { limit } = vi.hoisted(() => ({ limit: vi.fn() }))
vi.mock("@/lib/beta/attempts", () => ({ betaAttemptLimit: limit }))
const { POST } = await import("../route")
const post = (body: unknown, origin = "https://libraries.global") =>
  POST(
    new Request("https://libraries.global/api/beta/access", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
beforeEach(() => {
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("BETA_PASSWORD", "beta-test")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  limit.mockResolvedValue({ ok: true })
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllEnvs())

describe("beta password action", () => {
  it("sets only an HttpOnly beta pass with a safe destination", async () => {
    const res = await post({ password: "beta-test", next: "/libraries" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, next: "/libraries" })
    const cookie = res.cookies.get(BETA_COOKIE)
    expect(validBetaPass(cookie?.value)).toBe(true)
    expect(res.cookies.getAll()).toHaveLength(1)
    expect(res.headers.get("set-cookie")).toContain("HttpOnly")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
  it("rejects a wrong password without setting cookies", async () => {
    const res = await post({ password: "wrong" })
    expect(res.status).toBe(401)
    expect(res.headers.has("set-cookie")).toBe(false)
  })
  it("rejects cross-origin writes and identity fields", async () => {
    expect(
      (await post({ password: "beta-test" }, "https://evil.example")).status
    ).toBe(403)
    expect(
      (await post({ password: "beta-test", baUserId: "injected" })).status
    ).toBe(400)
    expect(limit).not.toHaveBeenCalled()
  })
  it("fails closed on missing config or an unavailable shared limiter", async () => {
    limit.mockRejectedValue(new Error("Database offline"))
    expect((await post({ password: "beta-test" })).status).toBe(503)
    vi.stubEnv("BETA_PASSWORD", "")
    expect((await post({ password: "beta-test" })).status).toBe(503)
  })
  it("preserves retry timing for a lockout", async () => {
    limit.mockResolvedValue({ ok: false, retryAfterSeconds: 900 })
    const res = await post({ password: "beta-test" })
    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("900")
    expect(res.headers.has("set-cookie")).toBe(false)
  })
})
