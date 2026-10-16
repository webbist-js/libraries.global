import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { changeArticleFacet } from "./article-filter-state"

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
