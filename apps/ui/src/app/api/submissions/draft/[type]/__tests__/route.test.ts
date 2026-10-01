import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn(async () => Response.json({ data: null }))

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")

const { GET } = await import("../route")

const get = (qs: string) =>
  GET(new Request(`http://localhost/api/submissions/draft/correction${qs}`), {
    params: Promise.resolve({ type: "correction" }),
  })

const strapiUrl = () =>
  new URL(String((fetchMock.mock.calls[0] as unknown[])[0]))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  getSession.mockResolvedValue({
    user: { id: "u1", email: "u@x.org", name: "U" },
  })
})

describe("GET /api/submissions/draft/[type]", () => {
  it("forwards the draft's locale", async () => {
    await get("?targetSlug=bl&locale=cs")
    expect(strapiUrl().searchParams.get("locale")).toBe("cs")
    expect(strapiUrl().searchParams.get("targetSlug")).toBe("bl")
  })

  it("sends no locale without one", async () => {
    await get("?targetSlug=bl")
    expect(strapiUrl().searchParams.has("locale")).toBe(false)
  })

  it("drops a malformed locale", async () => {
    await get("?targetSlug=bl&locale=" + encodeURIComponent('cs"]'))
    expect(strapiUrl().searchParams.has("locale")).toBe(false)
  })
})
