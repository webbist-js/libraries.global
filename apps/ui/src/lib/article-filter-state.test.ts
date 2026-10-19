import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import {
  articlePreviewParams,
  knowledgeBrowseParams,
  changeArticleFacet,
} from "./article-filter-state"

const story = {
  documentId: "one",
  title: "Story",
  locale: "es",
  slug: "story",
  summary: null,
  author: null,
  authorUsername: null,
  publicationOrigin: "community",
  publishedAt: "2026-10-16",
  updatedAt: null,
  featured: false,
  readingTimeMinutes: 3,
  place: null,
  section: null,
  sectionSlugs: [],
  heroImage: null,
  facets: {
    languages: [{ value: "es", label: "Espagnol" }],
    continents: [{ value: "sa", label: "Amérique du Sud" }],
    countries: [{ value: "co", label: "Colombie", continentDocumentId: "sa" }],
    regions: [
      {
        value: "bogota",
        label: "Bogotá",
        countryDocumentId: "co",
        continentDocumentId: "sa",
      },
    ],
    areas: [
      {
        value: "centre",
        label: "Centre",
        regionDocumentId: "bogota",
        countryDocumentId: "co",
        continentDocumentId: "sa",
      },
    ],
  },
} satisfies ArticleBrowseItem
const facets = aggregateArticleBrowse(
  [story],
  parseArticleBrowseQuery({})
).facets
describe("canonical article geography selections", () => {
  it("selects region and area ancestors by IDs across labels/languages and actually matches content", () => {
    const next = changeArticleFacet(
      "lang=es&q=Story&page=4",
      "areas",
      ["centre"],
      facets
    )
    expect(Object.fromEntries(next)).toEqual({
      lang: "es",
      q: "Story",
      area: "centre",
      continent: "sa",
      country: "co",
      region: "bogota",
    })
    expect(
      aggregateArticleBrowse(
        [story],
        parseArticleBrowseQuery(Object.fromEntries(next))
      ).total
    ).toBe(1)
  })
  it("removing a country clears children and preserves query/language/collection", () => {
    const next = changeArticleFacet(
      "country=co&region=bogota&area=centre&collection=community&lang=es&q=Story&page=2",
      "countries",
      [],
      facets
    )
    expect(Object.fromEntries(next)).toEqual({
      country: "all",
      collection: "community",
      lang: "es",
      q: "Story",
    })
  })
})

describe("discovery request defaults", () => {
  it.each(["en", "fr", "cs"])(
    "limits Knowledge to the %s interface language by default",
    (locale) => {
      const params = new URLSearchParams(
        knowledgeBrowseParams(locale, { section: "contributing" })
      )
      const result = aggregateArticleBrowse(
        [
          story,
          {
            ...story,
            locale,
            facets: {
              ...story.facets,
              languages: [{ value: locale, label: locale }],
            },
          },
        ],
        parseArticleBrowseQuery({ lang: params.get("lang") })
      )
      expect(result.items.map((item) => item.locale)).toEqual([locale])
      expect(params.get("preferredLocale")).toBe(locale)
    }
  )
  it("preserves explicit language selections and all languages", () => {
    expect(
      new URLSearchParams(knowledgeBrowseParams("en", { lang: "fr,cs" })).get(
        "lang"
      )
    ).toBe("fr,cs")
    expect(
      new URLSearchParams(knowledgeBrowseParams("en", { lang: "all" })).get(
        "lang"
      )
    ).toBe("all")
  })
  it("uses a profile language for Knowledge and mobile previews without overriding explicit choices", () => {
    expect(
      new URLSearchParams(knowledgeBrowseParams("en", {}, "es")).get("lang")
    ).toBe("es")
    expect(
      new URLSearchParams(
        knowledgeBrowseParams("en", { lang: "all" }, "es")
      ).get("lang")
    ).toBe("all")
    for (const kind of ["journal", "knowledge"] as const) {
      expect(
        new URLSearchParams(
          articlePreviewParams("section=practice", kind, "en", "es")
        ).get("lang")
      ).toBe("es")
      expect(
        new URLSearchParams(
          articlePreviewParams("lang=fr,cs", kind, "en", "es")
        ).get("lang")
      ).toBe("fr,cs")
      expect(
        new URLSearchParams(
          articlePreviewParams("lang=all", kind, "en", "es")
        ).get("lang")
      ).toBe("all")
    }
  })
  it("uses the same defaults and explicit all-language choice in mobile previews", () => {
    expect(
      new URLSearchParams(
        articlePreviewParams("section=contributing", "knowledge", "en")
      ).get("lang")
    ).toBe("en")
    expect(
      new URLSearchParams(
        articlePreviewParams("lang=all", "knowledge", "en")
      ).get("lang")
    ).toBe("all")
    expect(
      new URLSearchParams(articlePreviewParams("", "journal", "en")).has(
        "origin"
      )
    ).toBe(false)
  })
})
