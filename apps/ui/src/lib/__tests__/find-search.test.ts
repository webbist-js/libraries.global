import { beforeEach, describe, expect, it, vi } from "vitest"

const { multiSearch, search } = vi.hoisted(() => ({
  multiSearch: vi.fn(),
  search: vi.fn(),
}))

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { multiSearch, index: () => ({ search }) },
  searchLocale: (l?: string) => (l === "fr" ? "en" : (l ?? "en")),
  searchLocaleFilter: (l?: string) =>
    `locale = "${l === "fr" ? "en" : (l ?? "en")}"`,
}))

const {
  FIND_MAX_REACHABLE,
  findFilter,
  findSort,
  localDayMinute,
  openNowFilter,
  searchFind,
} = await import("../find-search")

// Sunday 4 October 2026, 00:30 UTC: 01:30 Sunday in London, 20:30 Saturday
// in New York.
const NOW = new Date("2026-10-04T00:30:00Z")

beforeEach(() => {
  multiSearch.mockReset()
  search.mockReset()
})

describe("localDayMinute", () => {
  it("reads the weekday and minute in the zone", () => {
    expect(localDayMinute("Europe/London", NOW)).toEqual({
      day: "sun",
      minute: 90,
    })
    expect(localDayMinute("America/New_York", NOW)).toEqual({
      day: "sat",
      minute: 1230,
    })
    expect(localDayMinute("Not/AZone", NOW)).toBeNull()
  })
})

describe("openNowFilter", () => {
  it("checks each zone's own weekday and minute", () => {
    const filter = openNowFilter(["Europe/London", "America/New_York"], NOW)
    expect(filter).toContain(
      '(open_tz IN ["Europe/London"] AND ((open_sun_0_from <= 90 AND open_sun_0_to > 90)'
    )
    expect(filter).toContain(
      '(open_tz IN ["America/New_York"] AND ((open_sat_0_from <= 1230 AND open_sat_0_to > 1230)'
    )
    expect(filter).toContain(
      "(open_sat_5_from <= 1230 AND open_sat_5_to > 1230)"
    )
  })

  it("groups zones that share a local time", () => {
    expect(openNowFilter(["Europe/London", "Europe/Dublin"], NOW)).toContain(
      'open_tz IN ["Europe/London", "Europe/Dublin"]'
    )
  })

  it("matches nothing without zones", () => {
    expect(openNowFilter([], NOW)).toBe('open_tz = "__none__"')
  })
})

describe("findFilter", () => {
  it("joins every clause with the locale", () => {
    expect(
      findFilter(
        {
          place: { level: "region", slug: "new-york" },
          libraryTypes: ["Public"],
          digital: true,
          needs: ["photo", "hours"],
          locale: "en",
        },
        []
      )
    ).toBe(
      'region_slug = "new-york" AND libraryType IN ["Public"] AND has_iiif = true AND needs IN ["photo", "hours"] AND locale = "en"'
    )
  })

  it("requires every ticked accessibility and service option", () => {
    expect(
      findFilter(
        {
          accessibilityNames: ["Accessible parking", "Assistance dogs welcome"],
          serviceNames: ["Wi-Fi"],
          locale: "en",
        },
        []
      )
    ).toBe(
      'accessibility_names = "Accessible parking" AND accessibility_names = "Assistance dogs welcome" AND service_names = "Wi-Fi" AND locale = "en"'
    )
  })
})

describe("findSort", () => {
  it("maps the page's sorts", () => {
    expect(findSort({ sort: "complete" })).toEqual([
      "completeness:desc",
      "name:asc",
    ])
    expect(findSort({ sort: "gaps" })).toEqual(["completeness:asc", "name:asc"])
    expect(findSort({ sort: "name" })).toEqual(["name:asc"])
    expect(findSort({ sort: "near", nearLat: 1, nearLng: 2 })).toEqual([
      "_geoPoint(1, 2):asc",
    ])
  })
})

