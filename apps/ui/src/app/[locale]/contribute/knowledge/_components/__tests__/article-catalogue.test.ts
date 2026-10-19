import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchOwnCatalogue, uniqueArticles } from "../article-catalogue"

afterEach(() => vi.unstubAllGlobals())

describe("writing catalogue identity", () => {
  it("merges language variants by kind and document without combining different articles with the same slug", () => {
    const base = {
      documentId: "one",
      slug: "shared",
      title: "English",
      sections: [],
      publishedAt: null,
      updatedAt: null,
      locale: "en",
      kind: "knowledge" as const,
    }
    const rows = uniqueArticles(
      [
        base,
        { ...base, locale: "fr", slug: "traduit", title: "Français" },
        { ...base, kind: "journal" },
      ],
      "fr"
    )
    expect(rows).toHaveLength(2)
    const knowledge = rows.find((row) => row.kind === "knowledge")!
    expect(knowledge.title).toBe("Français")
    expect(knowledge.translations?.map((row) => row.locale)).toEqual([
      "en",
      "fr",
    ])
  })

  it("finds an owned story beyond a page containing only other people's stories", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith("/api/contribute/journal-ownership")) {
        const slug = new URL(url, "http://test").searchParams.get("slug")!

        return Response.json({
          data: { eligibility: { [slug]: slug === "mine" } },
        })
      }
      const page = Number(new URL(url, "http://test").searchParams.get("page"))

      return Response.json({
        items: [
          {
            documentId: `story-${page}`,
            slug: page === 2 ? "mine" : "another",
            title: `Story ${page}`,
            locale: "en",
            facets: {},
            sectionSlugs: [],
          },
        ],
        total: 2,
        pageCount: 2,
      })
    })
    vi.stubGlobal("fetch", fetcher)
    const result = await fetchOwnCatalogue({
      locale: "en",
      query: "",
      missing: false,
      page: 1,
      known: [],
    })
    expect(result.page).toBe(2)
    expect(result.items.map((item) => item.slug)).toEqual(["mine"])
    expect(result.items[0]?.owned).toBe(true)
    expect(
      fetcher.mock.calls.some(([url]) => url.includes("wiki-articles"))
    ).toBe(false)
  })
})
