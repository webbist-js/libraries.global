import { describe, expect, it } from "vitest"

import type { SourcePlace } from "../../scripts/ingests/_shared/geography"
import {
  populationTotals,
  nordicObservation,
} from "../../scripts/ingests/nordics/geography"
import { mapWikidata } from "../../scripts/ingests/nordics/map"
import {
  libraryIdentifiersQuery,
  classifyMobileLibraries,
  bindings,
  dstQuery,
  type Binding,
  type NordicSource,
} from "../../scripts/ingests/nordics/source"

const area: SourcePlace = {
  key: "SE:area:0180",
  country: "SE",
  level: "area",
  parent: "SE:region:01",
  code: "0180",
  name: "Stockholm",
  names: ["Stockholm"],
  slug: "stockholm-se-0180",
  population: 100,
  method: "direct",
}
const field = (value: string) => ({ value })
const row: Binding = {
  library: field("http://www.wikidata.org/entity/Q123"),
  libraryLabel: field("Exempelbiblioteket"),
  areaCode: field("0180"),
  coord: field("Point(18.07 59.33)"),
  kind: field("http://www.wikidata.org/entity/Q28564"),
}
const data = {
  version: "2.0",
  class: "dataset",
  id: ["Region", "Sex", "Tid"],
  size: [2, 2, 1],
  dimension: {
    Region: { category: { index: { a: 0, b: 1 }, label: { a: "A", b: "B" } } },
    Sex: { category: { index: { women: 0, men: 1 } } },
    Tid: { category: { index: { "2026": 0 } } },
  },
  value: [10, 20, 30, 40],
}

describe("Nordic source validation", () => {
  it("sums disjoint population cells for each region and supports JSON-stat1", () => {
    const expected = { Region: null, Sex: ["men", "women"], Tid: ["2026"] }
    expect([...populationTotals(data, expected).totals]).toEqual([
      ["a", 30],
      ["b", 70],
    ])
    expect([
      ...populationTotals(
        {
          dataset: {
            ...data,
            dimension: { ...data.dimension, id: data.id, size: data.size },
          },
        },
        expected
      ).totals,
    ]).toEqual([
      ["a", 30],
      ["b", 70],
    ])
  })
  it("rejects suppressed cells, partial categories, duplicate indices and wrong years", () => {
    const expected = { Region: null, Sex: ["men", "women"], Tid: ["2026"] }
    expect(() =>
      populationTotals({ ...data, value: [10, null, 30, 40] }, expected)
    ).toThrow(/cell/)
    expect(() =>
      populationTotals({ ...data, value: [10, 20, 30] }, expected)
    ).toThrow(/Incomplete/)
    expect(() => populationTotals(data, { ...expected, Sex: ["men"] })).toThrow(
      /selection/
    )
    expect(() =>
      populationTotals(data, { ...expected, Tid: ["2025"] })
    ).toThrow(/selection/)
    expect(() =>
      populationTotals(
        {
          ...data,
          dimension: {
            ...data.dimension,
            Region: { category: { index: { a: 0, b: 0 } } },
          },
        },
        expected
      )
    ).toThrow(/indices/)
  })
  it("stores reference date, licence and disclosure-control coverage without labelling derived totals official", () => {
    const source = {
      country: "SE",
      populationRetrievedAt: "2026-10-11T15:00:00Z",
    } as NordicSource
    const observation = nordicObservation(
      { ...area, coverage: { disclosureControl: "SCB Cell Key Method (CKM)" } },
      source
    )
    expect(observation).toMatchObject({
      year: 2025,
      licence: "CC0 1.0",
      reportingCode: "0180",
      parentReportingCode: "01",
      coverage: {
        referenceDate: "2025-12-31",
        disclosureControl: "SCB Cell Key Method (CKM)",
      },
    })
  })
  it("requires a Danish total sex selector to exist in source metadata", () => {
    const metadata = {
      variables: [
        { id: "OMRÅDE", values: [{ id: "000" }] },
        { id: "KØN", values: [{ id: "1" }] },
        { id: "ALDER", values: [{ id: "IALT" }] },
        { id: "CIVILSTAND", values: [{ id: "TOT" }] },
        { id: "Tid", values: [{ id: "2026K1" }] },
      ],
    }
    expect(() => dstQuery(metadata)).toThrow(/selection/)
    expect(libraryIdentifiersQuery("NO")).toContain("wd:Q20")
  })
})

