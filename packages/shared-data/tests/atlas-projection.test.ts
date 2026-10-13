import { describe, expect, it } from "vitest"

import {
  atlasAccessMembership,
  atlasMeiliFilter,
  atlasMatchesProjection,
  atlasPoint,
  atlasResolveScope,
  atlasTileFilter,
  atlasTimezone,
  emptyAtlasFilters,
  projectAtlasLibrary,
  type AtlasDictionary,
  type AtlasLibrarySource,
  type AtlasPopulation,
  type AtlasScope,
} from "../index"

import fixture from "../../../qa/fixtures/atlas/corpus.json"

const now = new Date(fixture.evaluatedAt)
it("keeps missing current hours unknown when a Notice is scheduled for later", () => {
  const row = projectAtlasLibrary(
    {
      ...fixture.defaults,
      documentId: "future-hours",
      name: "Future",
      slug: "future",
      openingTimes: null,
      notices: [
        {
          documentId: "future",
          type: "changed_hours",
          from: "2026-10-12",
          to: "2026-10-13",
          hours: fixture.defaults.openingTimes,
        },
      ],
    } as AtlasLibrarySource,
    { atlasId: 100, canonicalLocale: "en", now }
  )!
  expect(row.has_hours).toBe(false)
  expect(row.has_effective_hours).toBe(false)
})
const dictionary = fixture.dictionary as AtlasDictionary
const projections = fixture.records.flatMap((entry, n) => {
  const projected = projectAtlasLibrary(
    { ...fixture.defaults, ...entry } as AtlasLibrarySource,
    { atlasId: n + 1, canonicalLocale: "en", now }
  )

  return projected ? [projected] : []
})
const scope = (
  patch: Partial<AtlasScope["filters"]> = {},
  accessibility: Partial<AtlasScope["accessibility"]> = {}
): AtlasScope => ({
  filters: { ...emptyAtlasFilters(), ...patch },
  accessibility: {
    enabled: false,
    selected: [],
    view: "matches",
    ...accessibility,
  },
})
const ids = (s: AtlasScope, population: AtlasPopulation = "listed") =>
  projections
    .filter((r) =>
      atlasMatchesProjection(
        r,
        atlasResolveScope(s, dictionary),
        now,
        population
      )
    )
    .map((r) => r.documentId)

