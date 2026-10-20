import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ bridge: vi.fn(), fetch: vi.fn() }))
vi.mock("@/lib/saved-events-bridge", () => ({
  STRAPI: "http://cms.test",
  savedEventsBridgeHeaders: mocks.bridge,
}))
import { DELETE } from "../[id]/route"
import { GET, POST } from "../route"

const ID = "a1b2c3d4e5f6g7h8i9j0k1l2"
const request = (body: unknown, origin = "http://app.test") =>
  new Request("http://app.test/api/saved-events", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("APP_PUBLIC_URL", "http://app.test")
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.bridge.mockResolvedValue({ "X-Service-Secret": "dummy" })
})
it("separates a missing session from unavailable saved-event storage", async () => {
  mocks.bridge.mockResolvedValueOnce(null)
  expect((await GET()).status).toBe(401)
  mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }))
  expect((await GET()).status).toBe(503)
  mocks.fetch.mockRejectedValueOnce(new Error("offline"))
  expect((await GET()).status).toBe(503)
})
it.each([
  null,
  3,
  [],
  { eventDocumentId: 3 },
  { eventDocumentId: ID, userId: "someone-else" },
])("rejects malformed saved-event bodies %j", async (body) => {
  expect((await POST(request(body))).status).toBe(400)
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it("caps the saved-event body and refuses cross-site creates and deletes", async () => {
  expect((await POST(request({ extra: "x".repeat(5000) }))).status).toBe(413)
  expect(
    (await POST(request({ eventDocumentId: ID }, "https://other.test"))).status
  ).toBe(403)
  expect(
    (
      await DELETE(request({}, "https://other.test"), {
        params: Promise.resolve({ id: ID }),
      })
    ).status
  ).toBe(403)
  expect(mocks.fetch).not.toHaveBeenCalled()
})
