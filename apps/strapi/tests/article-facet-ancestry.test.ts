import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
} from "@repo/shared-data"
import { it, expect, vi } from "vitest"

import { publicArticleBrowseItem } from "../src/utils/article-browse"
import { enrichArticleFacetAncestry } from "../src/utils/article-facet-ancestry"

it("hydrates canonical ancestry across languages and respects historical frozen parents", async () => {
  const article = (country: string, locale: string) =>
    publicArticleBrowseItem(
      {
        documentId: locale,
        slug: locale,
        title: "Story",
        locale,
        publishedAt: "2026-10-16",
        geographyFacet: {
          continents: [{ documentId: "sa", name: "South America" }],
          countries: [
            {
              documentId: country,
              name: locale === "fr" ? "Colombie" : "Colombia",
            },
          ],
          regions: [{ documentId: "bogota", name: "Bogotá" }],
          areas: [{ documentId: "centre", name: "Centre" }],
        },
      },
      "blog"
    )!
  const items = [
    article("co", "fr"),
    article("co", "es"),
    article("old-country", "en"),
  ]
  const documents = vi.fn((uid: string) => ({
    findMany: vi.fn(async (query: any) => {
      expect(query.status).toBe("published")
      expect(query.locale).toBe("*")
      expect(query.limit).toBe(500)
      if (uid.includes("country.country"))
        return [{ documentId: "co", continent: { documentId: "sa" } }]
      if (uid.includes("region.region"))
        return [
          {
            documentId: "bogota",
            country: { documentId: "co", continent: { documentId: "sa" } },
          },
        ]
      expect(query.populate).not.toHaveProperty("continent")

      return [
        {
          documentId: "centre",
          region: {
            documentId: "bogota",
            country: { documentId: "co", continent: { documentId: "sa" } },
          },
        },
      ]
    }),
  }))
  await enrichArticleFacetAncestry({ documents }, items)
  expect(documents).toHaveBeenCalledTimes(3)
  expect(items[0]?.facets.areas?.[0]).toMatchObject({
    countryDocumentId: "co",
    regionDocumentId: "bogota",
    continentDocumentId: "sa",
  })
  expect(items[2]?.facets.areas?.[0]).not.toHaveProperty("countryDocumentId")
  expect(
    aggregateArticleBrowse(
      items,
      parseArticleBrowseQuery({
        country: "co",
        region: "bogota",
        area: "centre",
      })
    ).items.map((item) => item.locale)
  ).toEqual(["es", "fr"])
})
