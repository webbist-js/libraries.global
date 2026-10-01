import { beforeEach, describe, expect, it, vi } from "vitest"

const { search } = vi.hoisted(() => ({
  search: vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
}))

vi.mock("meilisearch", () => ({
  Meilisearch: class {
    index() {
      return { search }
    }
  },
}))
vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (url: string) => url,
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["cs", "en"] },
}))
vi.mock("@/lib/seo/metadata", () => ({ LIVE_LOCALES: ["en"] }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))

const { fetchLibraryArea } = await import("../library-area")

beforeEach(() => search.mockClear())

describe("fetchLibraryArea", () => {
  it("counts and lists one locale's libraries only", async () => {
    await fetchLibraryArea({
      slug: "x",
      regionSlug: "london",
      location: { lat: 51.5, lng: -0.1 },
      openingTimes: null,
      locale: "en",
    })
    expect(search).toHaveBeenCalledTimes(3)
    for (const [, opts] of search.mock.calls)
      expect(opts.filter).toMatch(/ AND locale = "en"$/)
  })

  it("uses the default locale without one", async () => {
    await fetchLibraryArea({
      slug: "x",
      regionSlug: "london",
      location: null,
      openingTimes: null,
    })
    for (const [, opts] of search.mock.calls)
      expect(opts.filter).toBe('region_slug = "london" AND locale = "en"')
  })
})
