import { beforeEach, describe, expect, it, vi } from "vitest"

const meili = vi.hoisted(() => ({ multiSearch: vi.fn() }))

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: meili,
  searchLocale: (l?: string) => l ?? "en",
  searchLocaleFilter: (l?: string) => `locale = "${l ?? "en"}"`,
}))
// No shared cache between tests.
vi.mock("@/lib/find-search", () => ({
  cached: <V>(_key: string, load: () => Promise<V>) => load(),
}))

const { fetchDriveGaps, staleCutoff, topFacet } =
  await import("../drive-gaps-server")

const facets = (regions: Record<string, number>) => ({
  facetDistribution: { region_slug: regions },
})

beforeEach(() => {
  meili.multiSearch.mockReset()
})

describe("topFacet", () => {
  it("takes the highest count, the first slug on a tie, and skips zeros", () => {
    expect(topFacet({ a: 2, b: 5, c: 5 })).toEqual({ slug: "b", count: 5 })
    expect(topFacet({ a: 0 })).toBeNull()
    expect(topFacet(undefined)).toBeNull()
  })
})

describe("staleCutoff", () => {
  it("is two years earlier, in Unix seconds", () => {
    const now = new Date("2026-10-05T12:00:00Z")

    expect(staleCutoff(now)).toBe(Date.parse("2024-10-05T12:00:00Z") / 1000)
  })
})

describe("fetchDriveGaps", () => {
  it("names the busiest region for each gap and links to Find libraries", async () => {
    meili.multiSearch
      .mockResolvedValueOnce({
        results: [
          facets({ ohio: 251, kent: 18 }),
          facets({ kent: 24 }),
          facets({}),
          facets({ wales: 7 }),
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { hits: [{ region_name: "Ohio", country_name: "United States" }] },
          { hits: [{ region_name: "Kent", country_name: "United Kingdom" }] },
          { hits: [] },
        ],
      })

    const gaps = await fetchDriveGaps("en")

    expect(gaps).toEqual([
      {
        key: "hours",
        title: "Opening hours missing",
        count: 251,
        place: { level: "region", slug: "ohio", name: "Ohio, United States" },
        href: "/libraries?region=ohio&needs=hours",
      },
      {
        key: "photo",
        title: "No photo yet",
        count: 24,
        place: { level: "region", slug: "kent", name: "Kent, United Kingdom" },
        href: "/libraries?region=kent&needs=photo",
      },
      {
        key: "stale",
        title: "Not checked in over two years",
        count: 7,
        place: { level: "region", slug: "wales", name: "Wales" },
        href: "/libraries?region=wales&sort=gaps",
      },
    ])

    const [first] = meili.multiSearch.mock.calls[0] as [
      { queries: { filter: string; facets: string[]; limit: number }[] },
    ]
    expect(first.queries.map((q) => q.filter)).toEqual([
      'needs = "hours" AND locale = "en"',
      'needs = "photo" AND locale = "en"',
      'needs = "accessibility" AND locale = "en"',
      expect.stringMatching(/^last_verified_ts < \d+ AND locale = "en"$/),
    ])
    expect(first.queries.every((q) => q.limit === 0)).toBe(true)
  })

  it("is empty when every gap is filled, without naming any place", async () => {
    meili.multiSearch.mockResolvedValueOnce({
      results: [facets({}), facets({}), facets({}), facets({})],
    })

    expect(await fetchDriveGaps("en")).toEqual([])
    expect(meili.multiSearch).toHaveBeenCalledTimes(1)
  })

  it("is empty when Meilisearch can't answer", async () => {
    meili.multiSearch.mockRejectedValueOnce(new Error("down"))

    expect(await fetchDriveGaps("en")).toEqual([])
  })
})
