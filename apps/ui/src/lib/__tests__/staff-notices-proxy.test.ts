import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  requireStaff: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock("@/lib/access-server", () => ({
  requireStaff: mocks.requireStaff,
  requireEntitlement: () => null,
}))
import { POST as reactivate } from "@/app/api/staff/[documentId]/notices/[noticeId]/reactivate/route"
import { POST } from "@/app/api/staff/[documentId]/notices/route"

const documentId = "library00000000000000001"
const context = { params: Promise.resolve({ documentId }) }
const request = (origin = "https://libraries.example") =>
  new Request(`https://libraries.example/api/staff/${documentId}/notices`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "closure",
      from: "2026-10-06",
      message: "Closed",
      createdByBaUserId: "injected",
    }),
  })
beforeEach(() => {
  vi.clearAllMocks()
  process.env.APP_PUBLIC_URL = "https://libraries.example"
  process.env.STRAPI_BRIDGE_SECRET = "test-only"
  mocks.session.mockResolvedValue({
    user: {
      id: crypto.randomUUID(),
      email: "staff@example.org",
      name: "Staff",
    },
  })
  mocks.requireStaff.mockReturnValue(null)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ notice: { id: "notice" } }))
  )
})
describe("staff notices proxy", () => {
  it("reactivates through the staff bridge using only editable fields", async () => {
    const noticeId = "notice000000000000000001"
    const result = await reactivate(request(), {
      params: Promise.resolve({ documentId, noticeId }),
    })
    expect(result.status).toBe(200)
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(String(url)).toContain(`/notices/${noticeId}/reactivate`)
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
      type: "closure",
      from: "2026-10-06",
      message: "Closed",
    })
    expect(mocks.requireStaff).toHaveBeenCalledWith(
      expect.anything(),
      documentId,
      "notices"
    )
    expect(mocks.revalidateTag).toHaveBeenCalledWith("library", { expire: 0 })
  })
  it("protects reactivation against invalid IDs, cross-origin writes and non-staff", async () => {
    const valid = {
      params: Promise.resolve({
        documentId,
        noticeId: "notice000000000000000001",
      }),
    }
    expect(
      (
        await reactivate(request(), {
          params: Promise.resolve({ documentId, noticeId: "../bad" }),
        })
      ).status
    ).toBe(400)
    expect(
      (await reactivate(request("https://another.example"), valid)).status
    ).toBe(403)
    mocks.requireStaff.mockReturnValue(
      Response.json({ error: "Not found" }, { status: 404 })
    )
    expect((await reactivate(request(), valid)).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("requires staff and forwards no browser supplied actor", async () => {
    expect((await POST(request(), context)).status).toBe(200)
    const args = vi.mocked(fetch).mock.calls[0]![1]!
    expect(JSON.parse(args.body as string)).not.toHaveProperty(
      "createdByBaUserId"
    )
    expect(mocks.requireStaff).toHaveBeenCalledWith(
      expect.anything(),
      documentId,
      "notices"
    )
    expect(mocks.revalidateTag).toHaveBeenCalledWith("library", { expire: 0 })
  })
  it("returns 404 to an unrelated account before calling Strapi", async () => {
    mocks.requireStaff.mockReturnValue(
      Response.json({ error: "Not found" }, { status: 404 })
    )
    expect((await POST(request(), context)).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("checks Origin on writes", async () => {
    expect(
      (await POST(request("https://another.example"), context)).status
    ).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("allows 20 writes per hour and refuses the twenty-first", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "rate-test", email: "staff@example.org" },
    })
    for (let i = 0; i < 20; i += 1)
      expect((await POST(request(), context)).status).toBe(200)
    expect((await POST(request(), context)).status).toBe(429)
    expect(fetch).toHaveBeenCalledTimes(20)
  })
})
