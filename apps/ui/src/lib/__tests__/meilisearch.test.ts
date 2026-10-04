// apps/ui/src/lib/__tests__/meilisearch.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

// vi.hoisted runs before mock factories so mockSearch is available inside vi.mock
const { mockSearch } = vi.hoisted(() => ({
  mockSearch: vi.fn().mockResolvedValue({
    hits: [],
    totalHits: 0,
    estimatedTotalHits: 0,
    facetDistribution: {},
  }),
}))

vi.mock("meilisearch", () => ({
  Meilisearch: class {
    index() {
      return { search: mockSearch }
    }
  },
}))

// next-intl's navigation can't load under vitest; mirror the real values.
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["cs", "en"] },
}))
// `fr` stands in for a second live locale; `cs` is routed but not live.
vi.mock("@/lib/live-locales", () => ({ LIVE_LOCALES: ["en", "fr"] }))

vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (url: string) => url,
}))

// Must import AFTER mock is declared so the singleton picks up the mock
const {
  fetchGlobeMarkers,
  searchBlogArticles,
  searchLibraries,
  searchLibrariesByParams,
  searchLibrariesV2,
  searchLibraryNames,
  searchLocale,
  searchLocaleFilter,
  searchWikiArticles,
  withSearchLocale,
} = await import("@/lib/meilisearch")
const { DEFAULT_FILTERS } = await import("@/components/library-index/types")

beforeEach(() => {
  mockSearch.mockClear()
})

describe("searchLibraries", () => {
  it("translates 0-indexed page to MeiliSearch 1-indexed page", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, page: 0 })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ page: 1 })
    )
  })

  it("translates page 2 to MeiliSearch page 3", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, page: 2 })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ page: 3 })
    )
  })

  it("builds libraryType filter from libraryTypes array", async () => {
    await searchLibraries({
      ...DEFAULT_FILTERS,
      libraryTypes: ["National", "Public"],
    })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining(
          'libraryType IN ["National", "Public"]'
        ),
      })
    )
  })

  it("builds operationalStatus filter from statuses array", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, statuses: ["open"] })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining('operationalStatus IN ["open"]'),
      })
    )
  })

  it("wraps single continentSlug in geo filter", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, continentSlug: "europe" })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining('continent_slug IN ["europe"]'),
      })
    )
  })

  it("adds _geoRadius filter when nearLat and nearLng are set", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, nearLat: 51.5, nearLng: -0.1 })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining("_geoRadius(51.5, -0.1,"),
      })
    )
  })

  it("filters to the default locale when all filters are empty", async () => {
    await searchLibraries(DEFAULT_FILTERS)
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ filter: 'locale = "en"' })
    )
  })
})

describe("locale filter", () => {
  it("uses a live route locale", () => {
    expect(searchLocale("en")).toBe("en")
  })

  it("uses the default locale for a route locale that isn't live", () => {
    // `cs` is routed but has no live content (LIVE_LOCALES).
    expect(searchLocale("cs")).toBe("en")
    expect(searchLocale(undefined)).toBe("en")
  })

  it("adds the locale to every library search", async () => {
    await searchLibraries(
      { ...DEFAULT_FILTERS, libraryTypes: ["National"] },
      { locale: "cs" }
    )
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: 'libraryType IN ["National"] AND locale = "en"',
      })
    )
  })

  it("adds the locale to the v2, Knowledge and Journal searches", async () => {
    await searchLibrariesV2({ query: "x" })
    await searchWikiArticles("x", "guides")
    await searchBlogArticles("x")
    const filters = mockSearch.mock.calls.map((c) => c[1]?.filter)
    expect(filters).toEqual([
      'locale = "en"',
      'section_slug = "guides" AND locale = "en"',
      'locale = "en"',
    ])
  })
})

describe("shared locale clause", () => {
  it("builds the locale clause per the LIVE_LOCALES rule", () => {
    expect(searchLocaleFilter("en")).toBe('locale = "en"')
    expect(searchLocaleFilter("cs")).toBe('locale = "en"')
    expect(searchLocaleFilter()).toBe('locale = "en"')
  })

  it("appends it to a caller's own clauses", () => {
    expect(withSearchLocale(['country_slug = "fr"', null, undefined])).toBe(
      'country_slug = "fr" AND locale = "en"'
    )
    expect(withSearchLocale([])).toBe('locale = "en"')
  })

  it("library pickers search one locale", async () => {
    await searchLibraryNames("brit", {
      hitsPerPage: 8,
      attributesToRetrieve: ["documentId", "name"],
      filters: ['country_slug = "gb"'],
      locale: "cs",
    })
    expect(mockSearch).toHaveBeenLastCalledWith("brit", {
      filter: 'country_slug = "gb" AND locale = "en"',
      hitsPerPage: 8,
      attributesToRetrieve: ["documentId", "name"],
    })
  })
})

describe("route locale", () => {
  it("uses a live non-default route locale", async () => {
    expect(searchLocaleFilter("fr")).toBe('locale = "fr"')
    await searchLibrariesByParams({ query: "x", locale: "fr" })
    expect(mockSearch).toHaveBeenLastCalledWith(
      "x",
      expect.objectContaining({ filter: 'locale = "fr"' })
    )
  })
})

describe("fetchGlobeMarkers", () => {
  it("plots one marker per grid cell plus each featured library", async () => {
    mockSearch
      .mockResolvedValueOnce({
        hits: [],
        facetDistribution: { geo_cell: { "41,-74": 400, "56,-4": 81 } },
      })
      .mockResolvedValueOnce({ hits: [{ _geo: { lat: 51.53, lng: -0.127 } }] })

    expect(await fetchGlobeMarkers("en")).toEqual([
      { lat: 41, lng: -74, featured: false },
      { lat: 56, lng: -4, featured: false },
      { lat: 51.53, lng: -0.127, featured: true },
    ])
    const [cells, featured] = mockSearch.mock.calls.slice(-2)
    expect(cells?.[1]).toMatchObject({
      limit: 0,
      facets: ["geo_cell"],
      filter: 'locale = "en"',
    })
    expect(featured?.[1]).toMatchObject({
      filter: 'featured = true AND locale = "en"',
    })
  })
})
