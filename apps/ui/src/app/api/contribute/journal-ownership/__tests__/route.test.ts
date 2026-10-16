import { afterEach, beforeEach, it, expect, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))
vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
vi.stubEnv("STRAPI_URL", "https://cms.test")
const { GET } = await import("../route")
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({
    user: {
      id: "actual-author",
      email: "author@example.test",
      name: "Private name",
    },
  })
  vi.stubGlobal("fetch", mocks.fetch)
})
afterEach(() => vi.unstubAllGlobals())
it("uses authenticated ownership and exposes only booleans even for hidden public attribution", async () => {
  mocks.fetch.mockImplementation(async (url: string) =>
    Response.json({
      data: {
        isOwner: url.includes("/mine/"),
        email: "private@example.test",
        authorProfile: { baUserId: "internal" },
      },
    })
  )
  const response = await GET(
    new Request(
      "https://app.test/api/contribute/journal-ownership?slug=mine&slug=another&baUserId=forged"
    )
  )
  expect(await response.json()).toEqual({
    data: { eligibility: { mine: true, another: false } },
  })
  expect(response.headers.get("Cache-Control")).toContain("no-store")
  for (const [, init] of mocks.fetch.mock.calls)
    expect(init).toMatchObject({
      cache: "no-store",
      headers: { "X-Ba-User-Id": "actual-author" },
    })
})
it("requires a session, bounds selections, and reports failure instead of inventing nonownership", async () => {
  mocks.session.mockResolvedValue(null)
  expect(
    (
      await GET(
        new Request(
          "https://app.test/api/contribute/journal-ownership?slug=mine"
        )
      )
    ).status
  ).toBe(401)
  expect(mocks.fetch).not.toHaveBeenCalled()
  mocks.session.mockResolvedValue({
    user: { id: "author", email: "author@example.test" },
  })
  for (const query of [
    "",
    "slug=../private",
    new URLSearchParams(
      Array.from({ length: 25 }, (_, i) => ["slug", `story-${i}`])
    ).toString(),
  ])
    expect(
      (
        await GET(
          new Request(
            `https://app.test/api/contribute/journal-ownership?${query}`
          )
        )
      ).status
    ).toBe(400)
  mocks.fetch.mockResolvedValue(
    Response.json({ error: "unavailable" }, { status: 503 })
  )
  expect(
    (
      await GET(
        new Request(
          "https://app.test/api/contribute/journal-ownership?slug=mine"
        )
      )
    ).status
  ).toBe(503)
})
