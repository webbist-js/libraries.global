import { describe, expect, it, vi } from "vitest"

vi.mock("../../scripts/ingests/_shared/directory", () => ({
  executeDirectoryIngest: vi.fn(),
}))
import { executeDirectoryIngest } from "../../scripts/ingests/_shared/directory"
import {
  EXPANSION_MAPPERS,
  runExpansion,
} from "../../scripts/ingests/_shared/expansion"
import { expansionCsv } from "../../scripts/ingests/_shared/expansion-contract"
import {
  EXPANSION_FEEDS,
  expansionWikidataQuery,
} from "../../scripts/ingests/_shared/expansion-feeds"
import {
  mapWikidata,
  nlbAttributes,
} from "../../scripts/ingests/_shared/expansion-map"
import {
  applyExpansionReview,
  reviewTemplate,
  validateCandidates,
} from "../../scripts/ingests/_shared/expansion-review"
import { DATASET_SEED } from "../../src/seeds/datasets"

const geo = (
  properties: object,
  lon: number,
  lat: number,
  id = "source.1"
) => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id,
      properties,
      geometry: { type: "Point", coordinates: [lon, lat] },
    },
  ],
})
const binding = (country: string) => ({
  library: { value: "http://www.wikidata.org/entity/Q123" },
  country: { value: `http://www.wikidata.org/entity/${country}` },
  libraryLabel: { value: "Example library" },
  kind: { value: "http://www.wikidata.org/entity/Q28564" },
  address: { value: "12 Main Street" },
  coord: { value: "Point(174 -41)" },
  website: { value: "https://example.org/" },
})
type SourceRow = Record<string, unknown>

const fixtures: Record<string, unknown> = {
  "lv-kisc-libraries": [
    {
      Nozare: "Bibliotēkas",
      "Objekta nosaukums": "Bibliotēka",
      "ISIL kods": "LV-BIB-123",
      Adrese: "Rīga",
      LAT: "56.95",
      LON: "24.1",
      "Objekta veids": "Publiskā bibliotēka >> Pašvaldību",
      "Objekta URL": "https://example.org/",
    },
  ],
  "tw-nlpi-libraries": [
    {
      縣市: "基隆市",
      圖書館資訊: [
        {
          Name: "基隆市公共圖書館",
          Address: "信一路181號",
          ZipCode: "20241",
          Longitude: 121.7442,
          Latitude: 25.1313,
          URL: "https://example.org/",
          Intro: "Do not import prose",
        },
      ],
    },
  ],
  "sg-nlb-libraries": geo(
    {
      Name: "kml_1",
      Description:
        "<table><tr><th>NAME</th><td>Example &amp; Library</td></tr><tr><th>ADDRESSSTREETNAME</th><td>Main Street</td></tr><tr><th>ADDRESSPOSTALCODE</th><td>012345</td></tr></table>",
    },
    103.8,
    1.3
  ),
  "be-fwb-libraries": [
    {
      denomination: "Bibliothèque",
      province: "Luxembourg",
      adresse: "12 Rue",
      cp: "6700",
      ville: "Arlon",
      categorie: "bibliothèque locale",
      geolocalisation: { lon: 5.8, lat: 49.7 },
    },
  ],
  "at-vienna-libraries": geo(
    {
      NAME: "Bücherei",
      ADRESSE: "12 Straße",
      WEBLINK1: "https://example.org/",
      BEZIRK: 1,
    },
    16.4,
    48.2,
    "BUECHEREIOGD.1"
  ),
  "at-graz-libraries": {
    spatialReference: { wkid: 4326 },
    features: [
      {
        attributes: {
          OBJEKT_ID: 1,
          NAME: "Bibliothek",
          STRASSENNAME: "Straße",
          HAUSNR: "1",
          PLZ: 8010,
          ORT: "Graz",
        },
        geometry: { x: 15.4, y: 47.1 },
      },
    ],
  },
  "br-snbp-cadastro": [
    {
      UF: "SÃO PAULO",
      "NOME MUNICIPIO": "SÃO PAULO",
      "NOME DA BIBLIOTECA": "BIBLIOTECA PÚBLICA",
      ENDEREÇO: "Rua 1",
      CEP: "01234567",
      "TIPO BIBLIOTECA": "PÚBLICA",
    },
  ],
  "nl-wikidata-libraries": { results: { bindings: [binding("Q55")] } },
  "nz-wikidata-libraries": { results: { bindings: [binding("Q664")] } },
  "ke-alva": [
    {
      OBJECTID: "12",
      "Name of Library / Nom": "Example library",
      "Country / Pays": "Kenya",
      "Street Address / Adresse": "P.O. Box 1",
      "Name of community or town / Nom": "Nairobi",
      "Type of library / Type": "Public",
      "Latitude / Latitude": "-1",
      "Longitude / Longitude": "36",
      "Email address of library contact /": "private@example.org",
    },
  ],
}

