import { describe, expect, it } from "vitest"

import type { AtlasLibrary } from "@/components/atlas/atlas.logic"

import {
  ATLAS_EXPORT_COLUMNS,
  atlasExportRow,
  EXPORT_ATTRIBUTION,
  toCsv,
  toGeoJson,
} from "../export-format"

const lines = (csv: string) => csv.split("\r\n").filter(Boolean)

function lib(p: Partial<AtlasLibrary> = {}): AtlasLibrary {
  return {
    id: "doc1",
    name: "Loddon Library",
    slug: "loddon-library",
    type: "Public",
    status: "open",
    operator: "Municipality",
    city: "Loddon",
    country: "England",
    region: "Norfolk",
    path: "/europe/england/norfolk/loddon-library",
    tz: "Europe/London",
    hours: null,
    founded: null,
    closed: null,
    events: false,
    catalogue: false,
    access: [],
    services: [],
    complete: 50,
    lat: 52.53,
    lng: 1.48,
    ...p,
  }
}

describe("toCsv", () => {
  it("writes a header row in the given column order", () => {
    const csv = toCsv([{ b: "2", a: "1" }], ["b", "a"])

    expect(lines(csv)).toEqual(["b,a", "2,1"])
  })

  it("quotes fields with commas, quotes or newlines and doubles quotes", () => {
    const csv = toCsv(
      [
        { v: "Leeds, Central" },
        { v: 'The "Old" Library' },
        { v: "line one\nline two" },
        { v: "carriage\rreturn" },
      ],
      ["v"]
    )

    expect(csv).toBe(
      [
        "v",
        '"Leeds, Central"',
        '"The ""Old"" Library"',
        '"line one\nline two"',
        '"carriage\rreturn"',
        "",
      ].join("\r\n")
    )
  })

  it.each([
    ["=HYPERLINK(1)", "'=HYPERLINK(1)"],
    ["+44 20 7412 7332", "'+44 20 7412 7332"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tTabbed", "'\tTabbed"],
  ])("prefixes a quote to %j so it can't run as a formula", (value, safe) => {
    expect(lines(toCsv([{ v: value }], ["v"]))[1]).toBe(safe)
  })

  it("quotes an escaped cell that still needs quoting", () => {
    expect(lines(toCsv([{ v: '=HYPERLINK("x")' }], ["v"]))[1]).toBe(
      `"'=HYPERLINK(""x"")"`
    )
    expect(toCsv([{ v: "\rcmd" }], ["v"])).toBe('v\r\n"\'\rcmd"\r\n')
  })

  it("writes numbers as numbers, so negative coordinates stay numeric", () => {
    expect(lines(toCsv([{ lat: 51.5, lng: -0.1278 }], ["lat", "lng"]))).toEqual(
      ["lat,lng", "51.5,-0.1278"]
    )
  })

  it("writes null, undefined and missing values as empty cells", () => {
    const csv = toCsv([{ a: null, b: undefined }], ["a", "b", "c"])

    expect(lines(csv)).toEqual(["a,b,c", ",,"])
  })
})

describe("toGeoJson", () => {
  it("returns a FeatureCollection of [lng, lat] points with attribution", () => {
    const fc = toGeoJson([
      { name: "A", lat: 51.5, lng: -0.12 },
      { name: "B", lat: 55.95, lng: -3.19 },
    ])

    expect(fc.type).toBe("FeatureCollection")
    expect(fc.attribution).toBe(EXPORT_ATTRIBUTION)
    expect(fc.features).toEqual([
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-0.12, 51.5] },
        properties: { name: "A" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-3.19, 55.95] },
        properties: { name: "B" },
      },
    ])
  })

  it("skips rows without coordinates", () => {
    const fc = toGeoJson([
      { name: "No lat", lat: null, lng: 1 },
      { name: "No lng", lat: 1 },
      { name: "Not a number", lat: "51", lng: "0" },
      { name: "Kept", lat: 0, lng: 0 },
    ])

    expect(fc.features.map((f) => f.properties.name)).toEqual(["Kept"])
  })

  it("keeps missing properties as null rather than dropping them", () => {
    const fc = toGeoJson([{ name: "A", city: undefined, lat: 1, lng: 2 }])

    expect(fc.features[0]?.properties).toEqual({ name: "A", city: null })
  })
})

const pageUrl = (path: string) => `https://libraries.global${path}`

describe("atlasExportRow", () => {
  it("maps an Atlas library onto the export columns", () => {
    expect(atlasExportRow(lib(), pageUrl)).toEqual({
      name: "Loddon Library",
      slug: "loddon-library",
      libraryType: "Public",
      operationalStatus: "open",
      city: "Loddon",
      region: "Norfolk",
      country: "England",
      lat: 52.53,
      lng: 1.48,
      url: "https://libraries.global/europe/england/norfolk/loddon-library",
    })
  })

  it("leaves the url empty when the library has no page path", () => {
    expect(atlasExportRow(lib({ path: null }), pageUrl).url).toBeNull()
  })

  it("fills every export column, in order", () => {
    expect(Object.keys(atlasExportRow(lib(), pageUrl))).toEqual([
      ...ATLAS_EXPORT_COLUMNS,
    ])
  })
})
