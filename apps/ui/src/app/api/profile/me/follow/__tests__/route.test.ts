import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

vi.stubEnv("APP_PUBLIC_URL", "http://localhost")
vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")

const { GET, POST } = await import("../route")

const DRIVE_ID = "k3v9qz2m8x7w6c5b4n1p0r9t"
const LIBRARY_ID = "a1b2c3d4e5f6g7h8i9j0k1l2"

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/profile/me/follow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(body),
    })
  )
const get = (query: string) =>
  GET(new Request(`http://localhost/api/profile/me/follow?${query}`))

const sentBody = () =>
  JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<
    string,
    unknown
  >

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(Response.json({ following: true }))
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } })
})

describe("POST /api/profile/me/follow", () => {
  it("follows a drive through the bridge, as the signed-in user", async () => {
    const res = await post({ driveDocumentId: DRIVE_ID, action: "follow" })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ following: true })
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://strapi.test/api/auth-bridge/toggle-follow"
    )
    expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({
      "X-Service-Secret": "s3cret",
    })
    expect(sentBody()).toEqual({
      baUserId: "u1",
      driveDocumentId: DRIVE_ID,
      action: "follow",
    })
  })

  it("still follows a library", async () => {
    await post({ libraryDocumentId: LIBRARY_ID, action: "unfollow" })

    expect(sentBody()).toEqual({
      baUserId: "u1",
      libraryDocumentId: LIBRARY_ID,
      action: "unfollow",
    })
  })

  it("refuses a malformed drive id without calling Strapi", async () => {
    for (const driveDocumentId of [
      "../../admin",
      "short",
      "UPPERCASE0123456789ABCDEF",
      42,
      "",
    ]) {
      const res = await post({ driveDocumentId, action: "follow" })
      expect(res.status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses both ids at once, neither, or an unknown action", async () => {
    expect(
      (
        await post({
          driveDocumentId: DRIVE_ID,
          libraryDocumentId: LIBRARY_ID,
          action: "follow",
        })
      ).status
    ).toBe(400)
    expect((await post({ action: "follow" })).status).toBe(400)
    expect(
      (await post({ driveDocumentId: DRIVE_ID, action: "toggle" })).status
    ).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("passes on Strapi's not found for a draft drive", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "Drive not found" }, { status: 404 })
    )

    const res = await post({ driveDocumentId: DRIVE_ID, action: "follow" })

    expect(res.status).toBe(404)
  })

  it("needs a session", async () => {
    getSession.mockResolvedValue(null)

    const res = await post({ driveDocumentId: DRIVE_ID, action: "follow" })

    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/profile/me/follow", () => {
  it("asks whether the user follows a drive", async () => {
    const res = await get(`driveDocumentId=${DRIVE_ID}`)

    expect(await res.json()).toEqual({ following: true })
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.pathname).toBe("/api/auth-bridge/follow-status")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      baUserId: "u1",
      driveDocumentId: DRIVE_ID,
    })
  })

  it("refuses a bad id, or both ids", async () => {
    expect((await get("driveDocumentId=nope")).status).toBe(400)
    expect(
      (await get(`driveDocumentId=${DRIVE_ID}&libraryDocumentId=${LIBRARY_ID}`))
        .status
    ).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("write boundary", () => {
  it.each([null, [], 42, { name: 42 }, { unexpected: true }])(
    "rejects malformed payload %j without an upstream write",
    async (body) => {
      getSession.mockResolvedValue({
        user: { id: "validation-user", email: "reader@example.org" },
      })
      fetchMock.mockClear()
      expect((await post(body)).status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )
  it("refuses cross-site writes", async () => {
    const response = await POST(
      new Request("http://localhost/api/profile/me/follow", {
        method: "POST",
        headers: {
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    )
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("caps request size", async () => {
    getSession.mockResolvedValue({
      user: { id: "size-user", email: "reader@example.org" },
    })
    expect((await post({ padding: "x".repeat(17000) })).status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it("reports unavailable follow status instead of unfollowed", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }))
  expect((await get(`driveDocumentId=${DRIVE_ID}`)).status).toBe(503)
})