describe("searchFind", () => {
  it("takes the exact total from the locale facet and caps the pages", async () => {
    search.mockResolvedValue({
      facetDistribution: { open_tz: { "America/New_York": 1 } },
    })
    multiSearch.mockResolvedValue({
      results: [
        {
          hits: [{ id: 1, name: "A" }],
          facetDistribution: {
            locale: { en: 1190 },
            libraryType: { Public: 1189 },
            needs: { photo: 1100 },
            has_hours: { true: 900, false: 290 },
            has_iiif: { false: 1190 },
          },
        },
        { facetDistribution: { locale: { en: 12 } } },
      ],
    })

    const result = await searchFind({ locale: "en", hitsPerPage: 24, now: NOW })

    expect(result.total).toBe(1190)
    expect(result.pageCount).toBe(Math.ceil(FIND_MAX_REACHABLE / 24))
    expect(result.facets).toMatchObject({
      libraryType: { Public: 1189 },
      needs: { photo: 1100 },
      hoursKnown: 900,
      digital: 0,
      openNow: 12,
    })
    const [{ queries }] = multiSearch.mock.calls[0] as [
      { queries: { filter: string; page?: number }[] },
    ]
    expect(queries[0]!.page).toBe(1)
    expect(queries[1]!.filter).toContain('open_tz IN ["America/New_York"]')
  })
})

type Query = { filter: string; facets?: string[] }

const onlyFacet = (q: Query, facet: string) =>
  q.facets?.length === 1 && q.facets[0] === facet

describe("searchFind counts", () => {
  it("counts type and needs options under every other filter", async () => {
    search.mockResolvedValue({ facetDistribution: { open_tz: {} } })
    // National libraries that need a photo: 3. Each group's own search
    // drops its own filter.
    multiSearch.mockImplementation(
      async ({ queries }: { queries: Query[] }) => ({
        results: queries.map((q) => {
          if (onlyFacet(q, "libraryType"))
            return {
              facetDistribution: { libraryType: { National: 3, Public: 40 } },
            }
          if (onlyFacet(q, "needs"))
            return { facetDistribution: { needs: { photo: 3, hours: 5 } } }

          return {
            hits: [],
            facetDistribution: {
              locale: { en: 3 },
              libraryType: { National: 3 },
              needs: { photo: 3, hours: 1 },
            },
          }
        }),
      })
    )

    const result = await searchFind({
      locale: "en",
      libraryTypes: ["National"],
      needs: ["photo"],
      now: NOW,
    })

    expect(result.total).toBe(3)
    expect(result.facets.libraryType).toEqual({ National: 3, Public: 40 })
    expect(result.facets.needs).toEqual({ photo: 3, hours: 5 })
    const [{ queries }] = multiSearch.mock.calls[0] as [{ queries: Query[] }]
    const types = queries.find((q) => onlyFacet(q, "libraryType"))!
    expect(types.filter).not.toContain("libraryType")
    expect(types.filter).toContain('needs IN ["photo"]')
    const needs = queries.find((q) => onlyFacet(q, "needs"))!
    expect(needs.filter).not.toContain("needs")
    expect(needs.filter).toContain('libraryType IN ["National"]')
  })

  it("keeps ticked accessibility and service options listed with no matches", async () => {
    search.mockResolvedValue({ facetDistribution: { open_tz: {} } })
    multiSearch.mockResolvedValue({
      results: [
        { hits: [], facetDistribution: { locale: {} } },
        { facetDistribution: { locale: {} } },
        { facetDistribution: {} },
      ],
    })

    const { facets } = await searchFind({
      locale: "en",
      accessibilityNames: ["Hearing loop"],
      serviceNames: ["Wi-Fi"],
      now: NOW,
    })

    expect(facets.accessibility).toEqual({ "Hearing loop": 0 })
    expect(facets.services).toEqual({ "Wi-Fi": 0 })
  })
})