// Independent interpreter for the emitted MapLibre subset checks point membership.
function evaluate(
  value: unknown,
  properties: Record<string, unknown>
): unknown {
  if (!Array.isArray(value)) return value
  const [op, ...args] = value
  if (op === "get") return properties[String(args[0])]
  if (op === "literal") return args[0]
  const v = args.map((arg) => evaluate(arg, properties))
  switch (op) {
    case "all":
      return v.every(Boolean)
    case "any":
      return v.some(Boolean)
    case "!":
      return !v[0]
    case "==":
      return v[0] === v[1]
    case "!=":
      return v[0] !== v[1]
    case ">=":
      return Number(v[0]) >= Number(v[1])
    case "<=":
      return Number(v[0]) <= Number(v[1])
    case "in":
      return typeof v[1] === "string"
        ? v[1].includes(String(v[0]))
        : (v[1] as unknown[]).includes(v[0])

    default:
      throw new Error(`Unsupported expression ${op}`)
  }
}
describe("Atlas physical corpus and filter parity", () => {
  it("counts a timetabled mobile service once for access without adding depot or stop pins", () => {
    const depot = projections.find((row) => row.documentId === "depot")!
    expect(depot).toBeTruthy()
    expect(depot.listed).toBe(false)
    expect(depot.access_listed).toBe(true)
    expect(atlasPoint(depot).properties.v).toBe(false)
    expect(
      evaluate(
        atlasTileFilter(atlasResolveScope(scope(), dictionary)),
        atlasPoint(depot).properties
      )
    ).toBe(false)
    expect(
      atlasMeiliFilter(
        atlasResolveScope(scope({ types: ["mobile"] }), dictionary),
        { now, timezones: [], libraryAccess: true }
      )
    ).toContain("access_listed = true")
  })
  it("keeps one canonical institution, separates mobile depots from pins, excludes drafts/unmapped", () => {
    expect(ids(scope())).toEqual(fixture.expected.listed)
    expect(
      ids(
        scope({ types: ["public"], facilities: ["Does not exist"] }),
        "closures"
      )
    ).toEqual(fixture.expected.closures)
    const polar = projections.find((r) => r.documentId === "polar")!
    expect(polar.original_lat).toBe(89)
    expect(polar.latitude).toBeCloseTo(85.0511287798066)
    expect(projections.find((r) => r.documentId === "unknown")?.longitude).toBe(
      -180
    )
    expect(atlasTimezone("Invalid/Timezone")).toBe("UTC")
  })
  it.each([
    [scope({ facilities: ["Wi-Fi"] }), fixture.expected.wifi],
    [scope({ facilities: ["Toilet"] }), fixture.expected.toilet],
    [scope({ facilities: ["Wi-Fi", "Toilet"] }), ["all"]],
    [scope({ facilities: ["Unknown"] }), []],
    [scope({ operators: ["council"] }), ["all"]],
    [scope({ types: ["academic", "mobile"] }), ["partial", "mobile-building"]],
    [scope({ catalogue: true, founded: [1900, 1910] }), ["all"]],
    [
      scope(
        {},
        { enabled: true, selected: ["Wheelchair access", "Hearing loop"] }
      ),
      fixture.expected.allAccess,
    ],
    [
      scope({}, { enabled: true, selected: ["Step-free access"] }),
      fixture.expected.anyAccess,
    ],
    [scope({}, { enabled: true }), fixture.expected.anyAccess],
    [
      scope(
        {},
        {
          enabled: true,
          selected: ["Wheelchair access", "Hearing loop"],
          view: "gaps",
        }
      ),
      fixture.expected.gaps,
    ],
    [
      scope({}, { enabled: true, selected: ["Unknown"], view: "compare" }),
      fixture.expected.listed,
    ],
  ])(
    "agrees on explicit expected IDs and static tile membership",
    (s, expected) => {
      expect(ids(s)).toEqual(expected)
      const expression = atlasTileFilter(atlasResolveScope(s, dictionary))
      expect(
        projections
          .filter((r) =>
            evaluate(
              expression,
              atlasPoint(r).properties as unknown as Record<string, unknown>
            )
          )
          .map((r) => r.documentId)
      ).toEqual(expected)
    }
  )
  it("uses the same named populations and stable place scopes", () => {
    expect(ids(scope(), "events")).toEqual(fixture.expected.events)
    expect(ids(scope(), "late")).toEqual(fixture.expected.late)
    const s = { ...scope(), place: { level: "region" as const, id: "norfolk" } }
    expect(ids(s)).not.toContain("east")
    expect(
      evaluate(
        atlasTileFilter(atlasResolveScope(s, dictionary)),
        atlasPoint(projections.find((r) => r.documentId === "east")!)
          .properties as unknown as Record<string, unknown>
      )
    ).toBe(false)
  })
  it("separates ordinary minute-precision Open at from notice-aware Open now", () => {
    expect(ids(scope({ opening: "at", atDay: 3, atMinutes: 675 }))).toEqual(
      fixture.expected.openAt
    )
    expect(ids(scope({ opening: "now" }))).toEqual(fixture.expected.openNow)
    expect(ids(scope({ opening: "at", atDay: 3, atMinutes: 750 }))).toEqual([])
    expect(() =>
      atlasTileFilter(atlasResolveScope(scope({ opening: "now" }), dictionary))
    ).toThrow(/Dynamic/)
  })
  it("defines partial as any-selected minus all-selected and unconfirmed as the complement", () => {
    const resolved = atlasResolveScope(
      scope(
        {},
        { enabled: true, selected: ["Wheelchair access", "Hearing loop"] }
      ),
      dictionary
    )
    expect(atlasAccessMembership(projections[0]!, resolved.access)).toEqual({
      matches: true,
      partial: false,
      unconfirmed: false,
    })
    expect(atlasAccessMembership(projections[1]!, resolved.access)).toEqual({
      matches: false,
      partial: true,
      unconfirmed: true,
    })
    expect(atlasAccessMembership(projections[2]!, resolved.access)).toEqual({
      matches: false,
      partial: false,
      unconfirmed: true,
    })
    const filter = atlasMeiliFilter(
      atlasResolveScope(
        scope({ facilities: ["Wi-Fi", "Unknown"] }),
        dictionary
      ),
      { now, timezones: ["UTC"] }
    )
    expect(filter).toContain(
      'facility_codes IN ["amenity:wifi","service:wifi"]'
    )
    expect(filter).toContain("atlas_id < 0")
  })
})
