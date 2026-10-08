import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const readOwnProfile = vi.fn()
const invalidateSessionProfile = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))
vi.mock("@/lib/own-profile-server", () => ({ readOwnProfile }))
vi.mock("@/lib/session-profile", () => ({ invalidateSessionProfile }))

vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")

const { PUT } = await import("../route")

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/profile/me/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

const user = { id: "u1", email: "u1@example.org", name: "Reader" }
const stored = (dismissedPrompts: unknown) =>
  readOwnProfile.mockResolvedValue({
    ok: true,
    profile: { username: "ada", dismissedPrompts },
  })
const savedList = () =>
  JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
    baUserId: string
    dismissedPrompts: string[]
  }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(Response.json({ ok: true }))
  getSession.mockResolvedValue({ user, session: { id: "s1" } })
})

describe("PUT /api/profile/me/prompts", () => {
  it("adds the prompt to the stored list and refreshes the session", async () => {
    stored(["retired-prompt"])

    const res = await put({ prompt: "find-contribute", dismissed: true })

    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://strapi.test/api/auth-bridge/upsert-profile"
    )
    expect(savedList()).toEqual({
      baUserId: "u1",
      dismissedPrompts: ["find-contribute"],
    })
    expect(invalidateSessionProfile).toHaveBeenCalledWith("u1")
  })

  it("doesn't repeat a prompt that is already hidden", async () => {
    stored(["find-contribute"])

    await put({ prompt: "find-contribute", dismissed: true })

    expect(savedList().dismissedPrompts).toEqual(["find-contribute"])
  })

  it("removes the prompt to show it again", async () => {
    stored(["find-contribute"])

    await put({ prompt: "find-contribute", dismissed: false })

    expect(savedList().dismissedPrompts).toEqual([])
  })

  it("refuses an unknown prompt", async () => {
    expect((await put({ prompt: "anything", dismissed: true })).status).toBe(
      400
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("doesn't create a profile for a user who has none", async () => {
    readOwnProfile.mockResolvedValue({ ok: false, reason: "not_found" })

    expect(
      (await put({ prompt: "find-contribute", dismissed: true })).status
    ).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 401 when signed out", async () => {
    getSession.mockResolvedValue(null)

    expect(
      (await put({ prompt: "find-contribute", dismissed: true })).status
    ).toBe(401)
  })
})
