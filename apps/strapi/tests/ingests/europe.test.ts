import { afterEach, describe, expect, it, vi } from "vitest"

import {
  directorySourceRecords,
  matchDirectoryPlace,
} from "../../scripts/ingests/_shared/directory"
import { assertIngestTarget } from "../../scripts/ingests/_shared/target"
import { IRISH_FEEDS } from "../../scripts/ingests/ireland/councils/feeds"
import {
  ambiguousIrishNames,
  mapIrishLibrary,
} from "../../scripts/ingests/ireland/councils/map"
import {
  validateIrishCatalogue,
  validateIrishFeatures,
} from "../../scripts/ingests/ireland/councils/source"
import { validateItalianSnapshot } from "../../scripts/ingests/italy/iccu/ingest"
import { mapItalianLibrary } from "../../scripts/ingests/italy/iccu/map"
import { italianProvinceAliases } from "../../scripts/ingests/italy/iccu/provinces"
import { validateItalianPopulation } from "../../scripts/ingests/italy/population"
import { DATASET_SEED } from "../../src/seeds/datasets"

const italian = (overrides = {}) => ({
  "codici-identificativi": { isil: "IT-RM0001" },
  denominazioni: { ufficiale: "Biblioteca di prova" },
  indirizzo: {
    regione: "LAZIO",
    provincia: { nome: "Roma" },
    comune: { nome: "Roma" },
    coordinate: [41.9, 12.5],
    cap: "00100",
  },
  "tipologia-funzionale": "Pubblica",
  "stato-registrazione": null,
  ...overrides,
})

describe("Italian source mapping", () => {
  it.each([
    ["Chieti", "Provincia di Chieti"],
    ["Roma", "Città metropolitana di Roma Capitale"],
    ["Firenze", "Province of Florence"],
    ["L'Aquila", "Provincia dell' Aquila"],
    ["Bolzano/Bozen", "Bolzano"],
    ["Reggio nell'Emilia", "Provincia di Reggio Emilia"],
    ["Valle d'Aosta/Vallée d'Aoste", "Valle d'Aosta"],
  ])("matches reviewed province labels %s → %s", (name, stored) => {
    const area = { id: 1, documentId: "area", name: stored }
    expect(
      matchDirectoryPlace([area], name, italianProvinceAliases(name))
    ).toBe(area)
    expect(() =>
      matchDirectoryPlace(
        [area, { ...area, documentId: "other", name }],
        name,
        italianProvinceAliases(name)
      )
    ).toThrow("Ambiguous")
  })
  it("keeps long-name slugs queryable while preserving ISIL", () => {
    const row = mapItalianLibrary(
      italian({ denominazioni: { ufficiale: "Biblioteca ".repeat(22) } })
    )
    expect(typeof row).not.toBe("string")
    if (typeof row === "string") return
    expect(row.data.slug.length).toBeLessThanOrEqual(200)
    expect(row.data.slug).toMatch(/-it-rm0001$/)
  })
  it("preserves ISIL, latitude order and unknown operation without copying personal contacts", () => {
    const row = mapItalianLibrary(
      italian({
        contatti: [{ tipo: "E-mail", valore: "person@example.org" }],
        accesso: { riservato: true, "portatori-handicap": "Accessibile" },
      })
    )
    expect(row).toMatchObject({
      recordId: "IT-RM0001",
      countryCode: "IT",
      regionName: "Lazio",
      data: {
        location: { lat: 41.9, lng: 12.5 },
        operationalStatus: "unknown",
        postalCode: "00100",
      },
    })
    if (typeof row === "string") throw new Error(row)
    expect(row.data).not.toHaveProperty("email")
    expect(row.data).not.toHaveProperty("accessibility")
  })
  it.each([
    "Biblioteca confluita in IT-RM0002",
    "Biblioteca non più esistente",
    "Temporaneamente chiusa",
    "Deposito librario senza punto di servizio",
    "Biblioteca in via di allestimento",
  ])("quarantines %s", (state) => {
    expect(
      mapItalianLibrary(italian({ "stato-registrazione": state }))
    ).toMatch(/Excluded registration/)
  })
  it("keeps uncensused institutions but does not infer a bookmobile stop", () => {
    const mapped = mapItalianLibrary(
      italian({
        "tipologia-funzionale": "Itinerante",
        "stato-registrazione": "Biblioteca non censita",
      })
    )
    if (typeof mapped === "string") throw new Error(mapped)
    expect(mapped.data.libraryType).toBe("Mobile")
    expect(mapped.data.timezone).toBe("Europe/Rome")
    expect(mapped.data.location).toBeUndefined()
  })
  it("rejects incomplete exports and duplicate source identities", () => {
    expect(() => validateItalianSnapshot({ biblioteche: [italian()] })).toThrow(
      /Incomplete/
    )
    const rows = Array.from({ length: 10000 }, () => italian())
    expect(() =>
      validateItalianSnapshot({
        biblioteche: rows,
        metadati: {
          "biblioteche-estratte": 10000,
          "data-estrazione": "2026-11-01",
        },
      })
    ).toThrow(/duplicate/)
  })
})

