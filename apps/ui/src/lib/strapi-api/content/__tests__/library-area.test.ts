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
vi.mock("@/lib/live-locales", () => ({ LIVE_LOCALES: ["en"] }))
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
    for (const [, opts] of search.mock.calls) {
      expect(opts.filter).toContain('region_slug = "london"')
      expect(opts.filter).toMatch(/ AND locale = "en"$/)
      expect(opts.filter).toContain(
        'operationalStatus NOT IN ["permanently_closed","planned"]'
      )
    }
  })

  it("does not present missing count facets as an empty region", async () => {
    const result = await fetchLibraryArea({
      slug: "x",
      regionSlug: "london",
      location: null,
      openingTimes: null,
    })
    expect(result.regionTotal).toBeNull()
  })
})
