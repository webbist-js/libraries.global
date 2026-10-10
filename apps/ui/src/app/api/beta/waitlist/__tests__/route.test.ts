import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
import { POST as newsletter } from "../../../newsletter/route"
import { POST } from "../route"

const fetchMock = vi.fn()
let address = 0
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://beta.test/api/beta/waitlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://beta.test",
      "x-forwarded-for": `198.51.100.${++address}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "service-test")
  fetchMock.mockResolvedValue(Response.json({ ok: true }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("subscription purpose and identity", () => {
  it("stores beta consent without consulting or forwarding a user session", async () => {
    const response = await POST(
      request(
        { email: "  Reader@Example.org ", locale: "cs" },
        { cookie: "account=session", "x-ba-user-id": "forged" }
      )
    )
    expect(response.status).toBe(200)
    const init = fetchMock.mock.calls[0]![1]
    expect(JSON.parse(init.body)).toEqual({
      email: "reader@example.org",
      type: "beta_waitlist",
      source: "beta_landing",
      locale: "cs",
    })
    expect(init.headers["X-Ba-User-Id"]).toBeUndefined()
    expect(session).not.toHaveBeenCalled()
    expect(response.headers.get("set-cookie")).toBeNull()
  })
  it("rejects cross-origin, identity and purpose injection", async () => {
    expect(
      (
        await POST(
          request({ email: "a@example.org" }, { origin: "https://other.test" })
        )
      ).status
    ).toBe(403)
    expect(
      (await POST(request({ email: "a@example.org", type: "newsletter" })))
        .status
    ).toBe(400)
    expect(
      (await POST(request({ email: "a@example.org", baUserId: "forged" })))
        .status
    ).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("propagates an upstream rate limit without claiming success", async () => {
    fetchMock.mockResolvedValue(
      Response.json({}, { status: 429, headers: { "Retry-After": "90" } })
    )
    const response = await POST(request({ email: "a@example.org" }))
    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("90")
  })
  it("attributes a newsletter to a verified account only for its own email", async () => {
    session.mockResolvedValue({
      user: {
        id: "account-id",
        email: "reader@example.org",
        emailVerified: true,
      },
    })
    expect(
      (
        await newsletter(
          request(
            { email: "reader@example.org" },
            { cookie: "account=session" }
          )
        )
      ).status
    ).toBe(200)
    expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({
      "X-Ba-User-Id": "account-id",
      "X-Ba-User-Email": "reader@example.org",
    })
    expect(
      (
        await newsletter(
          request({ email: "other@example.org" }, { cookie: "account=session" })
        )
      ).status
    ).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
