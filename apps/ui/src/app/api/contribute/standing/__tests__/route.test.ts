import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  value: null as null | { user: { id: string; email: string; name: string } },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))

const fetchMock = vi.fn(async (url: string) =>
  url.includes("/api/rewards/my-standing")
    ? Response.json({ data: { points: 120, tier: "Reader" } })
    : Response.json({ data: { accepted: 2 } })
)

const { GET } = await import("../route")

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
  session.value = {
    user: { id: "u1", email: "u1@example.org", name: "U One" },
  }
})

describe("GET /api/contribute/standing", () => {
  it("returns 401 when signed out", async () => {
    session.value = null
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("adds acceptedCount from Strapi's accepted-count route", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual({ points: 120, tier: "Reader" })
    expect(json.acceptedCount).toBe(2)
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(
      urls.some((u) =>
        u.endsWith("/api/content-moderation/submissions/my/accepted-count")
      )
    ).toBe(true)
  })

  it("reports 0 accepted when the submissions bridge fails", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("my-standing")
        ? Response.json({ data: { points: 0 } })
        : new Response("down", { status: 500 })
    )
    const json = await (await GET()).json()
    expect(json.acceptedCount).toBe(0)
  })
})
