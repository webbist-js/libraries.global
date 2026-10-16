import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  invalidate: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock("@/lib/delete-profile", () => ({ deleteStrapiProfile: vi.fn() }))
vi.mock("@/lib/own-profile-server", () => ({ readOwnProfile: vi.fn() }))
vi.mock("@/lib/session-profile", () => ({
  invalidateSessionProfile: mocks.invalidate,
}))
vi.stubEnv("STRAPI_BRIDGE_SECRET", "local-test-secret")
vi.stubEnv("STRAPI_URL", "http://cms.test")
const { PATCH, PUT } = await import("../route")
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/profile/me", {
    method: "PATCH",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("APP_PUBLIC_URL", "http://localhost:3000")
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockResolvedValue(Response.json({ ok: true }))
  mocks.session.mockResolvedValue({ user: { id: "owner" } })
})
afterEach(() => vi.unstubAllGlobals())

describe("profile preference proxy", () => {
  it("saves a palette with session-derived identity and never accepts image IDs", async () => {
    expect(
      (
        await PUT(
          request({
            profileBackground: "rose",
            coverImageFileId: 17,
            avatarFileId: 18,
            baUserId: "another",
          })
        )
      ).status
    ).toBe(200)
    expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body)).toEqual({
      baUserId: "owner",
      profileBackground: "rose",
    })
  })
  it.each(["invalid", "url(https://example.test)", null])(
    "rejects an invalid palette: %s",
    async (profileBackground) => {
      expect((await PATCH(request({ profileBackground }))).status).toBe(400)
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )
  it("rejects oversized streamed and non-JSON profile writes before contacting CMS", async () => {
    expect((await PUT(request({ bio: "x".repeat(64 * 1024) }))).status).toBe(
      413
    )
    expect(
      (
        await PATCH(
          new Request("http://localhost:3000/api/profile/me", {
            method: "PATCH",
            headers: {
              origin: "http://localhost:3000",
              "content-type": "text/plain",
            },
            body: "{}",
          })
        )
      ).status
    ).toBe(415)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("derives ownership from the session and forwards only allowed preferences", async () => {
    expect(
      (
        await PATCH(
          request({
            supporterListed: false,
            supporterBadgeVisible: true,
            baUserId: "another-user",
            plan: "team",
          })
        )
      ).status
    ).toBe(200)
    expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body)).toEqual({
      baUserId: "owner",
      supporterListed: false,
      supporterBadgeVisible: true,
    })
    expect(mocks.invalidate).toHaveBeenCalledWith("owner")
  })
  it("denies unauthenticated and cross-site writes without touching Strapi", async () => {
    expect(
      (
        await PATCH(
          request({ supporterListed: false }, "https://elsewhere.test")
        )
      ).status
    ).toBe(403)
    mocks.session.mockResolvedValue(null)
    expect((await PATCH(request({ supporterListed: false }))).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it("rejects non-boolean preferences before the bridge write", async () => {
    expect((await PATCH(request({ supporterListed: "false" }))).status).toBe(
      400
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
