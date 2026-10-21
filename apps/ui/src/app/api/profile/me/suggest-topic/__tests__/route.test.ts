import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

vi.stubEnv("APP_PUBLIC_URL", "http://localhost")
vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")

const { POST } = await import("../route")

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/profile/me/suggest-topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(body),
    })
  )

let userSeq = 0
const signIn = () => {
  userSeq += 1
  const user = {
    id: `user-${userSeq}`,
    email: `u${userSeq}@example.org`,
    name: "Reader",
  }
  getSession.mockResolvedValue({ user, session: { id: "s1" } })

  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/api/topics/approved"))
      return Response.json({ data: [{ name: "Maps" }] })

    return Response.json({ data: { documentId: "sub1" } })
  })
})

afterEach(() => vi.unstubAllGlobals())

describe("POST /api/profile/me/suggest-topic", () => {
  it("sends the user's identity headers so Strapi can resolve the submitter", async () => {
    const user = signIn()

    const res = await post({ name: "Manuscripts" })

    expect(res.status).toBe(200)
    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/content-moderation/submissions")
    )!
    expect(call).toBeDefined()
    const init = call[1] as RequestInit
    expect(init.headers).toMatchObject({
      "X-Service-Secret": "s3cret",
      "X-Ba-User-Id": user.id,
      "X-Ba-User-Email": user.email,
      "X-Ba-User-Name": "Reader",
    })
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({
      submissionType: "topic_suggestion",
      fields: { name: "Manuscripts" },
    })
    expect(body).not.toHaveProperty("baUserId")
  })

  it("returns 409 for a topic that already exists", async () => {
    signIn()

    expect((await post({ name: "maps" })).status).toBe(409)
  })

  it("returns 401 when signed out", async () => {
    getSession.mockResolvedValue(null)

    expect((await post({ name: "Manuscripts" })).status).toBe(401)
  })

  it("returns 429 on the 31st call in a minute from one user", async () => {
    signIn()
    for (let i = 0; i < 30; i++)
      expect((await post({ name: `Topic ${i}` })).status).toBe(200)

    expect((await post({ name: "Topic 31" })).status).toBe(429)
  })
})

describe("write boundary", () => {
  it.each([null, [], 42, { name: 42 }, { unexpected: true }])(
    "rejects malformed payload %j without an upstream write",
    async (body) => {
      getSession.mockResolvedValue({
        user: { id: "validation-user", email: "reader@example.org" },
      })
      fetchMock.mockClear()
      expect((await post(body)).status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )
  it("refuses cross-site writes", async () => {
    const response = await POST(
      new Request("http://localhost/api/profile/me/suggest-topic", {
        method: "POST",
        headers: {
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    )
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("caps request size", async () => {
    getSession.mockResolvedValue({
      user: { id: "size-user", email: "reader@example.org" },
    })
    expect((await post({ padding: "x".repeat(17000) })).status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
