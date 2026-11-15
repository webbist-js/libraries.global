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
  it("does not collect addresses or send mail through the retired waitlist", async () => {
    expect((await POST()).status).toBe(410)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(session).not.toHaveBeenCalled()
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
