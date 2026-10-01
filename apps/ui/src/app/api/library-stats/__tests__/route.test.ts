import { beforeEach, describe, expect, it, vi } from "vitest"

const { search, getStats } = vi.hoisted(() => ({
  search: vi.fn(),
  getStats: vi.fn(),
}))

vi.mock("meilisearch", () => ({
  Meilisearch: class {
    index() {
      return { search, getStats }
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

const { GET } = await import("../route")

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ meta: { pagination: { total: 3 } } }))
  )
  // Every locale's version is a document: the raw index count is too high.
  getStats.mockResolvedValue({ numberOfDocuments: 20 })
  search.mockResolvedValue({
    totalHits: 10,
    estimatedTotalHits: 10,
    facetDistribution: { operationalStatus: { open: 5 } },
  })
})

describe("GET /api/library-stats", () => {
  it("counts the default locale's libraries, not every locale's", async () => {
    const json = await (await GET()).json()
    expect(search).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ filter: 'locale = "en"' })
    )
    expect(json.totalLibraries).toBe(10)
    expect(json.percentOpen).toBe(50)
  })
})
