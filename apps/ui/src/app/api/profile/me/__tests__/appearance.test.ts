import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  profile: vi.fn(),
  invalidate: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock("@/lib/own-profile-server", () => ({ readOwnProfile: mocks.profile }))
vi.mock("@/lib/session-profile", () => ({
  invalidateSessionProfile: mocks.invalidate,
}))
const { GET, PATCH } = await import("../appearance/route")
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/profile/me/appearance", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("APP_PUBLIC_URL", "http://localhost:3000")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
  vi.stubEnv("STRAPI_URL", "http://cms.test")
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockResolvedValue(Response.json({ ok: true }))
  mocks.session.mockResolvedValue({ user: { id: "alice" } })
  mocks.profile.mockResolvedValue({ ok: true, profile: { theme: "dark" } })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("private appearance preference", () => {
  it("ignores the legacy default and caches no owner preference publicly", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/profile/me/appearance", {
        headers: { "X-Appearance-Actor": "alice" },
      })
    )
    expect(await response.json()).toEqual({
      actorId: "alice",
      preference: null,
    })
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
  it("accepts only the three explicit preferences and derives the owner from the session", async () => {
    for (const preference of ["light", "dark", "system"]) {
      expect(
        (await PATCH(request({ actorId: "alice", preference }))).status
      ).toBe(200)
      expect(JSON.parse(mocks.fetch.mock.calls.at(-1)![1].body)).toEqual({
        baUserId: "alice",
        appearancePreference: preference,
      })
    }
    expect(mocks.invalidate).toHaveBeenCalledWith("alice")
  })
  it.each([null, "auto", "Dark", {}, true])(
    "rejects invalid preferences: %s",
    async (preference) => {
      expect(
        (await PATCH(request({ actorId: "alice", preference }))).status
      ).toBe(400)
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )
  it("rejects stale identity, cross-origin and unauthenticated mutations", async () => {
    expect(
      (await PATCH(request({ actorId: "bob", preference: "dark" }))).status
    ).toBe(409)
    expect(
      (
        await PATCH(
          request(
            { actorId: "alice", preference: "dark" },
            "https://elsewhere.test"
          )
        )
      ).status
    ).toBe(403)
    mocks.session.mockResolvedValue(null)
    expect(
      (await PATCH(request({ actorId: "alice", preference: "dark" }))).status
    ).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("reports save failure so the UI can retain local choice and offer retry", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"))
    expect(
      (await PATCH(request({ actorId: "alice", preference: "dark" }))).status
    ).toBe(503)
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
