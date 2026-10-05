import { describe, expect, it } from "vitest"

import type { ResolvedProfile } from "../../scripts/ingests/gazetteer/country-profiles"
import { planChildren } from "../../scripts/ingests/gazetteer/plan"
import {
  decideFill,
  hasUnpublishedChanges,
  isOurs,
  isResumable,
  isRetryable,
  labelChanges,
  needsDumpForNameMatching,
  regionLabelChanges,
  retryAfterMs,
  statusOf,
  WHOLE_COUNTRY_REGION_ATTRIBUTION,
  wholeCountryRegion,
} from "../../scripts/ingests/gazetteer/run-rules"

const profile = (labels: ResolvedProfile["labels"]): ResolvedProfile => ({
  key: "XX",
  labels,
  regionLevel: 1,
  areaLevel: 2,
  geonames: { country: "XX" },
  fill: false,
  source: "geonames",
  curatedFile: null,
  tidyNames: [],
  areaSlugSuffix: "on-clash",
  aliases: {},
})

describe("statusOf", () => {
  it("reads the status StrapiClient embeds in its error message", () => {
    expect(statusOf(new Error("POST /regions → 400: Bad Request"))).toBe(400)
    expect(statusOf(new Error("GET /areas → 503: Service Unavailable"))).toBe(
      503
    )
  })

  it("is null for an error with no embedded status (a network error)", () => {
    expect(statusOf(new Error("fetch failed"))).toBeNull()
    expect(statusOf("not an Error at all")).toBeNull()
  })
})

describe("isRetryable", () => {
  it("retries a network error (no status)", () => {
    expect(isRetryable(new Error("fetch failed"))).toBe(true)
  })

  it("retries 429 and any 5xx", () => {
    expect(isRetryable(new Error("PUT /regions/1 → 429: too many"))).toBe(true)
    expect(isRetryable(new Error("PUT /regions/1 → 500: oops"))).toBe(true)
    expect(isRetryable(new Error("PUT /regions/1 → 503: down"))).toBe(true)
  })

  it("never retries any other 4xx", () => {
    expect(isRetryable(new Error("PUT /regions/1 → 400: bad"))).toBe(false)
    expect(isRetryable(new Error("PUT /regions/1 → 404: missing"))).toBe(false)
    expect(isRetryable(new Error("PUT /regions/1 → 409: conflict"))).toBe(false)
  })
})

describe("retryAfterMs", () => {
  it("is null for anything that isn't a 429", () => {
    expect(
      retryAfterMs(new Error("PUT /regions/1 → 500: Retry-After: 30"))
    ).toBeNull()
    expect(retryAfterMs(new Error("PUT /regions/1 → 400: bad"))).toBeNull()
    expect(retryAfterMs(new Error("fetch failed"))).toBeNull()
  })

  it("reads the wait, in ms, from a 429 whose body carries Retry-After", () => {
    expect(
      retryAfterMs(new Error("PUT /regions/1 → 429: Retry-After: 30"))
    ).toBe(30_000)
    expect(
      retryAfterMs(new Error("PUT /regions/1 → 429: retry-after: 5"))
    ).toBe(5000)
  })

  it("is null, so the caller keeps its own backoff, when a 429's body has nothing parseable", () => {
    expect(
      retryAfterMs(new Error("PUT /regions/1 → 429: Too Many Requests"))
    ).toBeNull()
  })

  it("caps an excessive wait at 60 seconds", () => {
    expect(
      retryAfterMs(new Error("PUT /regions/1 → 429: Retry-After: 3600"))
    ).toBe(60_000)
  })
})

