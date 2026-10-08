import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: {},
  searchLocaleFilter: () => 'locale = "en"',
}))
import { viewportFilter, visitDateFilter } from "@/lib/mobile-stop-search"

describe("mobile viewport filters", () => {
  it("splits the antimeridian and handles wrapped/full-world bounds", () => {
    expect(
      viewportFilter({ west: 170, east: 190, south: -20, north: 20 })
    ).toContain(" OR ")
    expect(
      viewportFilter({ west: -190, east: -170, south: -20, north: 20 })
    ).toContain(" OR ")
    expect(
      viewportFilter({ west: -200, east: 200, south: -20, north: 20 })
    ).toBe("_geoBoundingBox([20, 180], [-20, -180])")
  })
  it("refuses malformed bounds and applies cancellations to the same date", () => {
    expect(() =>
      viewportFilter({ west: 0, east: 1, south: Number.NaN, north: 20 })
    ).toThrow()
    expect(visitDateFilter("2026-10-06")).toContain(
      'NOT cancelled_dates = "2026-10-06"'
    )
    expect(visitDateFilter("2026-10-06")).toContain('"d.2026-10-06"')
  })
})
