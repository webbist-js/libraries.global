import { describe, expect, it } from "vitest"

import {
  ATLAS_EXPORT_COLUMNS,
  atlasExportRow,
  type Cell,
  csvChunks,
  EXPORT_ATTRIBUTION,
  EXPORT_CHUNK_ROWS,
  geoJsonChunks,
  type LibraryExportSource,
  MAX_EXPORT_IDS,
} from "../export-format"

const BOM = "\uFEFF"

/** The whole CSV: every chunk, concatenated. */
const toCsv = <C extends string>(
  rows: Partial<Record<C, Cell>>[],
  columns: C[]
) => [...csvChunks(rows, columns)].join("")

/** The whole GeoJSON text: every chunk, concatenated. */
const geoJsonText = (rows: Record<string, Cell>[]) =>
  [...geoJsonChunks(rows)].join("")

const toGeoJson = (rows: Record<string, Cell>[]) =>
  JSON.parse(geoJsonText(rows)) as {
    type: string
    attribution: string
    features: {
      type: string
      geometry: { type: string; coordinates: number[] }
      properties: Record<string, unknown>
    }[]
  }

/** The CSV's records, without the byte-order mark. */
const lines = (csv: string) =>
  csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter(Boolean)

function lib(p: Partial<LibraryExportSource> = {}): LibraryExportSource {
  return {
    name: "Loddon Library",
    slug: "loddon-library",
    libraryType: "Public",
    operationalStatus: "open",
    streetAddress: "Church Plain",
    city: "Loddon",
    region: "Norfolk",
    country: "England",
    lat: 52.53,
    lng: 1.48,
    website: "https://www.norfolk.gov.uk/libraries",
    phone: "01508 520 745",
    email: "loddon.lib@norfolk.gov.uk",
    continentSlug: "europe",
    countrySlug: "england",
    regionSlug: "norfolk",
    ...p,
  }
}