describe("isOurs", () => {
  const check = {
    attribution: "GeoNames (geonames.org), CC BY 4.0",
    parentId: "country-1",
  }

  it("rejects a place whose sourceAttribution doesn't match (hand-made)", () => {
    expect(
      isOurs(
        "regions",
        {
          sourceAttribution: "Someone typed this in",
          country: { documentId: "country-1" },
        },
        check
      )
    ).toBe(false)
  })

  it("rejects a place with the wrong geonamesId, when the source had one", () => {
    expect(
      isOurs(
        "regions",
        {
          sourceAttribution: check.attribution,
          geonamesId: "999",
          country: { documentId: "country-1" },
        },
        { ...check, geonamesId: "123" }
      )
    ).toBe(false)
  })

  it("rejects a place with the wrong gssCode, when the source had one", () => {
    expect(
      isOurs(
        "areas",
        {
          sourceAttribution: check.attribution,
          gssCode: "E06000099",
          region: { documentId: "country-1" },
        },
        { ...check, gssCode: "E06000001" }
      )
    ).toBe(false)
  })

  it("rejects a place in the wrong parent — a Region's country for regions, an Area's region for areas", () => {
    expect(
      isOurs(
        "regions",
        {
          sourceAttribution: check.attribution,
          country: { documentId: "some-other-country" },
        },
        check
      )
    ).toBe(false)
    expect(
      isOurs(
        "areas",
        {
          sourceAttribution: check.attribution,
          region: { documentId: "some-other-region" },
        },
        check
      )
    ).toBe(false)
  })

  it("accepts a place that matches attribution, id and parent", () => {
    expect(
      isOurs(
        "regions",
        {
          sourceAttribution: check.attribution,
          geonamesId: "123",
          country: { documentId: "country-1" },
        },
        { ...check, geonamesId: "123" }
      )
    ).toBe(true)
  })
})

describe("isResumable", () => {
  const attribution = "GeoNames (geonames.org), CC BY 4.0"

  it("is false for a parent with no existing children", () => {
    expect(isResumable([], attribution)).toBe(false)
  })

  it("is true only when every existing child carries this run's attribution", () => {
    expect(
      isResumable(
        [
          { sourceAttribution: attribution },
          { sourceAttribution: attribution },
        ],
        attribution
      )
    ).toBe(true)
  })

  it("is false when any existing child carries a different (or no) attribution — a fill never writes it", () => {
    expect(
      isResumable(
        [{ sourceAttribution: attribution }, { sourceAttribution: null }],
        attribution
      )
    ).toBe(false)
    expect(
      isResumable(
        [
          { sourceAttribution: attribution },
          { sourceAttribution: "a hand-made place a fill merely tagged" },
        ],
        attribution
      )
    ).toBe(false)
  })
})

describe("regionLabelChanges", () => {
  const boroughs = { area: "Borough", areas: "Boroughs" }

  it("sets a Region's own Area labels where they differ", () => {
    expect(regionLabelChanges({}, boroughs)).toEqual({
      areaTypeLabel: { from: null, to: "Borough" },
      areasSectionLabel: { from: null, to: "Boroughs" },
    })
    expect(
      regionLabelChanges(
        { areaTypeLabel: "Borough", areasSectionLabel: "Districts" },
        boroughs
      )
    ).toEqual({ areasSectionLabel: { from: "Districts", to: "Boroughs" } })
  })

  it("changes nothing when they already match", () => {
    expect(
      regionLabelChanges(
        { areaTypeLabel: "Borough", areasSectionLabel: "Boroughs" },
        boroughs
      )
    ).toEqual({})
  })
})

