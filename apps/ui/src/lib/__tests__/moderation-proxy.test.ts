import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn(async () => Response.json({ data: [] }))

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")

const { proxyModeration, SUBMISSION_LIST_PARAMS } =
  await import("../moderation-proxy")
const { MemoryRateLimitStore } = await import("../rate-limit")

const MODERATOR = {
  id: "mod-1",
  email: "mod@x.org",
  name: "Mod",
  capabilities: ["moderate.queue"],
}
const DOC = "abcdefghijklmnopqrstuvwx"

const strapiCall = () =>
  fetchMock.mock.calls[0] as unknown as [string, RequestInit]
const strapiUrl = () => new URL(String(strapiCall()[0]))

const list = (qs: string) =>
  proxyModeration(
    new Request(`http://localhost/api/moderation/submissions${qs}`),
    { path: "submissions", params: SUBMISSION_LIST_PARAMS }
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  // A fresh limiter store per test.
  ;(globalThis as { _rateLimitStore?: unknown })._rateLimitStore =
    new MemoryRateLimitStore()
  getSession.mockResolvedValue({ user: MODERATOR })
})

describe("proxyModeration", () => {
  it("401 without a session, and never calls Strapi", async () => {
    getSession.mockResolvedValue(null)
    const res = await list("")
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("403 without moderate.queue, and never calls Strapi", async () => {
    getSession.mockResolvedValue({
      user: { ...MODERATOR, capabilities: ["submit.correction"] },
    })
    const res = await list("?status=pending")
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("forwards allowlisted params only, with valid values", async () => {
    await list(
      "?status=decided&queue=knowledge&type=wiki_edit&locale=fr&q=atlas&page=2&pageSize=10" +
        "&filters[submittedByUserId]=x&populate=*&foo=bar"
    )
    const url = strapiUrl()
    expect(url.origin + url.pathname).toBe(
      "http://strapi.test/api/content-moderation/moderation/submissions"
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "decided",
      queue: "knowledge",
      type: "wiki_edit",
      locale: "fr",
      q: "atlas",
      page: "2",
      pageSize: "10",
    })
  })

  it("drops allowlisted params with bad values", async () => {
    await list(
      `?status=draft&queue=everything&type=nope&locale=${encodeURIComponent('fr"]')}&page=0&pageSize=500&q=${"x".repeat(101)}`
    )
    expect([...strapiUrl().searchParams.keys()]).toEqual([])
  })

  it("sends the bridge identity from the session", async () => {
    await list("")
    const headers = strapiCall()[1].headers as Record<string, string>
    expect(headers["X-Ba-User-Id"]).toBe("mod-1")
    expect(headers["X-Service-Secret"]).toBe("s3cret")
  })

  it("400 for a malformed documentId, after the capability check", async () => {
    const res = await proxyModeration(new Request("http://localhost/x"), {
      path: "submissions/BAD!",
      ids: ["BAD!"],
    })
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("PUT forwards only the allowed body keys and passes Strapi's answer through", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          error: { status: 409, name: "apply_refused", reason: "no_hierarchy" },
        },
        { status: 409 }
      )
    )
    const res = await proxyModeration(
      new Request("http://localhost/x", {
        method: "PUT",
        body: JSON.stringify({
          status: "approved",
          note: "ok",
          publish: true,
          reviewerId: "someone-else",
        }),
      }),
      {
        path: `submissions/${DOC}/status`,
        ids: [DOC],
        method: "PUT",
        bodyKeys: ["status", "note", "publish"],
      }
    )
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { status: 409, name: "apply_refused", reason: "no_hierarchy" },
    })
    const [, init] = strapiCall()
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual({
      status: "approved",
      note: "ok",
      publish: true,
    })
  })

  it("413 for a body over 16 KB", async () => {
    const res = await proxyModeration(
      new Request("http://localhost/x", {
        method: "PUT",
        body: JSON.stringify({ note: "x".repeat(17 * 1024) }),
      }),
      {
        path: `submissions/${DOC}/status`,
        ids: [DOC],
        method: "PUT",
        bodyKeys: ["note"],
      }
    )
    expect(res.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  const decide = () =>
    proxyModeration(
      new Request("http://localhost/x", {
        method: "PUT",
        body: JSON.stringify({ status: "approved" }),
      }),
      {
        path: `submissions/${DOC}/status`,
        ids: [DOC],
        method: "PUT",
        bodyKeys: ["status"],
      }
    )

  it("reads: 120 a minute, on their own budget", async () => {
    for (let i = 0; i < 120; i++) expect((await list("")).status).toBe(200)
    expect((await list("")).status).toBe(429)
    // Decisions are counted separately.
    expect((await decide()).status).toBe(200)
  })

  it("writes: 30 a minute, on their own budget", async () => {
    for (let i = 0; i < 30; i++) expect((await decide()).status).toBe(200)
    expect((await decide()).status).toBe(429)
    // Reads are counted separately.
    expect((await list("")).status).toBe(200)
  })
})
