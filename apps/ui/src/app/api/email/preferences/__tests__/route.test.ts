import { afterEach, beforeEach, expect, it, vi } from "vitest"

vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "fixture",
  createRateLimiter: () => ({ check: async () => ({ ok: true }) }),
  rateLimitResponse: vi.fn(),
}))
import { GET, POST } from "../route"

const token = (purpose: string) =>
  Buffer.from(JSON.stringify({ purpose })).toString("base64url") +
  ".fixture-signature"
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(
    Response.json({ action: "unsubscribe", purpose: "newsletter" })
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it("inspects a link without applying it, so email scanners cannot opt in", async () => {
  await GET(
    new Request(
      `https://libraries.global/api/email/preferences?token=${token("newsletter_confirm")}`
    )
  )
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
    apply: false,
  })
})
it("allows a token-authorized RFC 8058 unsubscribe POST without a session", async () => {
  const res = await POST(
    new Request(
      `https://libraries.global/api/email/preferences?token=${token("newsletter_unsubscribe")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }
    )
  )
  expect(res.status).toBe(200)
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
    apply: true,
  })
})
it("never lets an unsubscribe POST activate a subscription", async () => {
  const res = await POST(
    new Request(
      `https://libraries.global/api/email/preferences?token=${token("newsletter_confirm")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }
    )
  )
  expect(res.status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})
it("rejects a cross-origin interactive confirmation", async () => {
  const res = await POST(
    new Request("https://libraries.global/api/email/preferences", {
      method: "POST",
      headers: {
        Origin: "https://other.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: token("newsletter_confirm") }),
    })
  )
  expect(res.status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
})
