import { describe, expect, it, vi } from "vitest"

import { matchDirectoryPlace } from "../../scripts/ingests/_shared/directory"
import { directoryPoint } from "../../scripts/ingests/_shared/directory-fields"
import { downloadQueensland } from "../../scripts/ingests/australia/libraries/ingest"
import {
  mapHistoricalAustralianLibrary,
  mapQueenslandLibrary,
  queenslandDirectoryUrl,
} from "../../scripts/ingests/australia/libraries/map"
import {
  czechCoordinates,
  mapCzechLibrary,
} from "../../scripts/ingests/czechia/nkp-cadr/map"
import { mapFrenchLibrary } from "../../scripts/ingests/france/culture/map"
import { withLibrarySources } from "../../scripts/library-source-data"
import { prepareMobileLibraryData } from "../../src/utils/mobile-timetable"

describe("directory mapping boundaries", () => {
  const french = {
    code_bib: "LI3873",
    nom_de_l_etablissement: "Médiathèque",
    code_region: "52",
    region: "Pays de la Loire",
    departement: "Vendée",
    type_adresse: "Bâtiment ouvert",
    statut: "Bibliothèque municipale",
    latitude: "46.769255",
    longitude: "-1.505685",
    amplitude_horaire: "16.5",
  }
  it("does not turn survey totals into hours or current opening status", () => {
    const mapped: any = mapFrenchLibrary(french)
    expect(mapped.data).toMatchObject({
      operationalStatus: "unknown",
      libraryType: "Public",
      location: { lat: 46.769255, lng: -1.505685 },
    })
    expect(mapped.data.openingTimes).toBeUndefined()
    expect(
      mapFrenchLibrary({
        ...french,
        type_adresse: "Lieu uniquement administratif",
      })
    ).toMatch(/visitor building/)
    expect(
      mapFrenchLibrary({ ...french, code_region: "01", region: "Guadeloupe" })
    ).toMatch(/Outside metropolitan/)
    expect(
      (mapFrenchLibrary({ ...french, type_adresse: "Bibliobus" }) as any).data
        .location
    ).toBeUndefined()
  })
  it("excludes unclear upstream licences and old Queensland records", () => {
    const row = {
      ID: "1",
      Library: "Library",
      State: "ACT",
      source_licence: "CC BY",
      latitude: "-35.2",
      longitude: "149.1",
    }
    expect((mapHistoricalAustralianLibrary(row) as any).regionName).toBe(
      "Australian Capital Territory"
    )
    expect(
      mapHistoricalAustralianLibrary({
        ...row,
        State: "NT",
        source_licence: 'public listing ("fair use")',
      })
    ).toMatch(/terms not established/)
    expect(
      mapHistoricalAustralianLibrary({
        ...row,
        State: "SA",
        source_licence: "no licence specified",
      })
    ).toMatch(/terms not established/)
    expect(mapHistoricalAustralianLibrary({ ...row, State: "QLD" })).toMatch(
      /Superseded/
    )
  })
  it("normalizes the known malformed Queensland URL but rejects unrelated hosts", () => {
    const url = "https://plconnect.slq.qld.gov.au/directory/council/branch"
    expect(
      queenslandDirectoryUrl("https://plconnect.slq.qld.gov.au" + url)
    ).toBe(url)
    expect(
      queenslandDirectoryUrl(
        "https://unrelated.example/directory/council/branch"
      )
    ).toBeUndefined()
    const row = { "Directory URL": url, "Branch Name": "Branch", _id: 1 }
    expect((mapQueenslandLibrary(row) as any).recordId).toBe("council/branch")
    expect((mapQueenslandLibrary({ ...row, _id: 99 }) as any).recordId).toBe(
      "council/branch"
    )
  })
  it("imports mobile services with a regional timezone without fabricating a visitor pin", async () => {
    const queensland: any = mapQueenslandLibrary({
      "Directory URL":
        "https://plconnect.slq.qld.gov.au/directory/council/mobile",
      "Branch Name": "Mobile library",
      "Branch Type": "Mobile",
      "Latitude (Decimal)": -27.47,
      "Longitude (Decimal)": 153.03,
    })
    const france: any = mapFrenchLibrary({
      ...french,
      type_adresse: "Bibliobus",
    })
    for (const [mapped, timezone] of [
      [queensland, "Australia/Brisbane"],
      [france, "Europe/Paris"],
    ] as const) {
      expect(mapped.data.location).toBeUndefined()
      expect(mapped.data.timezone).toBe(timezone)
      await expect(
        prepareMobileLibraryData({}, mapped.data, null, "en")
      ).resolves.toMatchObject({ libraryType: "Mobile", timezone })
    }
  })
  it("parses Czech DMS and decimal coordinates without accepting missing or impossible points", () => {
    expect(czechCoordinates("50°5'11.12\"N, 14°24'56.61\"E")?.lat).toBeCloseTo(
      50.086422,
      5
    )
    expect(czechCoordinates("49.4207944N, 14.6601603E")).toEqual({
      lat: 49.4207944,
      lng: 14.6601603,
    })
    expect(czechCoordinates("50°65'11\"N, 14°24'56\"E")).toBeUndefined()
    expect(directoryPoint(null, null, [-90, 90, -180, 180])).toBeUndefined()
  })
  it("excludes closed Czech institutions and preserves hierarchical unit names", () => {
    const row = {
      SGL: [{ a: "ABA001" }],
      NAZ: [{ a: "Library", b: "Faculty", c: "Reading room" }],
      KRJ: [{ a: "Hlavní město Praha", b: "Praha" }],
      TYP: [{ a: "VŠ" }],
      ADR: [{ u: "Street 1", g: "50.08N, 14.42E" }],
    }
    const mapped: any = mapCzechLibrary(row)
    expect(mapped).toMatchObject({
      regionName: "Prague",
      recordId: "ABA001",
      data: {
        name: "Library — Faculty — Reading room",
        libraryType: "University",
        operationalStatus: "unknown",
      },
    })
    expect(
      mapCzechLibrary({ ...row, STT: [{ a: "KNIHOVNA ZRUŠENA!" }] })
    ).toMatch(/Inactive/)
    expect(
      (mapCzechLibrary({ ...row, ADR: [...row.ADR, { u: "Street 2" }] }) as any)
        .data.location
    ).toBeUndefined()
  })
  it("refuses ambiguous place names and records exactly one origin source", () => {
    const places = [
      { id: 1, documentId: "a", name: "Okres Brno" },
      { id: 2, documentId: "b", name: "Brno" },
    ]
    expect(() => matchDirectoryPlace(places, "Brno")).toThrow(/Ambiguous/)
    const data = withLibrarySources({
      source: "nkp-cadr",
      sourceUrl: "https://example.test/ABA001",
      sourceRecords: [
        {
          dataset: "nkp-cadr",
          recordId: "ABA001",
          role: "origin" as const,
          url: "https://example.test/ABA001",
        },
      ],
    })
    expect(data.sourceRecords).toHaveLength(1)
    expect(data.source).toBeUndefined()
    expect(data.sourceUrl).toBeUndefined()
  })
})

describe("complete Queensland pagination", () => {
  it("reads to an empty page and rejects shifting totals and duplicate IDs", async () => {
    const download = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [{ _id: 1 }, { _id: 2 }] },
      })
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [] },
      })
    expect(await downloadQueensland(download)).toHaveLength(2)
    expect(download.mock.calls[1][0]).toContain("offset=100")
    const duplicate = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [{ _id: 1 }] },
      })
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [{ _id: 1 }] },
      })
    await expect(downloadQueensland(duplicate)).rejects.toThrow(/Duplicate/)
    const truncated = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [{ _id: 1 }] },
      })
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [] },
      })
    await expect(downloadQueensland(truncated)).rejects.toThrow(/Incomplete/)
    const shifting = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { total: 2, records: [{ _id: 1 }] },
      })
      .mockResolvedValueOnce({
        success: true,
        result: { total: 3, records: [] },
      })
    await expect(downloadQueensland(shifting)).rejects.toThrow(/changed/)
  })
})
