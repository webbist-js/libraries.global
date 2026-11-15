import { describe, expect, it, vi } from "vitest"

import {
  isilSlug,
  reconcileCuratedLibraries,
} from "../../scripts/ingests/_shared/isil-registry"
import {
  parseJapanDeleted,
  parseJapanList,
  validateJapanSource,
} from "../../scripts/ingests/japan/ndl-isil/ingest"
import {
  japanLibraryType,
  mapJapaneseLibrary,
  type JapanRow,
} from "../../scripts/ingests/japan/ndl-isil/map"
import { parseSwissCsv } from "../../scripts/ingests/switzerland/isil/ingest"
import {
  mapSwissLibrary,
  swissLibraryType,
} from "../../scripts/ingests/switzerland/isil/map"
import { DATASET_SEED } from "../../src/seeds/datasets"

const cms = vi.hoisted(() => ({ libraries: [] as Record<string, unknown>[] }))

vi.mock("../../scripts/strapi-client", () => ({
  StrapiClient: class {
    async findAll() {
      return cms.libraries
    }
  },
}))

/** Narrow a mapper result to the mapped Library. */
function library<T>(result: T | string): T {
  if (typeof result === "string") throw new Error(result)

  return result
}

const type = (name: string, list: "public" | "other" = "other") =>
  japanLibraryType({ name, english: "", list })

const swiss = {
  ISIL: "CH-000123-4",
  Status: "aktiv",
  "Name-Original": "Stadtbibliothek Biel / Bibliothèque de la Ville de Bienne",
  Institutionstyp: "Bibliothek",
  Institutionskategorie: "Öffentliche und gemischte Bibliothek",
  Strasse: "Dufourstrasse 26",
  Postleitzahl: "2502",
  Ortschaft: "Biel/Bienne",
  Kanton: "Bern",
  Land: "CH",
  Webseite: "https://www.bibliobiel.ch",
}

const japanese: JapanRow = {
  recordId: "JP-1000123",
  name: "札幌市中央図書館",
  english: "Sapporo Municipal Central Library",
  kana: "サッポロシチュウオウトショカン",
  postal: "064-8516",
  pref: "北海道",
  city: "札幌市中央区",
  street: "南22条西13-1-1",
  phone: "011-512-7320",
  fax: "",
  url: "https://www.city.sapporo.jp/toshokan/",
  list: "public",
}

describe("Swiss ISIL Directory", () => {
  it("imports only active Swiss records classified as libraries", () => {
    expect(mapSwissLibrary({ ...swiss, Land: "LI" })).toBe(
      "Outside Switzerland"
    )
    expect(mapSwissLibrary({ ...swiss, Status: "inaktiv" })).toBe(
      "Inactive institution"
    )
    expect(mapSwissLibrary({ ...swiss, Institutionstyp: "Archiv" })).toBe(
      "Not explicitly classified as a library"
    )
    expect(
      typeof mapSwissLibrary({ ...swiss, Institutionstyp: "Archiv|Bibliothek" })
    ).toBe("object")
    expect(mapSwissLibrary({ ...swiss, Kanton: "" })).toMatch(
      /Unresolved canton/
    )
  })

  it("keeps source text, the ISIL slug and the canton crosswalk", () => {
    const mapped = library(mapSwissLibrary({ ...swiss, Kanton: "Waadt" }))
    expect(mapped).toMatchObject({
      recordId: "CH-000123-4",
      countryCode: "CH",
      regionName: "Vaud",
      regionAliases: ["Waadt"],
    })
    expect(mapped.data).toEqual({
      name: swiss["Name-Original"],
      slug: "stadtbibliothek-biel-bibliotheque-de-la-ville-de-bienne-ch-000123-4",
      libraryType: "Public",
      operationalStatus: "unknown",
      sourceUrl: "https://www.isil.nb.admin.ch/opendata/latest.csv",
      streetAddress: "Dufourstrasse 26",
      city: "Biel/Bienne",
      postalCode: "2502",
      website: "https://www.bibliobiel.ch",
    })
    expect(mapped.data.location).toBeUndefined()
    expect(
      library(mapSwissLibrary({ ...swiss, Webseite: "www.bibliobiel.ch" })).data
        .website
    ).toBeUndefined()
  })

  it("maps categories in priority order", () => {
    expect(swissLibraryType("Nationalbibliothek|Spezialbibliothek")).toBe(
      "National"
    )
    expect(
      swissLibraryType(
        "Öffentliche und gemischte Bibliothek|Hochschul- und Forschungsbibliothek"
      )
    ).toBe("Academic")
    expect(swissLibraryType("Kantonsbibliothek")).toBe("Public")
    expect(swissLibraryType("Spezialbibliothek")).toBe("Special")
    expect(swissLibraryType("")).toBe("Other")
  })

  it("keeps only mapped columns and accepts quoted multi-line fields", () => {
    const csv = [
      "ISIL,Status,Name-Original,Institutionstyp,Institutionskategorie,Strasse,Postleitzahl,Ortschaft,Kanton,Land,Webseite,E-Mail,Verwaltungsgeschichte",
      'CH-000123-4,aktiv,Bibliothek,Bibliothek,Spezialbibliothek,Weg 1,3000,Bern,Bern,CH,,person@example.test,"Line one\nLine two"',
    ].join("\n")
    const snapshot = parseSwissCsv(Buffer.from(csv))
    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.rows[0]).not.toHaveProperty("E-Mail")
    expect(snapshot.rows[0]).not.toHaveProperty("Verwaltungsgeschichte")
    expect(snapshot.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(() => parseSwissCsv(Buffer.from("ISIL,Status\nCH-1,aktiv"))).toThrow(
      /schema changed/
    )
  })
})

