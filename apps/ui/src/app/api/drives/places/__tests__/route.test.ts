import { beforeEach, describe, expect, it, vi } from "vitest"

const { multiSearch, searchForFacetValues } = vi.hoisted(() => ({
  multiSearch: vi.fn(),
  searchForFacetValues: vi.fn(),
}))

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { multiSearch, index: () => ({ searchForFacetValues }) },
  searchLocaleFilter: (l?: string | null) => `locale = "${l ?? "en"}"`,
}))

const { GET } = await import("../route")
const { rankPlaces, PLACE_SEARCH_LIMIT } =
  await import("@/lib/drives/place-search")
const { MemoryRateLimitStore } = await import("@/lib/rate-limit")

/** A fresh client address per test, so the per-IP limiter starts empty. */
let nextIp = 0
const ip = () => {
  nextIp += 1

  return `203.0.113.${nextIp}`
}

const get = (query: string, address = ip()) =>
  GET(
    new Request(`http://localhost/api/drives/places?${query}`, {
      headers: { "x-forwarded-for": address },
    })
  )

/** One multiSearch answer: the country, region and area queries' hits. */
const answer = (
  country: Record<string, unknown>[],
  region: Record<string, unknown>[],
  area: Record<string, unknown>[]
) => ({ results: [{ hits: country }, { hits: region }, { hits: area }] })

const EALING_HIT = {
  area_slug: "ealing",
  area_name: "Ealing",
  region_name: "Greater London",
  country_name: "England",
}

beforeEach(() => {
  ;(globalThis as { _rateLimitStore?: unknown })._rateLimitStore =
    new MemoryRateLimitStore()
  multiSearch.mockReset().mockResolvedValue(answer([], [], []))
  searchForFacetValues.mockReset().mockResolvedValue({ facetHits: [] })
})

describe("GET /api/drives/places", () => {
  it("is an empty list for an empty query, without asking Meilisearch", async () => {
    for (const query of ["", "q=", "q=%20%20"]) {
      const res = await get(query)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ data: [] })
    }
    expect(multiSearch).not.toHaveBeenCalled()
  })

  it("asks each level's name field once, one hit per place, in the route's locale", async () => {
    await get("q=eal&locale=fr")
    const [{ queries }] = multiSearch.mock.calls[0] as [
      { queries: Record<string, unknown>[] },
    ]
    expect(queries).toHaveLength(3)
    expect(queries.map((q) => q.attributesToSearchOn)).toEqual([
      ["country_name"],
      ["region_name"],
      ["area_name"],
    ])
    expect(queries.map((q) => q.distinct)).toEqual([
      "country_slug",
      "region_slug",
      "area_slug",
    ])
    for (const q of queries) {
      expect(q).toMatchObject({
        indexUid: "library",
        q: "eal",
        filter: 'locale = "fr"',
        limit: PLACE_SEARCH_LIMIT,
      })
    }
    expect(searchForFacetValues).toHaveBeenCalledWith({
      facetName: "continent_slug",
      facetQuery: "eal",
      filter: 'locale = "fr"',
    })
  })

  it("returns each place's level, slug, name and context", async () => {
    multiSearch.mockResolvedValueOnce(
      answer(
        [
          {
            country_slug: "england",
            country_name: "England",
            continent_name: "Europe",
          },
        ],
        [
          {
            region_slug: "greater-london",
            region_name: "Greater London",
            country_name: "England",
            country_region_label: "County",
          },
        ],
        [EALING_HIT]
      )
    )
    searchForFacetValues.mockResolvedValueOnce({
      facetHits: [{ value: "europe", count: 3798 }],
    })
    const res = await get("q=e")
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("s-maxage=300")
    const { data } = (await res.json()) as { data: unknown[] }
    expect(data).toEqual(
      expect.arrayContaining([
        { level: "continent", slug: "europe", name: "Europe", context: "" },
        {
          level: "country",
          slug: "england",
          name: "England",
          context: "Europe",
        },
        {
          level: "region",
          slug: "greater-london",
          name: "Greater London",
          context: "England",
          kind: "County",
        },
        {
          level: "area",
          slug: "ealing",
          name: "Ealing",
          context: "Greater London, England",
        },
      ])
    )
    expect(data).toHaveLength(4)
  })

  it("lists each place once and drops hits without a slug or name", async () => {
    multiSearch.mockResolvedValueOnce(
      answer(
        [],
        [],
        [
          EALING_HIT,
          { ...EALING_HIT },
          { area_slug: "", area_name: "Nowhere" },
          { area_slug: "nameless" },
        ]
      )
    )
    const { data } = (await (await get("q=ealing")).json()) as {
      data: { slug: string }[]
    }
    expect(data.map((p) => p.slug)).toEqual(["ealing"])
  })

  it("returns at most eight places", async () => {
    const areas = Array.from({ length: 8 }, (_, i) => ({
      ...EALING_HIT,
      area_slug: `area-${i}`,
      area_name: `Hill ${i}`,
    }))
    const regions = Array.from({ length: 8 }, (_, i) => ({
      region_slug: `region-${i}`,
      region_name: `Hill Region ${i}`,
      country_name: "England",
    }))
    multiSearch.mockResolvedValueOnce(answer([], regions, areas))
    const { data } = (await (await get("q=hill")).json()) as {
      data: { level: string }[]
    }
    expect(data).toHaveLength(8)
    // Equal matches: the broader level first.
    expect(data.every((p) => p.level === "region")).toBe(true)
  })

  it("leaves continents out when their facet search fails", async () => {
    searchForFacetValues.mockRejectedValueOnce(new Error("down"))
    multiSearch.mockResolvedValueOnce(answer([], [], [EALING_HIT]))
    const res = await get("q=ealing")
    expect(res.status).toBe(200)
    expect(
      ((await res.json()) as { data: { slug: string }[] }).data.map(
        (p) => p.slug
      )
    ).toEqual(["ealing"])
  })

  it("is 502 when Meilisearch can't be reached", async () => {
    multiSearch.mockRejectedValueOnce(new Error("down"))
    const res = await get("q=ealing")
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: "Places are unavailable right now.",
    })
  })

  it("rate limits at 120 requests a minute per address", async () => {
    const address = ip()
    for (let i = 0; i < 120; i++) {
      expect((await get("q=e", address)).status).toBe(200)
    }
    expect((await get("q=e", address)).status).toBe(429)
    expect((await get("q=e")).status).toBe(200)
  })
})

describe("rankPlaces", () => {
  const place = (level: "country" | "region" | "area", name: string) => ({
    level,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    context: "",
  })

  it("puts exact names first, then prefixes, then word prefixes, then the rest", () => {
    const ranked = rankPlaces("london", [
      place("area", "Londonderry"),
      place("region", "Greater London"),
      place("region", "Lindon"),
      place("area", "London"),
    ])
    expect(ranked.map((p) => p.name)).toEqual([
      "London",
      "Londonderry",
      "Greater London",
      "Lindon",
    ])
  })

  it("matches without accents or case", () => {
    const ranked = rankPlaces("zurich", [
      place("area", "Winterthur"),
      place("region", "Zürich"),
    ])
    expect(ranked[0]?.name).toBe("Zürich")
  })
})
