import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock("@/lib/library-editor-server", () => ({
  loadLibraryEditor: mocks.load,
}))
const { GET } = await import("../route")
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({
    user: { id: "viewer", email: "viewer@example.org" },
  })
  mocks.load.mockResolvedValue({ target: { documentId: "record" } })
})
const get = (slug = "library", qs = "") =>
  GET(
    new Request(`http://localhost/api/contribute/library/${slug}/editor${qs}`),
    { params: Promise.resolve({ slug }) }
  )
it("does not load editor context for anonymous requests", async () => {
  mocks.session.mockResolvedValue(null)
  expect((await get()).status).toBe(401)
  expect(mocks.load).not.toHaveBeenCalled()
})
it("uses the authenticated actor, validates the target and keeps the response private", async () => {
  const response = await get("library", "?locale=fr&step=hours")
  expect(mocks.load).toHaveBeenCalledWith(
    "library",
    { id: "viewer", email: "viewer@example.org" },
    "fr",
    "hours"
  )
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect((await get("bad_slug")).status).toBe(404)
})
