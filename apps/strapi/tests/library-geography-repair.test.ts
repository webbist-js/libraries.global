import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

const requireLocal = createRequire(import.meta.url)
const { matchArea } = requireLocal("../scripts/repair-library-geography.cjs")
const { verifyLibrary } = requireLocal("../scripts/publish-ready-libraries.cjs")
const gap = {
  name: "A library",
  country: { name: "Sweden", document_id: "se" },
}
const area = {
  document_id: "vadstena",
  name: "Vadstena",
  region_name: "Östergötlands län",
  country_id: "se",
  iso_2: "SE",
  estimates: [{ reportingCode: "0584" }],
}
const boundary = {
  id: 3600935553,
  tags: { name: "Vadstena kommun", admin_level: "7", "ref:scb": "0584" },
}
const country = { tags: { admin_level: "2", "ISO3166-1:alpha2": "SE" } }
const region = { tags: { name: "Östergötlands län", admin_level: "4" } }

describe("geography repair safeguards", () => {
  it("matches current codes and checks the containing county", () => {
    expect(matchArea(gap, [country, region, boundary], [area])).toEqual({
      area,
      method: "current municipality code",
      relationId: 935553,
    })
  })
  it("rejects overlapping matches instead of choosing an arbitrary municipality", () => {
    expect(() =>
      matchArea(
        gap,
        [country, region, boundary],
        [area, { ...area, document_id: "another" }]
      )
    ).toThrow(/Ambiguous/)
  })
  it("rejects coordinates across the country boundary", () => {
    expect(() =>
      matchArea(
        gap,
        [
          region,
          boundary,
          { tags: { admin_level: "2", "ISO3166-1:alpha2": "NO" } },
        ],
        [area]
      )
    ).toThrow(/outside the expected country/)
  })
  it("rejects a county that disagrees with the existing official hierarchy", () => {
    expect(() =>
      matchArea(
        gap,
        [
          country,
          boundary,
          { tags: { name: "Stockholms län", admin_level: "4" } },
        ],
        [area]
      )
    ).toThrow(/region disagrees/)
  })
  it("accepts an exact municipality name only when its county also agrees", () => {
    expect(
      matchArea(
        gap,
        [
          country,
          region,
          { ...boundary, tags: { name: "Vadstena kommun", admin_level: "7" } },
        ],
        [area]
      ).method
    ).toBe("exact municipality name")
  })
  it("uses the official reporting area for Christiansø without inventing a municipality", () => {
    const island = {
      name: "Christiansø",
      country_id: "dk",
      iso_2: "DK",
      region_name: "Hovedstaden",
      estimates: [
        {
          reportingCode: "411",
          parentReportingCode: "084",
          coverage: {
            administrativeStatus:
              "Christiansø is outside the 98 municipalities",
          },
        },
      ],
    }
    const library = {
      name: "Christiansø Bibliotek",
      country: { name: "Denmark", document_id: "dk" },
      sources: [{ record_id: "Q21106883" }],
      addresses: ["Christiansø"],
    }
    const dk = { tags: { admin_level: "2", "ISO3166-1:alpha2": "DK" } }
    const result = matchArea(library, [dk], [island])
    expect(result.area).toBe(island)
    expect(result.method).toBe("official unincorporated reporting area")
    expect(result.references[0].dataset).toBe("dst-population")
    expect(result.relationId).toBeUndefined()
    expect(() =>
      matchArea(library, [dk], [{ ...island, region_name: "Sjælland" }])
    ).toThrow()
    expect(() =>
      matchArea({ ...library, name: "Another library" }, [dk], [island])
    ).toThrow()
  })
})

describe("publication verification", () => {
  const facts = {
    document_id: "lib",
    locale: "en",
    entity_ref: "eu:se:county:lib",
    name: "Library",
    slug: "lib",
    created_at: "2026-10-04T12:00:00.000Z",
    sources: [
      {
        dataset: "wikidata",
        record_id: "Q123",
        url: "https://www.wikidata.org/wiki/Q123",
      },
    ],
    places: { region: { documentId: "county", slug: "county" } },
  }
  it("accepts a new physical version while preserving identity and dates", () => {
    expect(() =>
      verifyLibrary(facts, {
        ...facts,
        id: 999,
        created_at: new Date(facts.created_at),
      })
    ).not.toThrow()
  })
  it("rejects a changed original source identifier", () => {
    expect(() =>
      verifyLibrary(facts, {
        ...facts,
        sources: [{ ...facts.sources[0], record_id: "Q456" }],
      })
    ).toThrow(/sources changed/)
  })
  it("rejects a location link lost during publication", () => {
    expect(() => verifyLibrary(facts, { ...facts, places: {} })).toThrow(
      /places changed/
    )
  })
})