describe("Wikidata library mapping", () => {
  it("marks explicit bookmobile claims as Mobile without adding supplementary institutions", () => {
    const rows = classifyMobileLibraries(
      [row],
      [
        { library: field(row.library.value.replace("http:", "https:")) },
        { library: field("http://www.wikidata.org/entity/Q999") },
      ]
    )
    const result = mapWikidata(rows, "SE", [area])
    expect(result.sourceCount).toBe(1)
    expect(result.libraries[0].data.libraryType).toBe("Mobile")
    expect(result.libraries[0].warnings.join(" ")).toMatch(
      /not a verified stop/
    )
    expect(classifyMobileLibraries([row], [])).toEqual([row])
    expect(() => classifyMobileLibraries([row], [{}])).toThrow(/identifier/)
    expect(bindings({ results: { bindings: [] } }, true)).toEqual([])
    expect(() => bindings({ results: { bindings: [] } })).toThrow(/Empty/)
    expect(() => bindings({ results: {} }, true)).toThrow(/invalid/)
  })
  it("omits oversized URLs and addresses without truncating them into unusable data", () => {
    const result = mapWikidata(
      [
        {
          ...row,
          website: field(`https://library.example/${"x".repeat(260)}`),
          address: { value: "a".repeat(256), "xml:lang": "sv" },
        },
      ],
      "SE",
      [area]
    ).libraries[0]
    expect(result.data.website).toBeUndefined()
    expect(result.data.streetAddress).toBeUndefined()
    expect(result.warnings.join(" ")).toMatch(/field limit/)
    expect(
      mapWikidata([{ ...row, libraryLabel: field("a".repeat(256)) }], "SE", [
        area,
      ]).skipped[0].reason
    ).toMatch(/field limit/)
  })
  it("groups repeated SPARQL rows by Q identifier, preserves the name and leaves operation unknown", () => {
    const result = mapWikidata(
      [row, { ...row, kind: field("http://www.wikidata.org/entity/Q385994") }],
      "SE",
      [area]
    )
    expect(result.sourceCount).toBe(1)
    expect(result.libraries).toHaveLength(1)
    expect(result.libraries[0]).toMatchObject({
      recordId: "Q123",
      areaKey: area.key,
      countryKey: "SE",
      data: {
        name: "Exempelbiblioteket",
        slug: "exempelbiblioteket-se-q123",
        source: "wikidata",
        operationalStatus: "unknown",
        libraryType: "Public",
        location: { lat: 59.33, lng: 18.07 },
      },
    })
  })
  it("skips ambiguous current municipalities instead of assigning an arbitrary one", () => {
    const other = { ...area, key: "SE:area:0181", code: "0181" }
    const result = mapWikidata(
      [row, { ...row, areaCode: field("0181") }],
      "SE",
      [area, other]
    )
    expect(result.libraries).toHaveLength(0)
    expect(result.skipped[0].reason).toMatch(/Multiple current municipalities/)
  })
  it("does not treat historical codes or invalid coordinates as a current municipality", () => {
    const result = mapWikidata([{ ...row, areaCode: field("9999") }], "SE", [
      area,
    ])
    expect(result.libraries[0].areaKey).toBeUndefined()
    expect(result.libraries[0].warnings.join(" ")).toMatch(
      /country placement only/
    )
    expect(
      mapWikidata(
        [{ ...row, areaCode: field("9999"), coord: field("Point(0 0)") }],
        "SE",
        [area]
      ).skipped
    ).toHaveLength(1)
  })
  it("omits conflicting websites and map pins; keeps a verified municipality", () => {
    const first = {
      ...row,
      website: field("https://library.example"),
      address: { value: "Biblioteksgatan 1", "xml:lang": "sv" },
    }
    const second = {
      ...row,
      website: field("ftp://library.example"),
      coord: field("Point(18.09 59.34)"),
    }
    const result = mapWikidata([first, second], "SE", [area]).libraries[0]
    expect(result.data.location).toBeUndefined()
    expect(result.data.website).toBe("https://library.example/")
    expect(result.data.streetAddress).toBe("Biblioteksgatan 1")
  })
})