describe("Japanese NDL ISIL registry", () => {
  it("maps names, readings, contacts and the prefecture without an Area", () => {
    const mapped = library(mapJapaneseLibrary(japanese))
    expect(mapped).toMatchObject({
      recordId: "JP-1000123",
      countryCode: "JP",
      regionName: "Hokkaido",
    })
    expect(mapped.areaName).toBeUndefined()
    expect(mapped.data).toEqual({
      name: "札幌市中央図書館",
      slug: "sapporo-municipal-central-library-jp-1000123",
      libraryType: "Public",
      operationalStatus: "unknown",
      sourceUrl:
        "https://www.ndl.go.jp/file/library/isil/isil_libraries_public_20261102_J.csv",
      city: "札幌市中央区",
      streetAddress: "南22条西13-1-1",
      postalCode: "064-8516",
      website: "https://www.city.sapporo.jp/toshokan/",
      phone: "011-512-7320",
      alternateNames: [
        "サッポロシチュウオウトショカン",
        "Sapporo Municipal Central Library",
      ],
    })
  })

  it("holds unplaceable records and omits malformed contact facts", () => {
    expect(mapJapaneseLibrary({ ...japanese, city: "" })).toBe(
      "No usable prefecture and municipality"
    )
    const mapped = library(
      mapJapaneseLibrary({
        ...japanese,
        english: "SAPPOROSHICHUOTOSHOKAN",
        postal: "0648516",
        phone: "011-512-7320 内線2",
        url: "www.city.sapporo.jp",
        list: "other",
      })
    )
    expect(mapped.data.alternateNames).toEqual([japanese.kana])
    expect(mapped.data.postalCode).toBeUndefined()
    expect(mapped.data.phone).toBeUndefined()
    expect(mapped.data.website).toBeUndefined()
    expect(mapped.data.sourceUrl).toMatch(/isil_libraries_20261102_J\.csv$/)
    expect(
      library(mapJapaneseLibrary({ ...japanese, english: "" })).data.slug
    ).toBe("library-jp-1000123")
  })

  it("infers types conservatively from list and name", () => {
    expect(type("国立国会図書館関西館")).toBe("National")
    expect(type("国立国会図書館支部農林水産省図書館")).toBe("Special")
    expect(type("北海道立図書館", "public")).toBe("Regional")
    expect(type("小樽市立図書館", "public")).toBe("Public")
    expect(type("北海道議会図書室")).toBe("Parliamentary")
    expect(type("日本点字図書館")).toBe("Specific User Groups")
    expect(type("北海道大学附属図書館")).toBe("University")
    expect(type("国立高等専門学校図書館")).toBe("Academic")
    expect(type("国立がん研究センター図書館")).toBe("Special")
    expect(type("まちの図書室")).toBe("Other")
  })

  it("reads both lists by checked column position and rejects deleted ISILs", () => {
    const header =
      '"ISIL","機関名Institution name in Japanese","Institution name in English","機関名ヨミInstitution name in Japanese (kana form)","Postal code","都道府県Prefecture","City/Ward/Town/Village","Address (Street Level)","Telephone number","代表FAX番号Fax number","URL","旧ISIL Former ISIL","登録日","更新日"'
    const list = parseJapanList(
      Buffer.from(
        `\uFEFF${header}\n"JP-1000123","図書館","Library","トショカン","064-8516","北海道","札幌市","南1","","","","","",""`
      ),
      "other"
    )
    expect(list.rows[0]).toMatchObject({
      recordId: "JP-1000123",
      city: "札幌市",
      street: "南1",
      list: "other",
    })
    expect(() =>
      parseJapanList(Buffer.from('"ISIL","URL"\n"JP-1","x"'), "public")
    ).toThrow(/list changed/)
    const deleted = parseJapanDeleted(
      Buffer.from(
        '"ISIL","機関名Institution name in Japanese"\n"JP-1000123","x"'
      )
    )
    const rows = Array.from({ length: 6000 }, (_, i) => ({
      ...japanese,
      recordId: `JP-${2000000 + i}`,
    }))
    expect(() => validateJapanSource(rows, deleted.rows)).not.toThrow()
    rows[0]!.recordId = "JP-1000123"
    expect(() => validateJapanSource(rows, deleted.rows)).toThrow(/Deleted/)
  })
})

