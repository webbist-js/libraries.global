import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const invalidateSessionProfile = vi.fn()
vi.mock("@/lib/session-profile", () => ({ invalidateSessionProfile }))

const fetchMock = vi.fn()

const { deleteStrapiProfile } = await import("../delete-profile")

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")
  fetchMock.mockResolvedValue(Response.json({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("deleteStrapiProfile", () => {
  it("calls the delete-profile bridge with the secret and the account", async () => {
    const result = await deleteStrapiProfile({
      baUserId: "u1",
      email: "u1@example.org",
    })

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/auth-bridge/delete-profile")
    expect(init).toMatchObject({ method: "POST", cache: "no-store" })
    expect(init.headers).toMatchObject({ "X-Service-Secret": "s3cret" })
    expect(JSON.parse(init.body as string)).toEqual({
      baUserId: "u1",
      email: "u1@example.org",
    })
    expect(invalidateSessionProfile).toHaveBeenCalledWith("u1")
  })

  it("reports a Strapi failure and does not invalidate the session profile", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))

    const result = await deleteStrapiProfile({
      baUserId: "u1",
      email: "u1@example.org",
    })

    expect(result).toEqual({ ok: false, reason: "strapi" })
    expect(invalidateSessionProfile).not.toHaveBeenCalled()
  })

  it("reports an unreachable Strapi", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    expect(
      await deleteStrapiProfile({ baUserId: "u1", email: "u1@example.org" })
    ).toEqual({ ok: false, reason: "strapi" })
  })

  it("refuses without calling Strapi when the bridge secret is missing", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")

    expect(
      await deleteStrapiProfile({ baUserId: "u1", email: "u1@example.org" })
    ).toEqual({ ok: false, reason: "unconfigured" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