describe("labelChanges", () => {
  it("lists only the fields that differ from the profile", () => {
    const changes = labelChanges(
      {
        regionTypeLabel: "Region",
        regionsSectionLabel: "Regions",
        areaTypeLabel: null,
        areasSectionLabel: null,
      },
      profile({
        region: "Canton",
        regions: "Cantons",
        area: "District",
        areas: "Districts",
      })
    )
    expect(changes).toEqual({
      regionTypeLabel: { from: "Region", to: "Canton" },
      regionsSectionLabel: { from: "Regions", to: "Cantons" },
      areaTypeLabel: { from: null, to: "District" },
      areasSectionLabel: { from: null, to: "Districts" },
    })
  })

  it("is empty when the country already matches its profile", () => {
    expect(
      labelChanges(
        {
          regionTypeLabel: "Canton",
          regionsSectionLabel: "Cantons",
          areaTypeLabel: "District",
          areasSectionLabel: "Districts",
        },
        profile({
          region: "Canton",
          regions: "Cantons",
          area: "District",
          areas: "Districts",
        })
      )
    ).toEqual({})
  })

  it("leaves area fields alone when the profile is region-only (e.g. a country with no Areas)", () => {
    // `area` and `areas` are left out of the profile entirely (not merely
    // equal), so neither field should appear even though the country's
    // current values differ from nothing — only `regionTypeLabel`, which
    // the profile does set and which differs, should show up.
    expect(
      labelChanges(
        {
          regionTypeLabel: "Region",
          areaTypeLabel: "District",
          areasSectionLabel: "Districts",
        },
        profile({ region: "Canton", regions: "Cantons" })
      )
    ).toEqual({
      regionTypeLabel: { from: "Region", to: "Canton" },
      regionsSectionLabel: { from: null, to: "Cantons" },
    })
  })
})

describe("hasUnpublishedChanges", () => {
  it("fails closed when the published side has no timestamp", () => {
    expect(
      hasUnpublishedChanges(undefined, { updatedAt: "2026-10-01T00:00:00Z" })
    ).toBe(true)
    expect(
      hasUnpublishedChanges(
        { updatedAt: null },
        { updatedAt: "2026-10-01T00:00:00Z" }
      )
    ).toBe(true)
  })

  it("fails closed when the draft side has no timestamp", () => {
    expect(
      hasUnpublishedChanges({ updatedAt: "2026-10-01T00:00:00Z" }, undefined)
    ).toBe(true)
  })

  it("is false when the draft is the same age as (or older than) published", () => {
    expect(
      hasUnpublishedChanges(
        { updatedAt: "2026-10-01T00:00:00.000Z" },
        { updatedAt: "2026-10-01T00:00:00.000Z" }
      )
    ).toBe(false)
  })

  it("is true when the draft is more than a second newer than published", () => {
    expect(
      hasUnpublishedChanges(
        { updatedAt: "2026-10-01T00:00:00.000Z" },
        { updatedAt: "2026-10-01T00:00:02.000Z" }
      )
    ).toBe(true)
  })
})

describe("decideFill", () => {
  it("refuses a draft-only place (no published version at all)", () => {
    expect(
      decideFill({ updatedAt: "2026-10-01T00:00:00Z" }, undefined)
    ).toEqual({ write: false, reason: "draft only" })
    expect(decideFill({ updatedAt: "2026-10-01T00:00:00Z" }, null)).toEqual({
      write: false,
      reason: "draft only",
    })
  })

  it("refuses a place with pending draft edits", () => {
    expect(
      decideFill(
        { updatedAt: "2026-10-01T00:00:05.000Z" },
        { updatedAt: "2026-10-01T00:00:00.000Z" }
      )
    ).toEqual({ write: false, reason: "unpublished draft changes" })
  })

  it("refuses, failing closed, when a timestamp is missing on a published place", () => {
    expect(
      decideFill({ updatedAt: null }, { updatedAt: "2026-10-01T00:00:00Z" })
    ).toEqual({ write: false, reason: "unpublished draft changes" })
  })

  it("allows the write when the place has a published version with no pending draft edits", () => {
    expect(
      decideFill(
        { updatedAt: "2026-10-01T00:00:00.000Z" },
        { updatedAt: "2026-10-01T00:00:00.000Z" }
      )
    ).toEqual({ write: true })
  })
})

