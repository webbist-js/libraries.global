import {
  atlasMatchesProjection,
  atlasResolveScope,
  atlasWeeklyIntervals,
  emptyAtlasFilters,
  projectAtlasLibrary,
  type AtlasDictionary,
  type AtlasLibrarySource,
  type AtlasScope,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { applyFilters, EMPTY_FILTERS, type AtlasLibrary } from "../atlas.logic"

import fixture from "../../../../../../qa/fixtures/atlas/corpus.json"

const now = new Date(fixture.evaluatedAt)
const rows = fixture.records.flatMap((entry, n) => {
  const source = { ...fixture.defaults, ...entry } as AtlasLibrarySource
  const projection = projectAtlasLibrary(source, {
    atlasId: n + 1,
    canonicalLocale: "en",
    now,
  })
  // The legacy map listed buildings; moving-library depots are not locations.
  if (
    !projection ||
    (source.libraryType === "Mobile" && source.mobileTimetable != null)
  )
    return []
  const legacy: AtlasLibrary = {
    id: source.documentId,
    name: source.name,
    slug: source.slug,
    type: source.libraryType ?? "",
    status: source.operationalStatus ?? "",
    operator: source.operatorType ?? null,
    city: source.city ?? null,
    country: source.country?.name ?? null,
    region: source.region?.name ?? null,
    path: projection.path,
    tz: source.timezone ?? null,
    hours: source.openingTimes
      ? atlasWeeklyIntervals(source.openingTimes)
      : null,
    notices: [...(source.notices ?? [])],
    founded: projection.founded,
    closed: null,
    events: projection.has_events,
    catalogue: projection.has_catalogue,
    access: (source.accessibility ?? []).map((o) => o.name),
    services: [...(source.services ?? []), ...(source.amenities ?? [])].map(
      (o) => o.name
    ),
    complete: projection.completeness ?? 0,
    lat: projection.latitude,
    lng: projection.longitude,
  }

  return [{ projection, legacy }]
})
describe("Atlas legacy filter parity before data-path migration", () => {
  it.each([
    {},
    { types: ["academic", "mobile"] },
    { operators: ["council"] },
    { facilities: ["Wi-Fi"] },
    { facilities: ["Wi-Fi", "Toilet"] },
    { events: true },
    { catalogue: true, founded: [1900, 1910] },
    { opening: "at", atDay: 3, atMinutes: 675 },
  ] as Partial<AtlasScope["filters"]>[])(
    "preserves static and ordinary-hours membership %j",
    (patch) => {
      const filters = { ...emptyAtlasFilters(), ...patch }
      const resolved = atlasResolveScope(
        {
          filters,
          accessibility: { enabled: false, selected: [], view: "matches" },
        },
        fixture.dictionary as AtlasDictionary
      )
      const current = rows
        .filter((r) => atlasMatchesProjection(r.projection, resolved, now))
        .map((r) => r.legacy.id)
      expect(current).toEqual(
        applyFilters(
          rows.map((r) => r.legacy),
          { ...EMPTY_FILTERS, ...filters },
          now
        ).map((r) => r.id)
      )
    }
  )
  it("records the intentional Notice-aware Open now change", () => {
    const filters = { ...emptyAtlasFilters(), opening: "now" as const }
    const resolved = atlasResolveScope(
      {
        filters,
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
      fixture.dictionary as AtlasDictionary
    )
    expect(
      rows
        .filter((r) => atlasMatchesProjection(r.projection, resolved, now))
        .map((r) => r.legacy.id)
    ).toEqual(fixture.expected.openNow)
    expect(
      applyFilters(
        rows.map((r) => r.legacy),
        { ...EMPTY_FILTERS, ...filters },
        now
      ).map((r) => r.id)
    ).toEqual(fixture.expected.openAt)
  })
})
