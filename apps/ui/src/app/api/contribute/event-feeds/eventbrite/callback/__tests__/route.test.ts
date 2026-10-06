import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()
const cookieStore = { nonce: undefined as string | undefined }

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "__Host-eb_oauth" && cookieStore.nonce !== undefined
        ? { value: cookieStore.nonce }
        : undefined,
  })),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")
vi.stubEnv("BETTER_AUTH_SECRET", "test-better-auth-secret")

const { GET } = await import("../route")
const { signState } = await import("@/lib/oauth-state")

const USER_ID = "user-1"
const LIBRARY_ID = "lib00000000000000000001"

const get = (search: string) =>
  GET(
    new Request(
      `http://localhost/api/contribute/event-feeds/eventbrite/callback${search}`
    )
  )

function signIn(id = USER_ID) {
  getSession.mockResolvedValue({
    user: { id, email: "u@x.org", name: "U" },
    session: { id: "s1" },
  })
}

/** Signs a state and stashes the matching nonce in the mocked cookie jar. */
function validState(overrides: Partial<Parameters<typeof signState>[0]> = {}) {
  const nonce = "nonce-1"
  cookieStore.nonce = nonce
  const state = signState({
    nonce,
    userId: USER_ID,
    libraryDocumentId: LIBRARY_ID,
    exp: Date.now() + 10 * 60_000,
    ...overrides,
  })

  return state
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieStore.nonce = undefined
  vi.stubGlobal("fetch", fetchMock)
  signIn()
})

describe("GET /api/contribute/event-feeds/eventbrite/callback", () => {
  it("redirects to oauth=failed, clears the cookie and never calls Strapi on a bad signature", async () => {
    cookieStore.nonce = "nonce-1"
    const res = await get("?code=abc123&state=not-a-valid-signature")

    expect(res.headers.get("location")).toBe(
      "http://localhost/contribute/events?oauth=failed"
    )
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toMatch(/__Host-eb_oauth=;/)
    expect(setCookie).toMatch(/Secure/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("redirects to oauth=failed on an expired state", async () => {
    const state = validState({ exp: Date.now() - 1000 })
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      "http://localhost/contribute/events?oauth=failed"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("redirects to oauth=failed when the nonce doesn't match the cookie", async () => {
    const state = validState()
    cookieStore.nonce = "a-different-nonce"
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      "http://localhost/contribute/events?oauth=failed"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("redirects to oauth=failed when the cookie is missing", async () => {
    const state = validState()
    cookieStore.nonce = undefined
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      "http://localhost/contribute/events?oauth=failed"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("redirects to oauth=failed when the signed-in user doesn't match the state", async () => {
    const state = validState()
    signIn("someone-else")
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      "http://localhost/contribute/events?oauth=failed"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts the code and library id to Strapi and redirects to oauth=sent on completion", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          credentialDocumentId: "cred1",
          organizations: [{ id: "1", name: "Org" }],
          completed: { submissionDocumentId: "sub1", result: "ok" },
        },
      })
    )
    const state = validState()
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/events/feeds/oauth/eventbrite")
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      code: "abc123",
      libraryDocumentId: LIBRARY_ID,
    })
    expect(
      (init as RequestInit & { headers: Record<string, string> }).headers[
        "X-Ba-User-Id"
      ]
    ).toBe(USER_ID)
    expect(res.headers.get("location")).toBe(
      `http://localhost/contribute/events?library=${LIBRARY_ID}&oauth=sent`
    )
  })

  it("redirects to the organisation page when several organisations are returned", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          credentialDocumentId: "cred1",
          organizations: [
            { id: "1", name: "Org 1" },
            { id: "2", name: "Org 2" },
          ],
        },
      })
    )
    const state = validState()
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      "http://localhost/contribute/events/cred1/organisation"
    )
  })

  it("passes the test-failure code through as oauth=test_failed&result=", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          credentialDocumentId: "cred1",
          organizations: [{ id: "1", name: "Org" }],
          completed: {
            error: {
              status: 422,
              name: "test_failed",
              message: "The connection test failed.",
              result: "auth_failed",
            },
          },
        },
      })
    )
    const state = validState()
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      `http://localhost/contribute/events?library=${LIBRARY_ID}&oauth=test_failed&result=auth_failed`
    )
  })

  it("redirects to oauth=refused for a non-test refusal (e.g. too many open submissions)", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          credentialDocumentId: "cred1",
          organizations: [{ id: "1", name: "Org" }],
          completed: {
            error: {
              status: 429,
              name: "too_many_open",
              message: "You have feeds waiting for review.",
            },
          },
        },
      })
    )
    const state = validState()
    const res = await get(`?code=abc123&state=${encodeURIComponent(state)}`)

    expect(res.headers.get("location")).toBe(
      `http://localhost/contribute/events?library=${LIBRARY_ID}&oauth=refused`
    )
  })
})
