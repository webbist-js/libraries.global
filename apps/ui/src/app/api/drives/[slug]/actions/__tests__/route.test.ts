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

const { POST } = await import("../route")
const { MemoryRateLimitStore } = await import("@/lib/rate-limit")

const DOC = "drv00000000000000000001"
const BOARD = {
  id: "board-1",
  email: "board@example.test",
  name: "Board Member",
  capabilities: ["drives.manage"],
}

const act = (body: unknown, documentId = DOC) =>
  POST(
    new Request(`http://localhost/api/drives/${documentId}/actions`, {
      method: "POST",
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

describe("POST /api/drives/[documentId]/actions", () => {
  it("is 401 signed out and 403 without drives.manage", async () => {
    session.value = null
    expect((await act({ action: "pin" })).status).toBe(401)
    session.value = { user: { ...BOARD, capabilities: ["moderate.queue"] } }
    expect((await act({ action: "pin" })).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(["pin", "unpin", "feature", "unfeature", "cancel", "open", "close"])(
    "forwards %s to the drive's actions route",
    async (action) => {
      const res = await act({ action })
      expect(res.status).toBe(200)
      const [url, init] = call()
      expect(url).toBe(`http://strapi.test/api/drives/${DOC}/actions`)
      expect(init.method).toBe("POST")
      expect(JSON.parse(String(init.body))).toEqual({ action })
      expect(revalidateTag).toHaveBeenCalledWith("drive", { expire: 0 })
    }
  )

  it("forwards only action and pinOrder", async () => {
    await act({ action: "reorder", pinOrder: 2, status: "open", force: true })
    expect(JSON.parse(String(call()[1].body))).toEqual({
      action: "reorder",
      pinOrder: 2,
    })
  })

  it("is 400 for an unknown or missing action, before Strapi", async () => {
    expect((await act({ action: "delete" })).status).toBe(400)
    expect((await act({})).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is 400 for a segment that isn't a documentId", async () => {
    expect((await act({ action: "pin" }, "../lifecycle/run")).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("passes Strapi's refusal through and keeps the cache", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          data: null,
          error: { status: 409, message: "Six drives are already pinned." },
        },
        { status: 409 }
      )
    )
    const res = await act({ action: "pin" })
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe(
      "Six drives are already pinned."
    )
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("shares the 30-a-minute write limit with creates and edits", async () => {
    for (let i = 0; i < 30; i++) await act({ action: "pin" })
    expect((await act({ action: "unpin" })).status).toBe(429)
  })
})
