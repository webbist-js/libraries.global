import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => vi.fn())
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
import { GET } from "../route"

const request = () =>
  new Request(
    "https://site.example/api/contribute/article?kind=knowledge&slug=story&locale=fr"
  )

beforeEach(() => {
  vi.resetAllMocks()
  session.mockResolvedValue({ user: { id: "u1" } })
})
describe("translation lookups", () => {
  it.each([403, 500, 503])(
    "preserves upstream failure %s instead of claiming the translation is absent",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json({ error: "Internal details" }, { status })
          )
      )
      const response = await GET(request())
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({
        error: "The article could not be loaded.",
      })
    }
  )
  it("treats a genuine missing translation as empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ error: "Missing" }, { status: 404 }))
    )
    expect(await (await GET(request())).json()).toEqual({ data: null })
  })
  it("fails safely when the CMS cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Connection failed"))
    )
    expect((await GET(request())).status).toBe(503)
  })
  it("returns only editor content and its pinned revision", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: {
            title: "French",
            summary: "",
            body: [],
            contentRevision: "revision",
            authorEmail: "private@example.org",
          },
        })
      )
    )
    expect(await (await GET(request())).json()).toEqual({
      data: {
        title: "French",
        summary: "",
        body: [],
        contentRevision: "revision",
        sections: [],
        tags: [],
        eventMentions: [],
      },
    })
  })
})
