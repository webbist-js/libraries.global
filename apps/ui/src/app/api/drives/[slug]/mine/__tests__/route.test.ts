import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchDrive, session } = vi.hoisted(() => ({
  fetchDrive: vi.fn(),
  session: {
    value: null as null | {
      user: { id: string; email: string; name: string }
    },
  },
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
vi.mock("@/lib/drives/drives-server", () => ({ fetchDrive }))

const fetchMock = vi.fn()

const { GET } = await import("../route")

const DRIVE = { documentId: "drv00000000000000000001", status: "open" }

let n = 0
const get = (slug = "ohio-hours") =>
  GET(new Request(`http://localhost/api/drives/${slug}/mine`), {
    params: Promise.resolve({ slug }),
  })

beforeEach(() => {
  n += 1
  session.value = {
    user: { id: `u${n}`, email: `u${n}@example.org`, name: "Ann Example" },
  }
  fetchDrive.mockReset().mockResolvedValue(DRIVE)
  fetchMock
    .mockReset()
    .mockResolvedValue(
      Response.json({ data: { sent: 4, inReview: 2, accepted: 1 } })
    )
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
})

describe("GET /api/drives/[slug]/mine", () => {
  it("is 401 when signed out", async () => {
    session.value = null
    const res = await get()
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is 404 for a drive that doesn't exist", async () => {
    fetchDrive.mockResolvedValue(null)
    const res = await get("nope")
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("asks Strapi as the signed-in user, by the drive's documentId", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { sent: 4, inReview: 2, accepted: 1 },
    })
    expect(res.headers.get("Cache-Control")).toBe("no-store")

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/api\/drives\/drv00000000000000000001\/mine$/)
    expect(init.headers).toMatchObject({
      "X-Service-Secret": "bridge-secret",
      "X-Ba-User-Id": session.value!.user.id,
    })
  })

  it("never passes through anything but the three counts", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: { sent: "4", inReview: -1, accepted: 2.7, baUserId: "x" },
      })
    )
    const json = await (await get()).json()
    expect(json).toEqual({ data: { sent: 0, inReview: 0, accepted: 2 } })
  })

  it("is 502 when Strapi fails", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 500 }))
    expect((await get()).status).toBe(502)
    fetchMock.mockRejectedValue(new Error("offline"))
    expect((await get()).status).toBe(502)
  })
})
