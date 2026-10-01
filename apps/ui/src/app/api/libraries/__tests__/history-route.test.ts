import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))
// next-intl's navigation can't load under vitest; only the routing is used.
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["cs", "en"], defaultLocale: "en" },
}))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: {} }))

const { GET } = await import("../[slug]/history/route")

const DOC = "abcdefghijklmnopqrstuvwx"

const STRAPI_PAGE = {
  data: [
    {
      batchId: "b1",
      changedAt: "2026-09-20T10:00:00.000Z",
      action: "update",
      source: "submission",
      actor: { kind: "contributor", username: "ada" },
      fields: [{ field: "website", previous: "a", next: "b" }],
      submissionDocumentId: null,
    },
  ],
  meta: { page: 1, pageSize: 20, total: 1 },
}

const user = (features: string[]) => ({
  user: { id: "u1", email: "ada@example.com", name: "Ada", features },
  session: {},
})

const call = (id = DOC, query = "") =>
  GET(new Request(`http://localhost/api/libraries/${id}/history${query}`), {
    params: Promise.resolve({ slug: id }),
  })

/** The URL and headers of the one Strapi call. */
function strapiCall() {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

  return {
    url: new URL(url),
    headers: new Headers(init?.headers as HeadersInit),
  }
}

beforeEach(() => {
  process.env.STRAPI_URL = "http://strapi.test"
  process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  getSession.mockReset()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => Response.json(STRAPI_PAGE))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("GET /api/libraries/[documentId]/history", () => {
  it("asks for values, with the bridge secret, when the session has library.history", async () => {
    getSession.mockResolvedValue(user(["library.history"]))
    const res = await call(DOC, "?page=2")
    expect(res.status).toBe(200)
    const { url, headers } = strapiCall()
    expect(url.pathname).toBe(
      `/api/content-moderation/libraries/${DOC}/history`
    )
    expect(url.searchParams.get("values")).toBe("1")
    expect(url.searchParams.get("page")).toBe("2")
    expect(headers.get("X-Service-Secret")).toBe("s3cret")
    expect(headers.get("X-Ba-User-Id")).toBe("u1")
    const body = await res.json()
    expect(body.data[0].fields[0]).toEqual({
      field: "website",
      previous: "a",
      next: "b",
    })
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })

  it("sends no secret and no values flag without the feature, and strips any values", async () => {
    getSession.mockResolvedValue(user([]))
    const res = await call()
    const { url, headers } = strapiCall()
    expect(url.searchParams.has("values")).toBe(false)
    expect(headers.has("X-Service-Secret")).toBe(false)
    const body = await res.json()
    expect(body.data[0].fields[0]).toEqual({ field: "website" })
  })

  it("serves field names to signed-out visitors (no entitlement needed)", async () => {
    getSession.mockResolvedValue(null)
    const res = await call()
    expect(res.status).toBe(200)
    expect(strapiCall().url.searchParams.has("values")).toBe(false)
  })

  it("rejects a malformed documentId without calling Strapi", async () => {
    getSession.mockResolvedValue(null)
    for (const bad of ["short", "UPPERCASEUPPERCASEUPPER", "abc/../../admin"]) {
      const res = await call(bad)
      expect(res.status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ["?page=0", "1"],
    ["?page=-4", "1"],
    ["?page=250", "100"],
    ["?page=abc", "1"],
    ["", "1"],
  ])("clamps page %s to %s", async (query, expected) => {
    getSession.mockResolvedValue(null)
    await call(DOC, query)
    expect(strapiCall().url.searchParams.get("page")).toBe(expected)
  })

  it("is a 502 when Strapi can't answer", async () => {
    getSession.mockResolvedValue(null)
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }))
    expect((await call()).status).toBe(502)
  })
})