describe("ISIL registry identities", () => {
  it("reproduces the published slug rule", () => {
    expect(isilSlug("Zentralbibliothek Zürich", "CH-000008-6")).toBe(
      "zentralbibliothek-zurich-ch-000008-6"
    )
    expect(isilSlug(`${"a".repeat(159)} b`, "JP-1000001")).toBe(
      `${"a".repeat(159)}-jp-1000001`
    )
  })

  it("registers both Datasets with redistribution permitted", () => {
    for (const key of ["ch-isil", "jp-ndl-isil"])
      expect(DATASET_SEED.find((seed) => seed.key === key)).toMatchObject({
        licenceStatus: "stated_by_publisher",
        redistribution: "permitted",
      })
  })

  it("links curated Libraries by slug and evidence, never creating duplicates", async () => {
    const rows = () => [library(mapSwissLibrary(swiss))]
    const curated = [
      {
        recordId: swiss.ISIL,
        slug: "stadtbibliothek-biel",
        evidence: "registry street address",
        matches: (found: Record<string, unknown>) =>
          found.streetAddress === swiss.Strasse,
      },
    ]
    const dryRun = rows()
    expect(
      (await reconcileCuratedLibraries({}, dryRun, [], curated)).size
    ).toBe(0)
    expect(dryRun[0]!.warnings[0]).toMatch(/curated library/)

    cms.libraries = [
      {
        documentId: "curated",
        slug: "stadtbibliothek-biel",
        streetAddress: swiss.Strasse,
      },
    ]
    const linked = await reconcileCuratedLibraries(
      { "check-cms": "true" },
      rows(),
      [],
      curated
    )
    expect([...linked]).toEqual([[swiss.ISIL, "curated"]])

    cms.libraries = [{ documentId: "curated", slug: "stadtbibliothek-biel" }]
    const libraries = rows()
    const skipped: Parameters<typeof reconcileCuratedLibraries>[2] = []
    await reconcileCuratedLibraries(
      { "check-cms": "true" },
      libraries,
      skipped,
      curated
    )
    expect(libraries).toHaveLength(0)
    expect(skipped[0]!.reason).toMatch(/no longer matches/)
  })
})
