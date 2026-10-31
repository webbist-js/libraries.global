import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  beta: vi.fn(),
  limit: vi.fn(),
}))
vi.mock("@/lib/site-search-server", () => ({ searchSite: mocks.search }))
vi.mock("@/lib/beta/access", () => ({
  BETA_COOKIE: "beta",
  betaEnabled: () => true,
}))
vi.mock("@/lib/beta/invitations", () => ({ hasBetaAccess: mocks.beta }))
vi.mock("@/lib/routing", () => ({
  routing: { locales: ["en", "fr", "cs"], defaultLocale: "en" },
}))
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "test",
  createRateLimiter: () => ({ check: mocks.limit }),
  rateLimitResponse: () =>
    Response.json({ error: "Rate limited" }, { status: 429 }),
}))
const { GET } = await import("../route")
const request = (query: string) =>
  GET(
    new Request(`https://example.test/api/site-search?${query}`, {
      headers: { cookie: "beta=allowed" },
    })
  )
beforeEach(() => {
  vi.clearAllMocks()
  mocks.beta.mockResolvedValue(true)
  mocks.limit.mockResolvedValue({ ok: true })
  mocks.search.mockResolvedValue({
    items: [],
    counts: {},
    estimated: [],
    unavailable: [],
  })
})
it("keeps search behind beta access", async () => {
  mocks.beta.mockResolvedValue(false)
  expect((await request("q=Paris")).status).toBe(401)
  expect(mocks.search).not.toHaveBeenCalled()
})
it("validates query and interface locale before contacting search", async () => {
  expect((await request(`q=${"x".repeat(121)}`)).status).toBe(400)
  expect((await request("q=Paris&locale=unknown")).status).toBe(400)
  expect(mocks.search).not.toHaveBeenCalled()
})
it("serves public results without caching and enforces the limiter", async () => {
  const response = await request("q=%20Paris%20&locale=fr")
  expect(mocks.search).toHaveBeenCalledWith("Paris", "fr")
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  mocks.limit.mockResolvedValue({ ok: false })
  expect((await request("q=Paris")).status).toBe(429)
})
it("does not disclose upstream error details", async () => {
  mocks.search.mockRejectedValue(new Error("private service credential"))
  const response = await request("q=Paris")
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("credential")
})
