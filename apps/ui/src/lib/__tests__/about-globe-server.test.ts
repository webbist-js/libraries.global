import { beforeEach, expect, it, vi } from "vitest"

import {
  fetchAboutGlobeCountries,
  fetchAboutGlobeRecord,
} from "@/lib/about-server"

const fetchAPI = vi.hoisted(() => vi.fn())
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/navigation", () => ({ routing: { defaultLocale: "en" } }))
vi.mock("@/lib/library-helpers", () => ({
  buildLibraryPath: () => "/europe/germany/berlin/library",
}))
vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrlForClient: (value: string) => value,
}))
beforeEach(() => vi.clearAllMocks())

it("reads only published country data and falls back when a translation is missing", async () => {
  fetchAPI
    .mockResolvedValueOnce({ data: null })
    .mockResolvedValueOnce({
      data: {
        name: "Germany",
        libraryCount: 3,
        statistics: { libraries: true, types: true },
        libraryTypeCounts: [{ type: "Public", count: 3 }],
        featuredLibraries: [],
      },
    })
    .mockResolvedValueOnce({ data: [] })
  const record = await fetchAboutGlobeRecord("germany", "fr")
  expect(record?.libraryCount).toBe(3)
  expect(fetchAPI.mock.calls.slice(0, 2).map((call) => call[1])).toEqual([
    { locale: "fr", status: "published" },
    { locale: "en", status: "published" },
  ])
  expect(fetchAPI.mock.calls[2]).toEqual([
    "/libraries",
    expect.objectContaining({
      locale: "en",
      status: "published",
      filters: {
        country: { slug: { $eq: "germany" } },
        featured: { $eq: true },
      },
    }),
  ])
})

it("does not present failed aggregates as zero libraries or invented coverage", async () => {
  fetchAPI.mockResolvedValue({
    data: {
      libraryCount: 0,
      statistics: { libraries: false, types: false, children: false },
      libraryTypeCounts: [],
      featuredLibraries: [],
    },
  })
  expect(await fetchAboutGlobeRecord("germany", "en")).toMatchObject({
    libraryCount: null,
    libraryTypeCounts: null,
    regionCoverage: null,
  })
})

it("reads every CMS page and maps ISO-2-only records to existing Atlas geometry", async () => {
  const row = (slug: string, iso2: string, iso3: string | null) => ({
    slug,
    name: slug,
    iso2,
    iso3,
    continent: { slug: "test" },
  })
  fetchAPI
    .mockResolvedValueOnce({
      data: [row("france", "FR", "FRA")],
      meta: { pagination: { pageCount: 2 } },
    })
    .mockResolvedValueOnce({ data: [row("australia", "AU", null)] })
  const records = await fetchAboutGlobeCountries("en", [])
  expect(records.map((entry) => entry.iso3)).toEqual(["FRA", "AUS"])
  expect(fetchAPI.mock.calls.map((call) => call[1].pagination.page)).toEqual([
    1, 2,
  ])
})

it("maps CMS coverage and sourced population without treating empty regions as recorded", async () => {
  fetchAPI.mockResolvedValue({
    data: {
      name: "France",
      libraryCount: 96,
      featuredLibraries: [],
      regionCount: 3,
      updatedAt: "2026-10-04T12:00:00Z",
      languages: "French",
      systemDescription: "National network",
      visitsPerYear: " 2 million ",
      employees: "",
      populationCount: "68000000",
      populationYear: 2024,
      populationSource: "World Bank",
      regionTypeLabel: "County",
      regions: [
        { name: "Paris", slug: "paris", libraryCount: 60 },
        { name: "Other", slug: "other", libraryCount: 36 },
        { name: "Gap", slug: "gap", libraryCount: 0 },
      ],
    },
  })
  const record = await fetchAboutGlobeRecord("france", "en")
  expect(record).toMatchObject({
    updatedAt: "2026-10-04T12:00:00Z",
    languages: "French",
    systemDescription: "National network",
    population: { count: 68000000, year: 2024, source: "World Bank" },
    facts: [{ label: "Annual library visits", value: "2 million" }],
    regionCoverage: {
      total: 3,
      recorded: 2,
      label: "Counties",
      leading: { name: "Paris", count: 60, slug: "paris" },
    },
  })
})
it("reads featured published libraries in the requested record locale with link relations", async () => {
  fetchAPI
    .mockResolvedValueOnce({
      data: { name: "France", libraryCount: 96, featuredLibraries: [] },
    })
    .mockResolvedValueOnce({
      data: [
        {
          name: "Bibliothèque nationale de France",
          city: "Paris",
          libraryType: "National",
        },
      ],
    })
  const record = await fetchAboutGlobeRecord("france", "fr")
  expect(record?.featuredLibraries[0]).toMatchObject({
    name: "Bibliothèque nationale de France",
    place: "Paris",
    type: "National",
    href: "/europe/germany/berlin/library",
  })
  expect(fetchAPI).toHaveBeenLastCalledWith(
    "/libraries",
    expect.objectContaining({
      locale: "fr",
      status: "published",
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["name", "slug"] },
      },
    })
  )
})
it("prefers curated libraries and keeps country facts when featured lookup fails", async () => {
  fetchAPI.mockResolvedValueOnce({
    data: {
      libraryCount: 2,
      featuredLibraries: [{ name: "Curated", city: "Paris" }],
    },
  })
  expect(
    (await fetchAboutGlobeRecord("france", "en"))?.featuredLibraries[0]?.name
  ).toBe("Curated")
  expect(fetchAPI).toHaveBeenCalledTimes(1)
  fetchAPI
    .mockResolvedValueOnce({
      data: {
        libraryCount: 2,
        featuredLibraries: [],
        populationCount: "unknown",
        regionCount: 1,
      },
    })
    .mockRejectedValueOnce(new Error("Offline"))
  expect(await fetchAboutGlobeRecord("france", "en")).toMatchObject({
    libraryCount: 2,
    population: null,
    featuredLibraries: [],
  })
})
