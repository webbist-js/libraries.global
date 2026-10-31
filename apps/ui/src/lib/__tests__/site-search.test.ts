import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  inSearchScope,
  rememberSearch,
  searchScopeCount,
} from "@/lib/site-search"

const mocks = vi.hoisted(() => ({ search: vi.fn(), places: vi.fn() }))
vi.mock("next-intl/server", () => ({
  getTranslations: async () => String,
}))
vi.mock("@/lib/meilisearch", () => ({
  meiliClient: {
    index: (index: string) => ({
      search: (...args: unknown[]) => mocks.search(index, ...args),
    }),
  },
  searchLocale: (locale: string) => locale,
  searchLocaleFilter: (locale: string) => `locale = "${locale}"`,
  buildLibraryPath: (row: Record<string, string>) =>
    row.region_slug
      ? `/${row.continent_slug}/${row.country_slug}/${row.region_slug}/${row.slug}`
      : null,
}))
vi.mock("@/lib/strapi-api", () => ({
  PublicStrapiClient: { fetchAPI: mocks.places },
}))
const { searchSite } = await import("@/lib/site-search-server")
beforeEach(() => {
  mocks.search
    .mockReset()
    .mockResolvedValue({ hits: [], estimatedTotalHits: 0 })
  mocks.places.mockReset().mockResolvedValue({ data: [] })
})
describe("site search", () => {
  it("combines places with libraries and keeps the other scopes separate", () => {
    expect(inSearchScope("places", "libraries")).toBe(true)
    expect(inSearchScope("pages", "libraries")).toBe(false)
    expect(inSearchScope("journal", "knowledge")).toBe(false)
    expect(inSearchScope("events", "all")).toBe(true)
  })
  it("keeps five trimmed recent queries, deduplicated without case", () => {
    expect(
      rememberSearch(["Paris", "Egypt", "a", "b", "c"], " paris ")
    ).toEqual(["paris", "Egypt", "a", "b", "c"])
    expect(rememberSearch(["Paris"], "   ")).toEqual(["Paris"])
    expect(rememberSearch([], "a".repeat(200))[0]).toHaveLength(120)
  })
  it("projects only public fields, with canonical and fallback destinations", async () => {
    mocks.search.mockImplementation(async (index: string) => ({
      hits:
        index === "library"
          ? [
              {
                documentId: "lib1",
                name: "Alexandria",
                slug: "central",
                continent_slug: "africa",
                country_slug: "egypt",
                region_slug: "alexandria",
                email: "private@example.test",
                draftData: { secret: true },
              },
              { documentId: "mobile", name: "Book bus" },
            ]
          : index === "blog-article"
            ? [
                {
                  documentId: "article",
                  title: "Story",
                  slug: "story",
                  section_slug: "field-notes",
                  locale: "fr",
                  body: "private draft",
                },
              ]
            : [],
      estimatedTotalHits: 2,
    }))
    const result = await searchSite("Alexandria", "en")
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "libraries:lib1",
          href: "/africa/egypt/alexandria/central",
        }),
        expect.objectContaining({
          id: "libraries:mobile",
          href: "/libraries?q=Book%20bus",
        }),
        expect.objectContaining({
          id: "journal:article",
          href: "/journal/field-notes/story?contentLang=fr",
        }),
      ])
    )
    expect(JSON.stringify(result)).not.toMatch(/private|draftData|email/)
    const options = mocks.search.mock.calls[0]![2]
    expect(options).toEqual(
      expect.objectContaining({ limit: 6, filter: 'locale = "en"' })
    )
    expect(options.attributesToRetrieve).not.toContain("*")
    expect(options.attributesToRetrieve).not.toContain("body")
  })
  it("finds published places with no libraries, including an area without a region", async () => {
    mocks.places.mockImplementation(async (path: string) => ({
      data:
        path === "/countries"
          ? [
              {
                documentId: "c",
                name: "Egypt",
                slug: "egypt",
                continent: { slug: "africa" },
              },
            ]
          : path === "/areas"
            ? [
                {
                  documentId: "a",
                  name: "District",
                  slug: "district",
                  country: { slug: "egypt" },
                },
              ]
            : [],
    }))
    const result = await searchSite("Egypt", "en")
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Egypt",
          href: "/africa/egypt",
          group: "places",
        }),
        expect.objectContaining({
          title: "District",
          href: "/libraries?area=district",
        }),
      ])
    )
    expect(
      mocks.places.mock.calls.every((call) => call[1].status === "published")
    ).toBe(true)
    expect(result.counts.places).toBe(2)
  })
  it("keeps healthy groups when an index or CMS fails, and distinguishes a missing event index", async () => {
    mocks.search.mockImplementation(async (index: string) => {
      if (index === "event") throw { code: "index_not_found" }
      if (index === "blog-article") throw new Error("upstream unavailable")

      return {
        hits: [{ documentId: "guide", title: "Guide", slug: "guide" }],
        estimatedTotalHits: 1,
      }
    })
    mocks.places.mockRejectedValue(new Error("CMS unavailable"))
    const result = await searchSite("guide", "en")
    expect(result.unavailable).toEqual(["places", "journal"])
    expect(result.counts.events).toBe(0)
    expect(result.items.some((item) => item.group === "knowledge")).toBe(true)
    mocks.search.mockRejectedValue(new Error("connection refused"))
    expect((await searchSite("guide", "en")).unavailable).toContain("events")
  })
  it("does not query upstream on a single character, and limits idle results", async () => {
    await searchSite("a", "en")
    expect(mocks.search).not.toHaveBeenCalled()
    expect(mocks.places).not.toHaveBeenCalled()
    const result = await searchSite("", "en")
    expect(result.items.filter((row) => row.group === "pages")).toHaveLength(6)
    expect(result.counts.pages).toBeGreaterThan(6)
    expect(mocks.places).not.toHaveBeenCalled()
  })
})

it("does not present an unavailable scope as zero results", () => {
  const response = {
    items: [],
    counts: { libraries: 3 },
    estimated: [],
    unavailable: ["events" as const],
  }
  expect(searchScopeCount(response, "events", "en")).toBe("—")
  expect(searchScopeCount(response, "all", "en")).toBe("3+")
  expect(searchScopeCount(response, "libraries", "en")).toBe("3")
})
