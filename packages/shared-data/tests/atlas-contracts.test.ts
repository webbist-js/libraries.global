import { describe, expect, it } from "vitest"

import {
  ATLAS_LIMITS,
  atlasAggregation,
  atlasBoundsRanges,
  atlasCellId,
  atlasCellsForBounds,
  atlasDisplayCoordinate,
  atlasHoursProjection,
  atlasInBounds,
  atlasKeysetFilter,
  atlasNameSortKey,
  atlasOpenNowFilter,
  atlasPlaceSortKey,
  atlasProjectionOpenNow,
  atlasRevision,
  atlasTimezoneCatalog,
  atlasWeeklyIntervals,
  emptyAtlasFilters,
  parseAtlasQueryRequest,
  parseAtlasScope,
  projectAtlasLibrary,
  type AtlasLibrarySource,
  type LibraryNotice,
} from "../index"

const scope = () => ({
  filters: emptyAtlasFilters(),
  accessibility: { enabled: false, selected: [], view: "matches" },
})
const source: AtlasLibrarySource = {
  documentId: "a",
  name: "A",
  slug: "a",
  locale: "en",
  published: true,
  location: { lat: 52, lng: 1 },
  timezone: "Europe/London",
}
const notice = (from: string, to: string | null): LibraryNotice => ({
  id: "closure",
  type: "closure",
  scope: "library",
  scopeWeek: null,
  scopeDay: null,
  stopId: null,
  from,
  to,
  endedAt: null,
  message: "",
  reason: null,
})
const openingTimes = {
  days: [
    {
      day: "sunday",
      enabled: true,
      timeframes: [{ startTime: "01:00", endTime: "02:00" }],
    },
  ],
}

