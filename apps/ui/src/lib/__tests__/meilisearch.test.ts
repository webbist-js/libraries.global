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

vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (url: string) => url,
}))

// Must import AFTER mock is declared so the singleton picks up the mock
const { searchLibraries } = await import("@/lib/meilisearch")
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

  it("produces no filter string when all filters are empty", async () => {
    await searchLibraries(DEFAULT_FILTERS)
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ filter: undefined })
    )
  })
})