describe("separate expansion sources", () => {
  it.each(EXPANSION_FEEDS)(
    "maps $key without publishing or importing private/free text",
    (feed) => {
      const rows = EXPANSION_MAPPERS[feed.key](fixtures[feed.key])
      expect(rows).toHaveLength(1)
      validateCandidates(rows)
      expect(rows[0].data).not.toHaveProperty("email")
      expect(rows[0].data).not.toHaveProperty("summary")
      expect(rows[0].data).not.toHaveProperty("openingTimes")
      if (!feed.pins) expect(rows[0].point).toBeUndefined()
      expect(DATASET_SEED.filter((seed) => seed.key === feed.key)).toHaveLength(
        1
      )
    }
  )
  it("selects Latvian libraries without importing other cultural institutions", () => {
    const library = (fixtures["lv-kisc-libraries"] as SourceRow[])[0]
    expect(
      EXPANSION_MAPPERS["lv-kisc-libraries"]([
        library,
        { ...library, Nozare: "Muzeji" },
      ])
    ).toHaveLength(1)
    expect(() =>
      validateCandidates(
        EXPANSION_MAPPERS["lv-kisc-libraries"]([library, library])
      )
    ).toThrow("Duplicate")
  })
  it("requires the Taiwan county envelope and never treats a county as a branch", () => {
    expect(() =>
      EXPANSION_MAPPERS["tw-nlpi-libraries"]([{ Name: "Library" }])
    ).toThrow("縣市")
    expect(
      EXPANSION_MAPPERS["tw-nlpi-libraries"](fixtures["tw-nlpi-libraries"])[0]
        .regionHint
    ).toBe("基隆市")
  })
  it("rejects truncated or non-WGS84 exports and paginated Belgium responses", () => {
    expect(() =>
      EXPANSION_MAPPERS["be-fwb-libraries"]({
        total_count: 416,
        results: fixtures["be-fwb-libraries"],
      })
    ).toThrow("complete source array")
    expect(() =>
      EXPANSION_MAPPERS["at-vienna-libraries"]({
        ...(fixtures["at-vienna-libraries"] as object),
        numberMatched: 37,
      })
    ).toThrow("Incomplete")
    expect(() =>
      EXPANSION_MAPPERS["at-graz-libraries"]({
        ...(fixtures["at-graz-libraries"] as object),
        exceededTransferLimit: true,
      })
    ).toThrow("Incomplete")
    expect(() =>
      EXPANSION_MAPPERS["at-graz-libraries"]({
        ...(fixtures["at-graz-libraries"] as object),
        spatialReference: { wkid: 31256 },
      })
    ).toThrow("4326")
  })
  it("decodes NLB table values without confusing the GeoJSON identifier for the name", () => {
    const row = EXPANSION_MAPPERS["sg-nlb-libraries"](
      fixtures["sg-nlb-libraries"]
    )[0]
    expect(row.name).toBe("Example & Library")
    expect(row.data.postalCode).toBe("012345")
    expect(() => nlbAttributes("<script>evil()</script>")).toThrow(
      "Missing source column"
    )
  })
  it("keeps same-name branches at different addresses distinct; ignores transient Graz OIDs", () => {
    const raw = structuredClone(fixtures["at-graz-libraries"]) as {
      features: { attributes: SourceRow }[]
    }
    const first = EXPANSION_MAPPERS["at-graz-libraries"](raw)[0]
    raw.features[0].attributes.OBJEKT_ID = 999
    expect(EXPANSION_MAPPERS["at-graz-libraries"](raw)[0].recordId).toBe(
      first.recordId
    )
    raw.features[0].attributes.HAUSNR = "2"
    expect(EXPANSION_MAPPERS["at-graz-libraries"](raw)[0].recordId).not.toBe(
      first.recordId
    )
  })
  it("groups Wikidata cross-product rows, withholds ambiguous facts and rejects the other country", () => {
    const a = binding("Q55"),
      b = { ...a, address: { value: "Other address" } }
    const rows = mapWikidata({ results: { bindings: [a, b, a] } }, "Q55")
    expect(rows).toHaveLength(1)
    expect(rows[0].data.streetAddress).toBeUndefined()
    expect(rows[0].point).toBeUndefined()
    expect(() => mapWikidata(fixtures["nz-wikidata-libraries"], "Q55")).toThrow(
      "another country"
    )
    expect(expansionWikidataQuery("NZ")).toContain("wd:Q664")
    expect(expansionWikidataQuery("NL")).not.toContain("LIMIT")
  })
  it("filters other ALVA countries and omits personal contacts, PO boxes and coordinates", () => {
    const kenya = (fixtures["ke-alva"] as SourceRow[])[0]
    const rows = EXPANSION_MAPPERS["ke-alva"]([
      kenya,
      { ...kenya, "Country / Pays": "Ghana" },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].data.streetAddress).toBeUndefined()
    expect(JSON.stringify(rows)).not.toContain("private@example.org")
    expect(rows[0].point).toBeUndefined()
  })
  it("fails malformed CSV instead of silently dropping a truncated row", () => {
    expect(expansionCsv('\uFEFFid,name\r\n1,"a,b"\r\n2,"line\nbreak"')).toEqual(
      [
        { id: "1", name: "a,b" },
        { id: "2", name: "line\nbreak" },
      ]
    )
    for (const csv of [
      'id,name\n1,"unfinished',
      "id,id\n1,2",
      "id,name\n1,2,3",
    ])
      expect(() => expansionCsv(csv)).toThrow()
  })
})

