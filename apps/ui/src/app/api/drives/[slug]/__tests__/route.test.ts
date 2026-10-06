import { beforeEach, describe, expect, it, vi } from "vitest"

const { session, revalidateTag } = vi.hoisted(() => ({
  session: { value: null as null | { user: Record<string, unknown> } },
  revalidateTag: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({ revalidateTag }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
vi.mock("@/lib/drives/drive-progress", () => ({ driveCounts: vi.fn() }))

const fetchMock = vi.fn()

const { PUT } = await import("../route")
const { MemoryRateLimitStore } = await import("@/lib/rate-limit")

const DOC = "drv00000000000000000001"
const BOARD = {
  id: "board-1",
  email: "board@example.test",
  name: "Board Member",
  capabilities: ["drives.manage"],
}

const put = (body: unknown, documentId = DOC) =>
  PUT(
    new Request(`http://localhost/api/drives/${documentId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: documentId }) }
  )

const call = () => fetchMock.mock.calls[0] as unknown as [string, RequestInit]

beforeEach(() => {
  ;(globalThis as { _rateLimitStore?: unknown })._rateLimitStore =
    new MemoryRateLimitStore()
  session.value = { user: { ...BOARD } }
  revalidateTag.mockReset()
  fetchMock
    .mockReset()
    .mockResolvedValue(Response.json({ data: { documentId: DOC } }))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
})

describe("PUT /api/drives/[documentId]", () => {
  it("is 403 without drives.manage, and never calls Strapi", async () => {
    session.value = { user: { ...BOARD, capabilities: [] } }
    const res = await put({ title: "New title" })
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is 400 for a segment that isn't a documentId", async () => {
    const res = await put({ title: "New title" }, "vermont-hours")
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("updates the drive by documentId with the keys it was sent", async () => {
    const res = await put({
      title: "Vermont hours",
      summary: "Every public library in Vermont, with its hours.",
      status: "open",
      pinned: true,
    })
    expect(res.status).toBe(200)
    const [url, init] = call()
    expect(url).toBe(`http://strapi.test/api/drives/${DOC}`)
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual({
      title: "Vermont hours",
      summary: "Every public library in Vermont, with its hours.",
    })
    expect((init.headers as Record<string, string>)["X-Ba-User-Id"]).toBe(
      "board-1"
    )
    expect(revalidateTag).toHaveBeenCalledWith("drive", { expire: 0 })
  })

  it("passes Strapi's 409 for a locked field through", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          data: null,
          error: {
            status: 409,
            message:
              "Only the title, summary, steps and where-to-look can change once a drive is open.",
          },
        },
        { status: 409 }
      )
    )
    const res = await put({ focus: { kind: "gaps", gaps: ["photo"] } })
    expect(res.status).toBe(409)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
