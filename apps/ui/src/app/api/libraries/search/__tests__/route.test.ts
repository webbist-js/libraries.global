import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["cs", "en"] },
}))
vi.mock("@/lib/seo/metadata", () => ({ LIVE_LOCALES: ["en"] }))
vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (url: string) => url,
}))

const fetchMock = vi.fn(async () => Response.json({ hits: [] }))

const { GET } = await import("../route")

const sentFilter = () => {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

  return (JSON.parse(String(init.body)) as { filter?: string }).filter
}

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

describe("GET /api/libraries/search", () => {
  it("searches one locale", async () => {
    await GET(new Request("http://localhost/api/libraries/search?q=bl"))
    expect(sentFilter()).toBe('locale = "en"')
  })

  it("keeps the place filters and maps a non-live locale to the default", async () => {
    await GET(
      new Request(
        "http://localhost/api/libraries/search?q=bl&country_slug=fr&locale=cs"
      )
    )
    expect(sentFilter()).toBe('country_slug = "fr" AND locale = "en"')
  })
})
