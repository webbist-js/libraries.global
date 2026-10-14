import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE, validBetaPass } from "@/lib/beta/access"

const { limit, redeem } = vi.hoisted(() => ({
  limit: vi.fn(),
  redeem: vi.fn(),
}))
vi.mock("@/lib/beta/attempts", () => ({ betaAttemptLimit: limit }))
vi.mock("@/lib/beta/invitations", () => ({ redeemBetaInvitation: redeem }))
const { POST } = await import("../route")
const code = "a".repeat(43)
const post = (body: unknown, origin = "https://libraries.global") =>
  POST(
    new Request("https://libraries.global/api/beta/access", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  limit.mockResolvedValue({ ok: true })
  redeem.mockResolvedValue({
    invitationId: "i".repeat(24),
    expiresAt: Date.now() + 30 * 86400000,
  })
})
afterEach(() => vi.unstubAllEnvs())

describe("individual beta invitation action", () => {
  it("redeems on POST and sets only the independent HttpOnly beta pass", async () => {
    const res = await post({ code, next: "/libraries" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, next: "/libraries" })
    expect(redeem).toHaveBeenCalledWith(code)
    expect(validBetaPass(res.cookies.get(BETA_COOKIE)?.value)).toBe(true)
    expect(res.cookies.getAll()).toHaveLength(1)
    expect(res.headers.get("set-cookie")).toContain("HttpOnly")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
  it("rejects expired, used or revoked invitations without setting cookies", async () => {
    redeem.mockResolvedValue(null)
    const res = await post({ code })
    expect(res.status).toBe(401)
    expect(res.headers.has("set-cookie")).toBe(false)
  })
  it("rejects shared passwords, cross-origin writes and identity injection before redemption", async () => {
    expect((await post({ code }, "https://evil.example")).status).toBe(403)
    expect((await post({ code, baUserId: "injected" })).status).toBe(400)
    expect((await post({ password: "previous-shared-password" })).status).toBe(
      400
    )
    expect(redeem).not.toHaveBeenCalled()
    expect(limit).not.toHaveBeenCalled()
  })
  it("fails closed on CMS/limiter outages and missing signing configuration", async () => {
    redeem.mockRejectedValue(new Error("CMS offline"))
    expect((await post({ code })).status).toBe(503)
    limit.mockRejectedValue(new Error("Database offline"))
    expect((await post({ code })).status).toBe(503)
    vi.stubEnv("BETA_ACCESS_SECRET", "")
    expect((await post({ code })).status).toBe(503)
  })
  it("preserves retry timing for a lockout and never redeems", async () => {
    limit.mockResolvedValue({ ok: false, retryAfterSeconds: 900 })
    const res = await post({ code })
    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("900")
    expect(res.headers.has("set-cookie")).toBe(false)
    expect(redeem).not.toHaveBeenCalled()
  })
})