describe("source-bound review gate", () => {
  const feed = EXPANSION_FEEDS[0]
  const rows = EXPANSION_MAPPERS[feed.key](fixtures[feed.key])
  const date = "2026-11-07T10:00:00Z"
  const approved = () => {
    const review = reviewTemplate(feed, rows, "checksum", date)
    review.completenessEvidence =
      "Full publisher export, count checked against catalogue"
    review.licenceEvidence =
      "https://data.gov.lv/dati/dataset/latvijas-kulturas-institucijas"
    review.reconciledAgainstCms = true
    review.records[rows[0].recordId] = {
      action: "import",
      regionName: "Riga",
      libraryType: "Public",
    }

    return review
  }
  it("defaults every candidate to review and refuses unchecked decisions", () => {
    const review = reviewTemplate(feed, rows, "checksum", date)
    expect(review.records[rows[0].recordId].action).toBe("review")
    expect(() =>
      applyExpansionReview(feed, rows, review, "checksum", date)
    ).toThrow()
    const a = approved()
    a.reconciledAgainstCms = false
    expect(() => applyExpansionReview(feed, rows, a, "checksum", date)).toThrow(
      "Reconcile"
    )
  })
  it("rejects changed source, country, date, record set or count", () => {
    for (const patch of [
      { sha256: "changed" },
      { dataset: "ke-alva" },
      { retrievedAt: "other" },
      { records: {} },
      { expectedCandidates: 2 },
    ])
      expect(() =>
        applyExpansionReview(
          feed,
          rows,
          { ...approved(), ...patch },
          "checksum",
          date
        )
      ).toThrow()
  })
  it("uses only reviewed geography and explicit point evidence; retains unknown operation", () => {
    const review = approved()
    const mapped = applyExpansionReview(feed, rows, review, "checksum", date)
    expect(mapped.libraries[0].regionName).toBe("Riga")
    expect(mapped.libraries[0].data.operationalStatus).toBe("unknown")
    expect(mapped.libraries[0].data.location).toBeUndefined()
    review.records[rows[0].recordId].coordinateEvidence =
      "https://example.org/source-provenance"
    expect(
      applyExpansionReview(feed, rows, review, "checksum", date).libraries[0]
        .data.location
    ).toEqual({ lat: 56.95, lng: 24.1 })
    expect(() =>
      applyExpansionReview(
        { ...feed, pins: false },
        rows,
        review,
        "checksum",
        date
      )
    ).toThrow("coordinates")
  })
  it("records exclusion reasons and never turns exclusions into writes", () => {
    const review = approved()
    review.records[rows[0].recordId] = {
      action: "skip",
      reason: "Existing curated library; preserve it",
    }
    const result = applyExpansionReview(feed, rows, review, "checksum", date)
    expect(result.libraries).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
  })
  it("rejects CMS requests before reading source files without a completed review", async () => {
    const oldUrl = process.env.STRAPI_URL,
      oldDb = process.env.DATABASE_URL,
      oldHost = process.env.DATABASE_HOST
    process.env.STRAPI_URL = "http://127.0.0.1:1337"
    delete process.env.DATABASE_URL
    process.env.DATABASE_HOST = "127.0.0.1"
    try {
      await expect(
        runExpansion({
          dataset: feed.key,
          apply: "true",
          local: "true",
          file: "/does-not-exist",
          "retrieved-at": "2020-01-01T00:00:00Z",
        })
      ).rejects.toThrow("CMS access requires")
      expect(executeDirectoryIngest).not.toHaveBeenCalled()
    } finally {
      for (const [key, value] of Object.entries({
        STRAPI_URL: oldUrl,
        DATABASE_URL: oldDb,
        DATABASE_HOST: oldHost,
      }))
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
  })
})