describe("Italian administrative population validation", () => {
  it("reconciles every province with its parent and refuses altered licences or duplicate codes", () => {
    const common = {
      iso2: "IT",
      year: 2023,
      boundaryVersion: "20240101",
      licence: "CC BY 4.0",
      sourceUrl: "https://www.istat.it/notizia/dati-per-sezioni-di-censimento/",
      method: "sum_complete_children",
      retrievedAt: "2026-11-01",
    }
    const provinces = Array.from({ length: 107 }, (_, i) => ({
      ...common,
      level: "area",
      name: `Province ${i}`,
      reportingCode: `IT-P${String(i + 1).padStart(3, "0")}`,
      parentReportingCode: `IT-R${String((i % 20) + 1).padStart(2, "0")}`,
      population: i === 106 ? 58_971_230 - 106 : 1,
    }))
    const regions = Array.from({ length: 20 }, (_, i) => {
      const code = `IT-R${String(i + 1).padStart(2, "0")}`

      return {
        ...common,
        level: "region",
        name: code,
        reportingCode: code,
        parentReportingCode: "ITA",
        population: provinces
          .filter((row) => row.parentReportingCode === code)
          .reduce((sum, row) => sum + row.population, 0),
      }
    })
    const rows = [
      {
        ...common,
        level: "country",
        name: "Italy",
        reportingCode: "ITA",
        population: 58_971_230,
      },
      ...regions,
      ...provinces,
    ].map((row) => ({
      ...row,
      key: `istat:IT:2023:${row.level}:${row.reportingCode}`,
    }))
    const plan = { country: "IT", observations: rows }
    expect(validateItalianPopulation(plan).provinces).toHaveLength(107)
    const bad = structuredClone(plan)
    bad.observations[1]!.population++
    expect(() => validateItalianPopulation(bad)).toThrow("reconcile")
    bad.observations[1] = bad.observations[2]!
    expect(() => validateItalianPopulation(bad)).toThrow(
      "provenance or identity"
    )
    rows[0]!.licence = "unknown"
    expect(() => validateItalianPopulation(plan)).toThrow(
      "provenance or identity"
    )
  })
})

describe("indexed directory provenance lookup", () => {
  it("coalesces draft/published twins and rejects identity collisions", async () => {
    const rows = [
      { record_id: "123", document_id: "one" },
      { record_id: "123", document_id: "one" },
      { record_id: null, document_id: "legacy" },
    ]
    const query = {
      join: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn(async () => rows),
    }
    const database = vi.fn(() => query)
    expect(await directorySourceRecords(database, "it-iccu")).toEqual(
      new Map([["123", "one"]])
    )
    expect(query.where).toHaveBeenCalledWith({
      "s.dataset": "it-iccu",
      "j.component_type": "library.source-record",
      "j.field": "sourceRecords",
    })
    rows.push({ record_id: "123", document_id: "other" })
    await expect(directorySourceRecords(database, "it-iccu")).rejects.toThrow(
      "multiple Libraries"
    )
  })
})

