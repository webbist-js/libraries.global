import { beforeEach, describe, expect, it, vi } from "vitest"

const { multiSearch } = vi.hoisted(() => ({ multiSearch: vi.fn() }))

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { multiSearch },
  searchLocaleFilter: (l?: string) => `locale = "${l ?? "en"}"`,
}))

const { driveCounts, driveProgressOf } = await import("../drive-progress")

const SCOPE_FILTER =
  'documentId IN ["lib1", "lib2"] AND operationalStatus != "permanently_closed"'
const TODO_FILTER = `${SCOPE_FILTER} AND needs IN ["hours"]`

const drive = {
  scope: { libraries: ["lib1", "lib2"] },
  focus: { kind: "gaps" as const, gaps: ["hours" as const] },
}

const facetResult = (count: number) => ({
  facetDistribution: { locale: { en: count } },
})

beforeEach(() => {
  multiSearch.mockReset()
})

describe("driveCounts", () => {
  it("runs one multiSearch with the scope and to-do filters, each AND'd with the locale", async () => {
    multiSearch.mockResolvedValue({
      results: [facetResult(120), facetResult(37)],
    })

    const result = await driveCounts(drive, "en")

    expect(result).toEqual({ total: 120, todo: 37 })
    const [{ queries }] = multiSearch.mock.calls[0] as [
      {
        queries: {
          indexUid: string
          filter: string
          limit: number
          facets: string[]
        }[]
      },
    ]
    expect(queries).toHaveLength(2)
    expect(queries[0]).toMatchObject({
      indexUid: "library",
      filter: `${SCOPE_FILTER} AND locale = "en"`,
      limit: 0,
      facets: ["locale"],
    })
    expect(queries[1]).toMatchObject({
      indexUid: "library",
      filter: `${TODO_FILTER} AND locale = "en"`,
      limit: 0,
      facets: ["locale"],
    })
  })

  it("sums every value in the locale facet, not just one entry", async () => {
    multiSearch.mockResolvedValue({
      results: [
        { facetDistribution: { locale: { en: 10, fr: 5 } } },
        { facetDistribution: { locale: { en: 2 } } },
      ],
    })

    const result = await driveCounts(drive, "en")

    expect(result).toEqual({ total: 15, todo: 2 })
  })

  it("passes the drive's openedAt through to the filters", async () => {
    multiSearch.mockResolvedValue({
      results: [facetResult(5), facetResult(1)],
    })

    await driveCounts({ ...drive, openedAt: "2026-09-01T00:00:00.000Z" }, "en")

    const [{ queries }] = multiSearch.mock.calls[0] as [
      { queries: { filter: string }[] },
    ]
    expect(queries[0]!.filter).toContain("created_ts <=")
  })

  it("returns null when Meilisearch fails", async () => {
    multiSearch.mockRejectedValue(new Error("meilisearch down"))

    const result = await driveCounts(drive, "en")

    expect(result).toBeNull()
  })
})

describe("driveProgressOf", () => {
  it("combines live counts with in-review stats via the shared formula", () => {
    const result = driveProgressOf(
      { goalPercent: 80 },
      { total: 100, todo: 20 },
      { inReview: 5 }
    )

    expect(result).toEqual({
      total: 100,
      done: 80,
      todo: 20,
      inReview: 5,
      percent: 80,
      goalMet: true,
    })
  })

  it("treats missing stats as zero in review", () => {
    const result = driveProgressOf(
      { goalPercent: 100 },
      { total: 10, todo: 10 },
      null
    )

    expect(result).toMatchObject({ inReview: 0, done: 0, percent: 0 })
  })

  it("is null when the counts aren't available", () => {
    expect(
      driveProgressOf({ goalPercent: 80 }, null, { inReview: 2 })
    ).toBeNull()
  })
})
