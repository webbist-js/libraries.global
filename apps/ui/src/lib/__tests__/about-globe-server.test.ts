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
  fetchAPI.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({
    data: {
      name: "Germany",
      libraryCount: 3,
      statistics: { libraries: true, types: true },
      libraryTypeCounts: [{ type: "Public", count: 3 }],
      featuredLibraries: [],
    },
  })
  const record = await fetchAboutGlobeRecord("germany", "fr")
  expect(record?.libraryCount).toBe(3)
  expect(fetchAPI.mock.calls.map((call) => call[1])).toEqual([
    { locale: "fr", status: "published" },
    { locale: "en", status: "published" },
  ])
})

it("does not present failed aggregates as zero libraries or invented coverage", async () => {
  fetchAPI.mockResolvedValue({
    data: {
      libraryCount: 0,
      statistics: { libraries: false, types: false },
      libraryTypeCounts: [],
      featuredLibraries: [],
    },
  })
  expect(await fetchAboutGlobeRecord("germany", "en")).toMatchObject({
    libraryCount: null,
    libraryTypeCounts: null,
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
