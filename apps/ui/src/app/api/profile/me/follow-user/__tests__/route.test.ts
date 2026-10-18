import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { session, upstream } = vi.hoisted(() => ({
  session: vi.fn(),
  upstream: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: async () => ({ ok: true }) }),
  rateLimitResponse: () => Response.json({}, { status: 429 }),
}))
vi.stubEnv("STRAPI_URL", "https://cms.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-bridge-secret")
vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
const { GET, POST } = await import("../route")
const send = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://libraries.global/api/profile/me/follow-user", {
      method: "POST",
      headers: {
        Origin: "https://libraries.global",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    })
  )
beforeEach(() => {
  vi.clearAllMocks()
  session.mockResolvedValue({ user: { id: "account-a" } })
  upstream.mockResolvedValue(Response.json({ following: true }))
  vi.stubGlobal("fetch", upstream)
})
afterEach(() => vi.unstubAllGlobals())
describe("follow-person bridge boundary", () => {
  it("refuses foreign and absent Origin before resolving a session or forwarding a write", async () => {
    expect(
      (
        await send(
          { username: "public_reader", action: "follow" },
          { Origin: "https://untrusted.libraries.global" }
        )
      ).status
    ).toBe(403)
    const request = new Request(
      "https://libraries.global/api/profile/me/follow-user",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    )
    expect((await POST(request)).status).toBe(403)
    expect(session).not.toHaveBeenCalled()
    expect(upstream).not.toHaveBeenCalled()
  })
  it("caps actual bytes and refuses unsupported media and invalid shapes", async () => {
    expect(
      (
        await send(
          { username: "public_reader", action: "follow" },
          { "Content-Type": "text/plain" }
        )
      ).status
    ).toBe(415)
    expect(
      (await send({ username: "x".repeat(5000), action: "follow" })).status
    ).toBe(413)
    for (const body of [
      null,
      [],
      { username: 7, action: "follow" },
      { username: "public_reader", action: "toggle" },
      { username: "public_reader", action: "follow", baUserId: "other" },
    ])
      expect((await send(body)).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
  it("forwards only typed action/target and the authenticated actor", async () => {
    const result = await send(
      { username: "public_reader", action: "follow" },
      { "Content-Type": "application/json; charset=utf-8" }
    )
    expect(result.status).toBe(200)
    expect(JSON.parse(upstream.mock.calls[0]![1].body)).toEqual({
      baUserId: "account-a",
      targetUsername: "public_reader",
      action: "follow",
    })
  })
  it("follows a bounded historical public target with a hyphen and reads its status", async () => {
    expect(
      (await send({ username: "preview-writer", action: "follow" })).status
    ).toBe(200)
    expect(JSON.parse(upstream.mock.calls[0]![1].body)).toMatchObject({
      baUserId: "account-a",
      targetUsername: "preview-writer",
    })
    upstream.mockResolvedValueOnce(Response.json({ following: false }))
    expect(
      (
        await GET(
          new Request(
            "https://libraries.global/api/profile/me/follow-user?targetUsername=preview-writer"
          )
        )
      ).status
    ).toBe(200)
    for (const username of ["../other", "control\n", "x".repeat(31)])
      expect((await send({ username, action: "follow" })).status).toBe(400)
  })
  it("reports unavailable status instead of inventing Not following", async () => {
    upstream.mockResolvedValue(new Response(null, { status: 503 }))
    expect(
      (
        await GET(
          new Request(
            "https://libraries.global/api/profile/me/follow-user?targetUsername=public_reader"
          )
        )
      ).status
    ).toBe(503)
  })
})
