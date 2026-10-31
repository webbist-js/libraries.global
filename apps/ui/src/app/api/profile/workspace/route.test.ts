import { beforeEach, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  session: vi.fn(),
  profile: vi.fn(),
  drives: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: state.session }))
vi.mock("@/lib/own-profile-server", () => ({ readOwnProfile: state.profile }))
vi.mock("@/lib/drives/followed-drives-server", () => ({
  loadFollowedDriveViews: state.drives,
}))
vi.mock("@/lib/networks/server", () => ({
  readPublicNetwork: async () => ({ affiliations: [] }),
}))
vi.mock("@/lib/avatar", () => ({ avatarSrc: () => null }))
const { GET } = await import("./route")
beforeEach(() => {
  vi.clearAllMocks()
  state.session.mockResolvedValue({
    user: { id: "reader", email: "reader@example.test" },
  })
  state.profile.mockResolvedValue({
    ok: true,
    profile: { username: "reader", followedDrives: [] },
  })
  state.drives.mockResolvedValue([])
})
it("requires a session before resolving any owner data", async () => {
  state.session.mockResolvedValue(null)
  const response = await GET(
    new Request("http://localhost/api/profile/workspace?username=other")
  )
  expect(response.status).toBe(401)
  expect(state.profile).not.toHaveBeenCalled()
  expect(state.drives).not.toHaveBeenCalled()
})
it("binds data to the session, ignores identity input and prevents shared caching", async () => {
  const response = await GET(
    new Request(
      "http://localhost/api/profile/workspace?username=other&locale=fr"
    )
  )
  expect(state.profile).toHaveBeenCalledWith({
    id: "reader",
    email: "reader@example.test",
  })
  expect(state.drives).toHaveBeenCalledWith([], "fr")
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(response.headers.get("vary")).toBe("Cookie")
  expect(await response.json()).toMatchObject({
    actorId: "reader",
    profile: { username: "reader" },
  })
})
it("distinguishes an unavailable CMS from an account that needs profile setup", async () => {
  state.profile.mockResolvedValue({ ok: false, reason: "unavailable" })
  expect(
    (await GET(new Request("http://localhost/api/profile/workspace"))).status
  ).toBe(503)
  state.profile.mockResolvedValue({ ok: false, reason: "not_found" })
  expect(
    await (
      await GET(new Request("http://localhost/api/profile/workspace"))
    ).json()
  ).toMatchObject({ actorId: "reader", profile: null })
})