describe("Atlas request contracts and canonical cursors", () => {
  it("validates ascending and descending list sorts and safe numeric continuations", () => {
    for (const sort of ["name_desc", "place_desc", "record", "record_desc"]) {
      const request = parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "list",
        scope: { ...scope(), bbox: { west: -1, east: 1, south: -1, north: 1 } },
        sort,
        centre: { lat: 0, lng: 0 },
      })
      expect(request).toMatchObject({ sort })
    }
    expect(atlasKeysetFilter("completeness", 50, 21, true)).toBe(
      "(completeness < 50 OR (completeness = 50 AND atlas_id > 21) OR (completeness IS NULL OR completeness NOT EXISTS))"
    )
    expect(atlasKeysetFilter("completeness", null, 21)).toBe(
      "((completeness IS NULL OR completeness NOT EXISTS) AND atlas_id > 21)"
    )
    expect(
      atlasKeysetFilter("name_sort", atlasNameSortKey("Z"), 21, true)
    ).toContain("name_sort <")
    for (const value of [Number.NaN, Infinity, -1, 101, "50 OR atlas_id > 0"]) {
      expect(() => atlasKeysetFilter("completeness", value, 21)).toThrow()
    }
  })
  it("rejects raw filters, bad bounds, coercions and unknown or excessive selections", () => {
    expect(parseAtlasScope(scope())).toEqual(scope())
    expect(() =>
      parseAtlasScope({ ...scope(), filter: "listed = true" })
    ).toThrow()
    expect(() =>
      parseAtlasScope({
        ...scope(),
        filters: { ...emptyAtlasFilters(), operators: ["invented"] },
      })
    ).toThrow()
    expect(() =>
      parseAtlasScope({
        ...scope(),
        filters: { ...emptyAtlasFilters(), atMinutes: "675" },
      })
    ).toThrow()
    expect(() =>
      parseAtlasScope({
        ...scope(),
        filters: {
          ...emptyAtlasFilters(),
          facilities: Array.from({ length: 101 }).fill("Wi-Fi"),
        },
      })
    ).toThrow()
    expect(() =>
      parseAtlasScope({
        ...scope(),
        bbox: { west: 0, east: 1, south: 90, north: 0 },
      })
    ).toThrow()
    expect(atlasRevision("9007199254740993")).toBe("9007199254740993")
    expect(() => atlasRevision(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    expect(() => atlasRevision("01")).toThrow()
  })
  it("enforces purpose-specific scope and pagination", () => {
    expect(
      parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "counts",
        scope: scope(),
      }).purpose
    ).toBe("counts")
    expect(() =>
      parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "counts",
        scope: scope(),
        q: "raw",
      })
    ).toThrow()
    expect(() =>
      parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "viewport",
        scope: scope(),
      })
    ).toThrow()
    expect(() =>
      parseAtlasQueryRequest({
        schemaVersion: 2,
        purpose: "counts",
        scope: scope(),
      })
    ).toThrow()
  })
  it("accepts an optional density grid request without coercing its value", () => {
    const viewport = {
      schemaVersion: 1,
      purpose: "viewport",
      scope: {
        ...scope(),
        bbox: { west: -10, east: 10, south: -10, north: 10 },
      },
      populations: ["listed"],
      zoom: 6,
      width: 800,
      height: 600,
      centre: { lat: 0, lng: 0 },
      drawingPreference: "current",
    }
    expect(parseAtlasQueryRequest(viewport)).not.toHaveProperty("density")
    for (const density of [true, false])
      expect(parseAtlasQueryRequest({ ...viewport, density })).toHaveProperty(
        "density",
        density
      )
    for (const density of ["true", 1, null, []])
      expect(() => parseAtlasQueryRequest({ ...viewport, density })).toThrow(
        "Invalid Atlas density request"
      )
  })
  it("orders prefix names, folded accents, non-Latin names and ties with an ID", () => {
    const names = [
      "Ab",
      "東京",
      "A",
      "École",
      "Ecole",
      "A B",
      "Αθήνα",
      "  a  b  ",
      "",
      "Å",
    ]
    const sorted = names
      .map((name, id) => ({ name, id, key: atlasNameSortKey(name) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id - b.id))
    expect(sorted.map((r) => r.id)).toEqual([8, 2, 9, 5, 7, 0, 3, 4, 6, 1])
    expect(
      atlasPlaceSortKey("London", "A") < atlasPlaceSortKey("London", "Ab")
    ).toBe(true)
    expect(atlasPlaceSortKey("A", "Z") < atlasPlaceSortKey("Ab", "A")).toBe(
      true
    )
    expect(() => atlasNameSortKey("A\0B")).toThrow()
    expect(() =>
      atlasKeysetFilter("name_sort", atlasPlaceSortKey("A", "B"), 1)
    ).toThrow()
    expect(() =>
      atlasKeysetFilter("name_sort", 'n00" OR atlas_id > 0', 1)
    ).toThrow()
    expect(atlasKeysetFilter("name_sort", atlasNameSortKey("A"), 3)).toContain(
      "atlas_id > 3"
    )
  })
})

describe("Atlas complete adaptive cells", () => {
  it("bounds enumeration before allocation, covers a world and wrapped views", () => {
    const world = { west: -180, east: 180, south: -90, north: 90 }
    expect(atlasCellsForBounds(world, 12)).toEqual({
      count: 16777216,
      complete: false,
      cells: [],
    })
    expect(atlasAggregation(world).cells).toHaveLength(1024)
    expect(
      atlasBoundsRanges({ west: 530, east: 550, south: -1, north: 1 })
    ).toEqual([
      { west: 170, east: 180, south: -1, north: 1 },
      { west: -180, east: -170, south: -1, north: 1 },
    ])
    expect(atlasDisplayCoordinate({ lat: "52", lng: 1 })).toBeNull()
  })
  it("enumerates the cell of every included point at boundaries, poles and the dateline", () => {
    const boxes = [
      { west: 170, east: -170, south: -90, north: 90 },
      { west: -180, east: 180, south: -90, north: 90 },
      { west: -1, east: 1, south: -1, north: 1 },
      { west: 179.9, east: 180, south: 0, north: 0 },
      { west: -180, east: -179.9, south: 85, north: 90 },
    ]
    const points = [-90, -85, -1, 0, 1, 85, 90].flatMap((lat) =>
      [-180, -179.9, -170, -1, 0, 1, 170, 179.9, 180].map(
        (lng) => atlasDisplayCoordinate({ lat, lng })!
      )
    )
    for (const bbox of boxes) {
      const { zoom, cells } = atlasAggregation(bbox)
      const cellIds = new Set(cells.map((c) => c.id))
      for (const point of points.filter((p) => atlasInBounds(p, bbox)))
        expect(cellIds.has(atlasCellId(point, zoom))).toBe(true)
      expect(cellIds.size).toBe(cells.length)
      expect(cells.length).toBeLessThanOrEqual(ATLAS_LIMITS.cells)
    }
  })
})