describe("searchFind location", () => {
  it("names the chosen place's parents and lists each level's places", async () => {
    search.mockImplementation(
      async (_q: string, params: { limit?: number; distinct?: string }) => {
        if (params.limit === 1)
          return {
            hits: [
              {
                continent_slug: "europe",
                continent_name: "Europe",
                country_slug: "england",
                country_name: "England",
                region_slug: "hertfordshire",
                region_name: "Hertfordshire",
              },
            ],
          }
        const names: Record<string, Record<string, string>[]> = {
          continent_slug: [
            { continent_slug: "europe", continent_name: "Europe" },
            { continent_slug: "asia", continent_name: "Asia" },
          ],
          country_slug: [
            { country_slug: "wales", country_name: "Wales" },
            { country_slug: "england", country_name: "England" },
            { country_slug: "scotland", country_name: "Scotland" },
          ],
          region_slug: [
            { region_slug: "kent", region_name: "Kent" },
            { region_slug: "hertfordshire", region_name: "Hertfordshire" },
          ],
        }
        if (params.distinct) return { hits: names[params.distinct] }

        return { facetDistribution: { open_tz: {} } }
      }
    )
    multiSearch.mockResolvedValue({
      results: [
        { hits: [], facetDistribution: { locale: { en: 0 } } },
        { facetDistribution: { locale: { en: 0 } } },
        {
          facetDistribution: {
            continent_slug: { europe: 50 },
            country_slug: { england: 40, wales: 10, "united-states": 5 },
          },
        },
        { facetDistribution: { region_slug: { kent: 7 } } },
      ],
    })

    // Its own locale, so lookups cached by the searches above don't answer.
    const { location } = await searchFind({
      locale: "es",
      place: { level: "region", slug: "hertfordshire" },
      openNow: true,
      now: NOW,
    })

    expect(location).toEqual({
      continent: { slug: "europe", name: "Europe" },
      country: { slug: "england", name: "England" },
      region: { slug: "hertfordshire", name: "Hertfordshire" },
      continents: [{ slug: "europe", name: "Europe", count: 50 }],
      countries: [
        { slug: "england", name: "England", count: 40 },
        { slug: "wales", name: "Wales", count: 10 },
      ],
      // Chosen, so listed even with nothing open there.
      regions: [
        { slug: "hertfordshire", name: "Hertfordshire", count: 0 },
        { slug: "kent", name: "Kent", count: 7 },
      ],
    })
    const [{ queries }] = multiSearch.mock.calls[0] as [
      { queries: { filter: string }[] },
    ]
    expect(queries[0]!.filter).toContain('region_slug = "hertfordshire"')
    expect(queries[2]!.filter).not.toContain("_slug =")
    expect(queries[2]!.filter).toContain("open_tz")
    expect(queries[3]!.filter).toMatch(/^country_slug = "england" AND /)
  })

  it("reads the chosen country's Region labels off the chain hit", async () => {
    search.mockImplementation(
      async (_q: string, params: { limit?: number; distinct?: string }) => {
        if (params.limit === 1)
          return {
            hits: [
              {
                continent_slug: "europe",
                continent_name: "Europe",
                country_slug: "switzerland",
                country_name: "Switzerland",
                country_region_label: "Canton",
                country_regions_label: "Cantons",
              },
            ],
          }
        if (params.distinct) return { hits: [] }

        return { facetDistribution: { open_tz: {} } }
      }
    )
    multiSearch.mockResolvedValue({
      results: [
        { hits: [], facetDistribution: { locale: { en: 0 } } },
        { facetDistribution: { locale: { en: 0 } } },
        { facetDistribution: {} },
        { facetDistribution: {} },
      ],
    })

    // Its own locale, so lookups cached by the searches above don't answer.
    const { location } = await searchFind({
      locale: "de",
      place: { level: "country", slug: "switzerland" },
      now: NOW,
    })

    expect(location.country).toEqual({
      slug: "switzerland",
      name: "Switzerland",
      regionTypeLabel: "Canton",
      regionsSectionLabel: "Cantons",
    })

    const chainCall = search.mock.calls.find(
      (c) => (c[1] as { limit?: number } | undefined)?.limit === 1
    )
    expect(
      (chainCall?.[1] as { attributesToRetrieve?: string[] } | undefined)
        ?.attributesToRetrieve
    ).toEqual(
      expect.arrayContaining(["country_region_label", "country_regions_label"])
    )
  })
})