describe("Irish source acceptance", () => {
  const feed = IRISH_FEEDS[0]
  it("rejects changed licence or resource, independently of readable data", () => {
    const catalogue = {
      success: true,
      result: {
        name: feed.catalogue,
        license_id: "CC-BY-4.0",
        resources: [{ url: feed.service }],
      },
    }
    expect(() => validateIrishCatalogue(catalogue, feed)).not.toThrow()
    catalogue.result.license_id = "not-specified"
    expect(() => validateIrishCatalogue(catalogue, feed)).toThrow(/Licence/)
  })
  it("requires full ID coverage, stable IDs and WGS84 point geometry", () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1)
    const data = {
      objectIdFieldName: "OBJECTID",
      spatialReference: { wkid: 4326 },
      geometryType: "esriGeometryPoint",
      features: ids.map((id) => ({
        attributes: { OBJECTID: id, F__REF: `H${id}` },
      })),
    }
    expect(validateIrishFeatures(data, ids, feed)).toHaveLength(12)
    expect(() =>
      validateIrishFeatures({ ...data, exceededTransferLimit: true }, ids, feed)
    ).toThrow(/truncated/)
    expect(() =>
      validateIrishFeatures(
        { ...data, features: data.features.slice(1) },
        ids,
        feed
      )
    ).toThrow(/Coverage/)
    data.features[1].attributes.F__REF = "H1"
    expect(() => validateIrishFeatures(data, ids, feed)).toThrow(/stable/)
  })
  it("uses branch references and excludes a combined mobile/home-delivery entry", () => {
    expect(
      mapIrishLibrary(
        {
          attributes: { F__REF: "HA", Name: "Library" },
          geometry: { x: -6.2, y: 53.6 },
        },
        feed
      )
    ).toMatchObject({
      recordId: "HA",
      regionName: "Dublin",
      data: { location: { lat: 53.6, lng: -6.2 } },
    })
    expect(
      mapIrishLibrary(
        { attributes: { F__REF: "HJ/HG", Name: "Mobile Library/HouseBound" } },
        feed
      )
    ).toMatch(/Combined/)
  })
  it("flags both branches with duplicate names, even under distinct IDs", () => {
    expect(
      ambiguousIrishNames([
        { attributes: { Name: " Woodford " } },
        { attributes: { Name: "Woodford" } },
      ])
    ).toEqual(new Set(["woodford"]))
  })
})

describe("explicit target and licence registry", () => {
  it("matches reviewed region translations but refuses ambiguous equivalents", () => {
    const lombardia = { id: 1, documentId: "region-1", name: "Lombardia" }
    expect(matchDirectoryPlace([lombardia], "Lombardy", ["LOMBARDIA"])).toBe(
      lombardia
    )
    expect(() =>
      matchDirectoryPlace(
        [lombardia, { id: 2, documentId: "region-2", name: "Lombardy" }],
        "Lombardy",
        ["LOMBARDIA"]
      )
    ).toThrow(/Ambiguous/)
    expect(
      matchDirectoryPlace(
        [{ id: 3, documentId: "dublin", name: "Dublin" }],
        "Fingal County",
        ["Fingal"]
      )
    ).toBeUndefined()
  })
  it("places city and county feeds in the existing traditional-county hierarchy", () => {
    const feed = IRISH_FEEDS[2]
    expect(
      mapIrishLibrary(
        {
          attributes: {
            Name: "Westside",
            GlobalID: "080f8ff8-293a-4354-94c7-518924ced790",
          },
        },
        feed
      )
    ).toMatchObject({ regionName: "Galway" })
    expect(
      mapIrishLibrary(
        {
          attributes: {
            Name: "Roundstone",
            GlobalID: "bd3b7d8b-422a-4d85-a497-afcb2ab3f606",
          },
        },
        feed
      )
    ).toMatchObject({ regionName: "Galway" })
  })
  afterEach(() => vi.unstubAllEnvs())
  it("cannot accidentally run a local check or write against a remote target", () => {
    vi.stubEnv("STRAPI_URL", "https://cms.example.org")
    expect(() => assertIngestTarget({ apply: "true", local: "true" })).toThrow(
      /loopback/
    )
    expect(() => assertIngestTarget({ "check-cms": "true" })).toThrow(
      /exactly one/
    )
    vi.stubEnv("STRAPI_URL", "http://127.0.0.1:1337")
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@db.example.org/test")
    expect(() => assertIngestTarget({ apply: "true", local: "true" })).toThrow(
      /loopback/
    )
  })
  it("registers each publisher separately with explicit reuse terms", () => {
    for (const key of ["it-iccu", ...IRISH_FEEDS.map((feed) => feed.key)]) {
      const entries = DATASET_SEED.filter((seed) => seed.key === key)
      expect(entries).toHaveLength(1)
      expect(entries[0].licenceStatus).toBe("stated_by_publisher")
      expect(entries[0].redistribution).toMatch(/^permitted/)
    }
  })
})