describe("Atlas local ordinary and effective hours", () => {
  it("preserves quarter hours, midnight ends and rejects malformed minutes and overflow", () => {
    expect(
      atlasWeeklyIntervals({
        days: [
          null,
          {
            day: "monday",
            enabled: true,
            timeframes: [
              { startTime: "09:15", endTime: "24:00" },
              { startTime: "09:99", endTime: "12:00" },
            ],
          },
        ],
      })[0]
    ).toEqual([[555, 1440]])
    expect(() =>
      atlasWeeklyIntervals(
        {
          days: [
            {
              day: "monday",
              enabled: true,
              timeframes: Array.from({ length: 11 }).fill({
                startTime: "09:00",
                endTime: "10:00",
              }),
            },
          ],
        },
        true
      )
    ).toThrow(/limit/)
  })
  it("handles both autumn repeated hours and the spring skipped hour", () => {
    const autumn = projectAtlasLibrary(
      { ...source, openingTimes },
      {
        atlasId: 1,
        canonicalLocale: "en",
        now: new Date("2026-10-25T00:15:00Z"),
      }
    )!
    expect(
      atlasProjectionOpenNow(autumn, new Date("2026-10-25T00:15:00Z"))
    ).toBe(true)
    expect(
      atlasProjectionOpenNow(autumn, new Date("2026-10-25T01:15:00Z"))
    ).toBe(true)
    const spring = projectAtlasLibrary(
      { ...source, openingTimes },
      {
        atlasId: 1,
        canonicalLocale: "en",
        now: new Date("2026-03-29T01:15:00Z"),
      }
    )!
    expect(
      atlasProjectionOpenNow(spring, new Date("2026-03-29T01:15:00Z"))
    ).toBe(false)
  })
  it("schedules local Notice boundaries beyond ten days and refuses stale effective hours", () => {
    const start = new Date("2026-10-01T10:00:00Z")
    const future = atlasHoursProjection(
      openingTimes,
      [notice("2026-12-10", "2026-12-10")],
      "Europe/London",
      start
    )
    expect(future.clock_valid_until).toBe("2026-12-07T00:00:00.000Z")
    const active = projectAtlasLibrary(
      {
        ...source,
        openingTimes,
        notices: [notice("2026-10-25", "2026-10-25")],
      },
      {
        atlasId: 1,
        canonicalLocale: "en",
        now: new Date("2026-10-25T00:15:00Z"),
      }
    )!
    expect(active.clock_valid_until).toBe("2026-10-26T00:00:00.000Z")
    expect(
      atlasProjectionOpenNow(active, new Date("2026-10-25T00:15:00Z"))
    ).toBe(false)
    expect(() =>
      atlasProjectionOpenNow(active, new Date("2026-10-26T00:00:00Z"))
    ).toThrow(/refresh/)
    expect(() =>
      atlasHoursProjection(
        null,
        [notice("2026-12-10", "2026-12-09")],
        "UTC",
        start
      )
    ).toThrow()
  })
  it("uses a complete canonical catalog, with UTC and quarter-hour zones", () => {
    const catalog = atlasTimezoneCatalog()
    expect(catalog.length).toBeGreaterThan(400)
    expect(catalog).toContain("UTC")
    const filter = atlasOpenNowFilter(catalog, new Date("2026-10-08T10:15:00Z"))
    expect(filter).toContain("open_tz IN")
    expect(filter).toContain("open_thu_0_from <= 960") // Kathmandu 16:00.
    expect(atlasOpenNowFilter([], new Date())).toBe("atlas_id < 0")
  })
})
