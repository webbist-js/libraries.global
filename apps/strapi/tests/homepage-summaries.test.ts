import { describe, expect, it, vi } from "vitest"

vi.mock("../src/utils/library-location-counts", () => ({
  countLibrariesByLocationPath: vi.fn(async () => ({
    europe: 107,
    "europe/scotland": 81,
    "europe/england": 26,
    "north-america": 1083,
    "north-america/united-states": 1083,
  })),
}))

const { default: serviceFactory } =
  await import("../src/api/continent/services/continent")

const CONTINENTS = [
  { documentId: "af", name: "Africa", slug: "africa", code: "af" },
  {
    documentId: "na",
    name: "North America",
    slug: "north-america",
    code: "na",
  },
  { documentId: "eu", name: "Europe", slug: "europe", code: "eu" },
]
const COUNTRIES = [
  { name: "Scotland", slug: "scotland", continent: { slug: "europe" } },
  { name: "England", slug: "england", continent: { slug: "europe" } },
  { name: "France", slug: "france", continent: { slug: "europe" } },
  {
    name: "United States",
    slug: "united-states",
    continent: { slug: "north-america" },
  },
]

function fakeStrapi() {
  const findMany = vi.fn(async (params: { fields: string[] }) =>
    params.fields.includes("code") ? CONTINENTS : COUNTRIES
  )

  return {
    documents: () => ({ findMany }),
    contentType: (uid: string) => ({ uid, kind: "collectionType" }),
  }
}

describe("getHomepageSummaries", () => {
  it("counts every library per continent and country from one grouped query", async () => {
    const service = (
      serviceFactory as unknown as (a: { strapi: unknown }) => {
        getHomepageSummaries: (p: {
          status: "published"
        }) => Promise<Record<string, unknown>[]>
      }
    )({ strapi: fakeStrapi() })

    const summaries = await service.getHomepageSummaries({
      status: "published",
    })

    // Homepage order: Europe, then Africa, then North America.
    expect(summaries.map((s) => s.slug)).toEqual([
      "europe",
      "africa",
      "north-america",
    ])
    expect(summaries[0]).toMatchObject({
      libraryCount: 107,
      countryTotal: 3,
      countries: [
        { name: "Scotland", slug: "scotland", libraryCount: 81 },
        { name: "England", slug: "england", libraryCount: 26 },
      ],
    })
    expect(summaries[1]).toMatchObject({
      libraryCount: 0,
      countryTotal: 0,
      countries: [],
    })
    expect(summaries[2]).toMatchObject({
      libraryCount: 1083,
      countryTotal: 1,
      countries: [
        { name: "United States", slug: "united-states", libraryCount: 1083 },
      ],
    })
  })
})