describe("csvChunks", () => {
  it("writes a byte-order mark, then a header row in the given column order", () => {
    expect(toCsv([{ b: "2", a: "1" }], ["b", "a"])).toBe(`${BOM}b,a\r\n2,1\r\n`)
  })

  it("starts with the UTF-8 byte-order mark, so Excel reads non-ASCII names", () => {
    const csv = toCsv([{ name: "Biblioteca Nacional de España" }], ["name"])

    expect(csv.codePointAt(0)).toBe(0xfe_ff)
    expect(csv.indexOf(BOM, 1)).toBe(-1)
    expect(new TextEncoder().encode(csv).slice(0, 3)).toEqual(
      new Uint8Array([0xef, 0xbb, 0xbf])
    )
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
      BOM +
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
    expect(toCsv([{ v: "\rcmd" }], ["v"])).toBe(`${BOM}v\r\n"'\rcmd"\r\n`)
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

  it("is just the byte-order mark and the header when there are no rows", () => {
    expect([...csvChunks([], ["a", "b"])]).toEqual([`${BOM}a,b\r\n`])
  })

  it("yields the header, then the rows in batches, with the same text as one string", () => {
    const n = 2 * EXPORT_CHUNK_ROWS + 1
    const rows = Array.from({ length: n }, (_, i) => ({ n: i, name: `L${i}` }))
    // Values that need quoting or escaping, either side of a batch edge.
    rows[EXPORT_CHUNK_ROWS - 1]!.name = 'The "Old", Library'
    rows[EXPORT_CHUNK_ROWS]!.name = "=cmd\nnext"

    const chunks = [...csvChunks(rows, ["n", "name"])]

    expect(chunks).toHaveLength(4)
    expect(chunks[0]).toBe(`${BOM}n,name\r\n`)
    // Rows per chunk, counted by their CRLFs (the quoted value's is a bare LF).
    expect(chunks.slice(1).map((c) => c.split("\r\n").length - 1)).toEqual([
      EXPORT_CHUNK_ROWS,
      EXPORT_CHUNK_ROWS,
      1,
    ])
    const expected = rows.map(({ n: i, name }) =>
      i === EXPORT_CHUNK_ROWS - 1
        ? `${i},"The ""Old"", Library"\r\n`
        : i === EXPORT_CHUNK_ROWS
          ? `${i},"'=cmd\nnext"\r\n`
          : `${i},${name}\r\n`
    )
    expect(chunks.join("")).toBe(`${BOM}n,name\r\n${expected.join("")}`)
  })

  it("reads rows only as its chunks are asked for", () => {
    let read = 0
    function* rows() {
      for (let i = 0; i < 10 * EXPORT_CHUNK_ROWS; i += 1) {
        read += 1
        yield { n: i }
      }
    }
    const chunks = csvChunks(rows(), ["n"])

    chunks.next()
    chunks.next()

    expect(read).toBe(EXPORT_CHUNK_ROWS)
  })
})

describe("geoJsonChunks", () => {
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

  it("has no byte-order mark", () => {
    expect(geoJsonText([{ name: "A", lat: 1, lng: 2 }])[0]).toBe("{")
  })

  it.each([0, 1, 2 * EXPORT_CHUNK_ROWS + 1])(
    "is valid JSON with %i features",
    (n) => {
      const rows = Array.from({ length: n }, (_, i) => ({
        name: `L${i}`,
        lat: i / 100,
        lng: -i / 100,
      }))

      const fc = toGeoJson(rows)

      expect(fc.type).toBe("FeatureCollection")
      expect(fc.features.map((f) => f.properties.name)).toEqual(
        rows.map((r) => r.name)
      )
    }
  )

  it("stays valid when rows are skipped at the start, the end and a batch edge", () => {
    const n = 2 * EXPORT_CHUNK_ROWS + 2
    const skipped = new Set([
      0,
      EXPORT_CHUNK_ROWS - 1,
      EXPORT_CHUNK_ROWS,
      n - 1,
    ])
    const rows = Array.from({ length: n }, (_, i) => ({
      name: `L${i}`,
      lat: skipped.has(i) ? null : 1,
      lng: 2,
    }))

    const fc = toGeoJson(rows)

    expect(fc.features.map((f) => f.properties.name)).toEqual(
      rows.filter((_, i) => !skipped.has(i)).map((r) => r.name)
    )
  })

  it("yields the opening, the features in batches, then the close, as one JSON text", () => {
    const rows = Array.from({ length: EXPORT_CHUNK_ROWS + 1 }, (_, i) => ({
      name: `L${i}`,
      city: null,
      lat: 51.5,
      lng: -0.12,
    }))

    const chunks = [...geoJsonChunks(rows)]

    expect(chunks[0]).toBe(
      `{"type":"FeatureCollection","attribution":${JSON.stringify(EXPORT_ATTRIBUTION)},"features":[`
    )
    expect(chunks.at(-1)).toBe("]}")
    expect(chunks).toHaveLength(4)
    expect(chunks.join("")).toBe(
      JSON.stringify({
        type: "FeatureCollection",
        attribution: EXPORT_ATTRIBUTION,
        features: rows.map(({ name, city, lat, lng }) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: { name, city },
        })),
      })
    )
  })
})

const pageUrl = (path: string) => `https://libraries.global${path}`

describe("atlasExportRow", () => {
  it("maps a Strapi export row onto the export columns", () => {
    expect(atlasExportRow(lib(), pageUrl)).toEqual({
      name: "Loddon Library",
      slug: "loddon-library",
      libraryType: "Public",
      operationalStatus: "open",
      streetAddress: "Church Plain",
      city: "Loddon",
      region: "Norfolk",
      country: "England",
      lat: 52.53,
      lng: 1.48,
      website: "https://www.norfolk.gov.uk/libraries",
      phone: "01508 520 745",
      email: "loddon.lib@norfolk.gov.uk",
      url: "https://libraries.global/europe/england/norfolk/loddon-library",
    })
  })

  it.each([
    ["slug", { slug: null }],
    ["continent slug", { continentSlug: null }],
    ["country slug", { countrySlug: null }],
    ["region slug", { regionSlug: null }],
  ])("leaves the url empty when the %s is missing", (_label, p) => {
    expect(atlasExportRow(lib(p), pageUrl).url).toBeNull()
  })

  it("fills every export column, in order", () => {
    expect(Object.keys(atlasExportRow(lib(), pageUrl))).toEqual([
      ...ATLAS_EXPORT_COLUMNS,
    ])
  })
})

describe("MAX_EXPORT_IDS", () => {
  it("caps one export request at the Team plan's row limit", () => {
    expect(MAX_EXPORT_IDS).toBe(50_000)
  })
})