describe("wholeCountryRegion", () => {
  const country = { name: "Aruba", iso2: "AW" }
  const ours = { sourceAttribution: WHOLE_COUNTRY_REGION_ATTRIBUTION }

  it("is planned when the source has zero Regions and the Country has none yet", () => {
    expect(wholeCountryRegion(country, 0, [])).toEqual({
      sourceId: "country:AW",
      name: "Aruba",
      altNames: [],
      key: "*",
    })
  })

  it("is never planned when the source actually has Regions, even with no existing ones", () => {
    expect(wholeCountryRegion(country, 1, [])).toBeNull()
  })

  it("is never planned when the Country has any other Region — a different attribution, or none", () => {
    expect(
      wholeCountryRegion(country, 0, [
        { sourceAttribution: "GeoNames (geonames.org), CC BY 4.0" },
      ])
    ).toBeNull()
    expect(
      wholeCountryRegion(country, 0, [{ sourceAttribution: null }])
    ).toBeNull()
    expect(
      wholeCountryRegion(country, 0, [ours, { sourceAttribution: null }])
    ).toBeNull()
  })

  it("is planned again on a re-run, once every existing Region is this rule's own", () => {
    // After the first run created it, the Country's one existing Region
    // carries this rule's own attribution, and the source still has none —
    // so the same whole-country source is planned again (not null), which
    // `planChildren` then matches by name instead of creating a duplicate
    // (exercised below), rather than leaving it unmatched forever.
    expect(wholeCountryRegion(country, 0, [ours])).toEqual({
      sourceId: "country:AW",
      name: "Aruba",
      altNames: [],
      key: "*",
    })
  })

  it("planChildren matches the re-planned source against the Region it already created — matched, not created, not unmatched", () => {
    const source = wholeCountryRegion(country, 0, [ours])!
    const existingRegion = {
      documentId: "region-1",
      name: "Aruba",
      slug: "aruba",
      geonamesId: null,
      gssCode: null,
    }
    const plan = planChildren({
      sources: [source],
      existing: [existingRegion],
      fill: false,
    })
    expect(plan.actions).toEqual([
      { kind: "match", source, existing: existingRegion, fill: {} },
    ])
    expect(plan.unmatchedExisting).toEqual([])
  })
})

describe("needsDumpForNameMatching", () => {
  it("for a GeoNames source, is true for an existing place with no geonamesId, even if it carries a gssCode", () => {
    expect(
      needsDumpForNameMatching(
        [{ geonamesId: null, gssCode: "E06000001" }],
        "geonames"
      )
    ).toBe(true)
  })

  it("for a GeoNames source, is false once every existing place has a geonamesId", () => {
    expect(
      needsDumpForNameMatching(
        [{ geonamesId: "123", gssCode: null }, { geonamesId: "456" }],
        "geonames"
      )
    ).toBe(false)
  })

  it("for a curated source, counts a gssCode-only place as already id-matchable", () => {
    expect(
      needsDumpForNameMatching(
        [{ geonamesId: null, gssCode: "E06000001" }],
        "curated"
      )
    ).toBe(false)
  })

  it("for a curated source, is true when a place has neither id", () => {
    expect(
      needsDumpForNameMatching([{ geonamesId: null, gssCode: null }], "curated")
    ).toBe(true)
  })

  it("ignores a whole-country Region — it has no geonamesId by design, so it never forces a dump download", () => {
    expect(
      needsDumpForNameMatching(
        [
          {
            geonamesId: null,
            gssCode: null,
            sourceAttribution: WHOLE_COUNTRY_REGION_ATTRIBUTION,
          },
        ],
        "geonames"
      )
    ).toBe(false)
  })

  it("still counts a genuinely id-less place alongside an ignored whole-country Region", () => {
    expect(
      needsDumpForNameMatching(
        [
          {
            geonamesId: null,
            gssCode: null,
            sourceAttribution: WHOLE_COUNTRY_REGION_ATTRIBUTION,
          },
          { geonamesId: null, gssCode: null, sourceAttribution: null },
        ],
        "geonames"
      )
    ).toBe(true)
  })
})
