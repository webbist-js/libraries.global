import { describe, expect, it } from "vitest"

import {
  aggregateArticleBrowse,
  canonicalReaderCountry,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
} from "../article-browse"

function article(
  id: string,
  extra: Partial<ArticleBrowseItem> = {}
): ArticleBrowseItem {
  return {
    documentId: id,
    locale: "es",
    title: id,
    slug: id,
    summary: null,
    author: "Writer",
    authorUsername: "writer",
    publicationOrigin: "community",
    publishedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: null,
    featured: false,
    readingTimeMinutes: 3,
    place: "Colombia",
    section: null,
    sectionSlugs: [],
    heroImage: null,
    facets: {
      languages: [{ value: "es", label: "Spanish" }],
      countries: [
        { value: "co-id", label: "Colombia", slug: "colombia", code: "CO" },
      ],
      libraries: [{ value: "library-1", label: "Library" }],
      origins: [{ value: "community", label: "Community Journal" }],
    },
    ...extra,
  }
}

describe("article discovery predicates", () => {
  it("searches bounded public text with accents and keeps filters/counts coherent", () => {
    const stories = [
      article("one", {
        title: "Bibliothèque de Bogotá",
        summary: "A reading workshop",
      }),
      article("two", { title: "Unrelated private keyword" }),
    ]
    const query = parseArticleBrowseQuery({
      q: "  bibliotheque   BOGOTA  ",
      collection: "community",
      lang: "es",
    })
    expect(query.q).toBe("bibliotheque BOGOTA")
    const result = aggregateArticleBrowse(stories, query)
    expect(result.items.map((item) => item.documentId)).toEqual(["one"])
    expect(result.total).toBe(1)
    expect(result.facets.countries[0]?.count).toBe(1)
    expect(parseArticleBrowseQuery({ q: "x".repeat(500) }).q).toHaveLength(120)
  })

  it("chooses one preferred-language variant per editorial document without filtering the multilingual collection", () => {
    const official = (locale: string) =>
      article("official", {
        locale,
        publicationOrigin: "index",
        facets: {
          languages: [{ value: locale, label: locale }],
          origins: [{ value: "index", label: "From the Index" }],
        },
      })
    const records = [
      official("cs"),
      official("en"),
      official("fr"),
      article("community"),
    ]
    const all = aggregateArticleBrowse(
      records,
      parseArticleBrowseQuery({ lang: "all" }),
      "official",
      "en"
    )
    expect(all.total).toBe(4)
    expect(all.editorPick?.locale).toBe("en")
    expect(
      all.editorialItems.map(({ documentId, locale }) => ({
        documentId,
        locale,
      }))
    ).toEqual([{ documentId: "official", locale: "en" }])
    expect(
      aggregateArticleBrowse(
        records,
        parseArticleBrowseQuery({}),
        "official",
        "fr"
      ).editorPick?.locale
    ).toBe("fr")
    const explicit = aggregateArticleBrowse(
      records,
      parseArticleBrowseQuery({ lang: "cs" }),
      "official",
      "en"
    )
    expect(explicit.editorPick?.locale).toBe("cs")
    expect(explicit.editorialItems[0]?.locale).toBe("cs")
    const fallback = aggregateArticleBrowse(
      [official("fr"), official("cs")],
      parseArticleBrowseQuery({}),
      "official",
      "en"
    )
    expect(fallback.editorPick?.locale).toBe("cs")
    expect(fallback.editorialItems[0]?.locale).toBe("cs")
  })

  it("retains a configured older editorial lead and promotes a community editor's pick without changing its origin", () => {
    const official = article("official", {
      publicationOrigin: "index",
      publishedAt: "2026-01-01",
      facets: { origins: [{ value: "index", label: "From the Index" }] },
    })
    const newest = article("new", {
      publicationOrigin: "index",
      facets: { origins: [{ value: "index", label: "From the Index" }] },
    })
    const query = parseArticleBrowseQuery({ origin: "community" })
    expect(
      aggregateArticleBrowse(
        [newest, official, article("community")],
        query,
        "official"
      ).editorialItems[0]?.documentId
    ).toBe("official")
    const promoted = aggregateArticleBrowse(
      [newest, official, article("community")],
      query,
      "community"
    )
    expect(promoted.editorPick?.publicationOrigin).toBe("community")
    expect(
      promoted.editorialItems.every(
        (item) => item.publicationOrigin === "index"
      )
    ).toBe(true)
  })
  it("combines OR within a facet and AND across facets, with matching totals", () => {
    const unrelated = article("unrelated", {
      facets: {
        languages: [{ value: "en", label: "English" }],
        countries: [{ value: "gb", label: "United Kingdom" }],
      },
    })
    const query = parseArticleBrowseQuery({
      country: "colombia,gb",
      library: "library-1",
      lang: "es",
      pageSize: "1",
    })
    const result = aggregateArticleBrowse(
      [article("one"), article("two"), unrelated],
      query
    )
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(1)
    expect(result.pageCount).toBe(2)
    expect(result.facets.countries).toEqual([
      {
        value: "co-id",
        label: "Colombia",
        slug: "colombia",
        code: "CO",
        count: 2,
      },
    ])
  })

  it("keeps every published language variant with stable pagination", () => {
    const en = article("same", {
      locale: "en",
      facets: { languages: [{ value: "en", label: "English" }] },
    })
    const es = article("same")
    const unpublished = article("draft", { publishedAt: "" })
    const query = parseArticleBrowseQuery({ lang: "all", pageSize: "1" })
    const first = aggregateArticleBrowse([es, unpublished, en], query)
    const second = aggregateArticleBrowse([en, es], { ...query, page: 2 })
    expect(first.total).toBe(2)
    expect(first.items[0]?.locale).toBe("en")
    expect(second.items[0]?.locale).toBe("es")
  })

  it("retains editorial prominence while browsing community stories", () => {
    const official = article("official", {
      publicationOrigin: "index",
      facets: {
        languages: [{ value: "es", label: "Spanish" }],
        origins: [{ value: "index", label: "From the Index" }],
      },
    })
    const result = aggregateArticleBrowse(
      [official, article("community")],
      parseArticleBrowseQuery({ origin: "community", lang: "es" })
    )
    expect(result.items.map((item) => item.documentId)).toEqual(["community"])
    expect(result.editorialItems.map((item) => item.documentId)).toEqual([
      "official",
    ])
    expect(
      result.facets.origins.map((facet) => [facet.value, facet.count])
    ).toEqual([
      ["community", 1],
      ["index", 1],
    ])
  })

  it("bounds parameters and never accepts arbitrary CMS predicates", () => {
    const query = parseArticleBrowseQuery({
      country: ["../secret", "colombia", "colombia"],
      pageSize: "999",
      page: "999999",
      sort: "authorProfile.email:asc",
      status: "draft",
      filters: { authorProfile: {} },
    })
    expect(query).toEqual({
      filters: { countries: ["colombia"] },
      pageSize: 50,
      page: 10000,
      sort: "newest",
    })
    expect(
      parseArticleBrowseQuery({
        page: "2oops",
        pageSize: "-1",
        country: "all",
        origin: "all",
      }).filters
    ).toEqual({})
  })

  it("maps recognised account country values without guessing unknown ones", () => {
    const countries = [
      {
        value: "co-id",
        label: "Colombia",
        slug: "colombia",
        code: "CO",
        count: 1,
      },
    ]
    expect(canonicalReaderCountry("  co  ", countries)).toBe("co-id")
    expect(canonicalReaderCountry("Colombia", countries)).toBe("co-id")
    expect(canonicalReaderCountry("Columbia", countries)).toBeNull()
    expect(canonicalReaderCountry("Somewhere", countries)).toBeNull()
  })
})
