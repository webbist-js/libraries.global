import type { PublicLiveState } from "@repo/shared-data"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { search, multiSearch } = vi.hoisted(() => ({
  search: vi.fn(),
  multiSearch: vi.fn(),
}))
vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { index: () => ({ search }), multiSearch },
  searchLocaleFilter: () => "locale = en",
}))
import {
  searchMobileViewport,
  stopMatchesOpening,
  type MobileStopHit,
} from "../mobile-stop-search"

const bounds = { west: -6, east: -4, south: 50, north: 51 }
beforeEach(() => vi.clearAllMocks())
describe("mobile stop clusters", () => {
  it("includes live-sharing candidates when filtering open stops outside their scheduled day", async () => {
    search.mockResolvedValueOnce({
      facetDistribution: { timezone: { "Europe/London": 1 } },
    })
    search.mockResolvedValueOnce({ hits: [], facetDistribution: {} })
    await searchMobileViewport(bounds, 10, "any", new Date(), {
      opening: "now",
      atDay: 0,
      atMinutes: 0,
    })
    expect(search.mock.calls[1]![1].filter).toContain("OR shares_live = true")
  })
  it("queries recurrence and live-sharing in the index, keeping facet totals before the viewport cap", async () => {
    search.mockResolvedValue({
      hits: [],
      facetDistribution: { kind: { stop: 0 } },
    })
    await searchMobileViewport(bounds, 10, "any", new Date(), {
      opening: "any",
      atDay: 0,
      atMinutes: 0,
      mobileFrequency: ["weekly", "monthly"],
      mobileSharesLive: true,
    })
    const query = search.mock.calls[0]![1]
    expect(query.filter).toContain('frequencies IN ["weekly","monthly"]')
    expect(query.filter).toContain("shares_live = true")
    expect(query.limit).toBe(1000)
  })
  it("filters stop opening using its local timetable and recorded cancellations", () => {
    const stop = {
      stop_id: "a",
      timezone: "Europe/London",
      cycle: { weeks: 1, anchor: "2026-10-05" },
      cancelled_dates: [],
      visits: [
        {
          id: "visit",
          stopId: "a",
          day: "tue",
          arrive: "11:00",
          depart: "12:30",
          repeat: { kind: "cycle", weeks: [1] },
          termTimeOnly: false,
          validFrom: null,
          validTo: null,
        },
      ],
    } as unknown as MobileStopHit
    const filters = { opening: "now" as const, atDay: 0, atMinutes: 0 }
    expect(
      stopMatchesOpening(stop, filters, new Date("2026-10-06T10:30:00Z"))
    ).toBe(true)
    expect(
      stopMatchesOpening(stop, filters, new Date("2026-10-06T12:30:00Z"))
    ).toBe(false)
    expect(
      stopMatchesOpening(
        { ...stop, cancelled_dates: ["2026-10-06"] },
        filters,
        new Date("2026-10-06T10:30:00Z")
      )
    ).toBe(false)
    const live = {
      sharesLive: true,
      kind: "here" as const,
      stopId: "a",
    } as PublicLiveState
    expect(
      stopMatchesOpening(stop, filters, new Date("2026-10-07T10:30:00Z"), live)
    ).toBe(true)
    expect(
      stopMatchesOpening(stop, filters, new Date("2026-10-07T10:30:00Z"), {
        ...live,
        kind: "road",
      })
    ).toBe(false)
  })
  it("keeps all six actual positions even below the old zoom threshold", async () => {
    const stops = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      _geo: { lat: 50.154 + i / 10000, lng: -5.07 },
    }))
    search.mockResolvedValue({
      hits: stops,
      facetDistribution: { kind: { stop: 6 }, geo_cell: { "50,-6": 6 } },
    })
    const result = await searchMobileViewport(bounds, 6, "any")
    expect(result.stops).toEqual(stops)
    expect(result.clusters).toEqual([])
    expect(result.zoomIn).toBe(false)
    expect(multiSearch).not.toHaveBeenCalled()
  })
  it("anchors capped aggregates on an actual stop instead of an offshore grid centre", async () => {
    search.mockResolvedValue({
      hits: [],
      facetDistribution: { kind: { stop: 1001 }, geo_cell: { "50,-6": 1001 } },
    })
    multiSearch.mockResolvedValue({
      results: [{ hits: [{ _geo: { lat: 50.154, lng: -5.07 } }] }],
    })
    const result = await searchMobileViewport(bounds, 6, "any")
    expect(result.clusters).toEqual([{ lat: 50.154, lng: -5.07, count: 1001 }])
    expect(result.zoomIn).toBe(true)
    expect(multiSearch.mock.calls[0]?.[0].queries[0].limit).toBe(1)
  })
})
