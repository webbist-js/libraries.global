import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { executeDirectoryIngest } from "../scripts/ingests/_shared/directory"
import { mapGermanLibrary } from "../scripts/ingests/germany/isil/map"
import { parseSpanishExport } from "../scripts/ingests/spain/mcu-directory/ingest"
import { mapSpanishLibrary } from "../scripts/ingests/spain/mcu-directory/map"

const german = {
  isil: "DE-82-312",
  name: "Example library",
  land: "Bayern",
  libraryType: "33",
  latitude: 48.1,
  longitude: 11.5,
}
const spanish = {
  NIDEN: "410-1",
  Nombre: "Biblioteca de ejemplo",
  País: "España",
  CodCA: "01",
  CodProvincia: "41",
  Provincia: "Sevilla",
  Municipio: "Sevilla",
  Dirección: "Calle Ejemplo, 1",
  Distrito_Postal: "41001",
  Tipología: "Públicas",
  Longitud: -5.9,
  Latitud: 37.4,
}

describe("country import source contracts", () => {
  it("preserves complete ISIL identities and produces pipeline fields", () => {
    const result = mapGermanLibrary(german)
    expect(result).toMatchObject({
      recordId: "DE-82-312",
      regionName: "Bavaria",
      data: {
        slug: "example-library-de-82-312",
        location: { lat: 48.1, lng: 11.5 },
      },
    })
  })
  it("bounds lookup slugs and preserves a reviewed district", () => {
    const result = mapGermanLibrary({
      ...german,
      name: "Library ".repeat(30),
      areaName: "Landkreis München",
    })
    expect(result).toMatchObject({ areaName: "Landkreis München" })
    if (typeof result === "string") throw new Error(result)
    expect(result.data.slug.length).toBeLessThanOrEqual(200)
  })
  it("quarantines missing type and region instead of inventing them", () => {
    expect(typeof mapGermanLibrary({ ...german, libraryType: undefined })).toBe(
      "string"
    )
    expect(typeof mapGermanLibrary({ ...german, land: undefined })).toBe(
      "string"
    )
  })
  it("includes archives and omits mobile pins", () => {
    expect(mapGermanLibrary({ ...german, libraryType: "51" })).toMatchObject({
      data: { libraryType: "Archive" },
    })
    const mobile = mapGermanLibrary({ ...german, libraryType: "39" })
    expect(mobile).toMatchObject({
      data: { libraryType: "Mobile", location: undefined },
    })
    expect(typeof mapGermanLibrary({ ...german, dissolved: true })).toBe(
      "string"
    )
  })
  it("uses the street address and source identity from the Spanish export", () => {
    expect(mapSpanishLibrary(spanish)).toMatchObject({
      recordId: "410-1",
      data: {
        streetAddress: "Calle Ejemplo, 1",
        postalCode: "41001",
        location: { lat: 37.4, lng: -5.9 },
      },
    })
    expect(
      mapSpanishLibrary({
        ...spanish,
        Tipología: "Biblioteca Nacional de España",
      })
    ).toMatchObject({ data: { libraryType: "National" } })
  })
  it("recognises Canary points and quarantines host-country geography abroad", () => {
    expect(
      mapSpanishLibrary({
        ...spanish,
        CodCA: "05",
        Latitud: 28.1,
        Longitud: -15.4,
      })
    ).toMatchObject({ data: { location: { lat: 28.1, lng: -15.4 } } })
    expect(typeof mapSpanishLibrary({ ...spanish, País: "Alemania" })).toBe(
      "string"
    )
  })
  it("preserves literal control characters while repairing publisher JSON", () => {
    expect(
      parseSpanishExport('{"bibliotecas":[{"Nombre":"First\nSecond"}]}')
        .bibliotecas[0].Nombre
    ).toBe("First\nSecond")
  })
})

describe("unconfirmed Spanish source acknowledgement", () => {
  it("refuses the source by default and with the wrong acknowledgement", async () => {
    for (const acknowledgement of [undefined, "another-dataset"]) {
      await expect(
        executeDirectoryIngest({
          args: acknowledgement
            ? { "acknowledge-unconfirmed-licence": acknowledgement }
            : {},
          directory: tmpdir(),
          dataset: "es-mcu-libraries",
          inputs: [],
          retrievedAt: "2026-11-03T00:00:00Z",
          sourceCount: 0,
          libraries: [],
          skipped: [],
        })
      ).rejects.toThrow("no confirmed redistribution terms")
    }
  })
  it("records an explicit source-specific acknowledgement without changing licence metadata", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "spanish-source-"))
    try {
      const report = await executeDirectoryIngest({
        args: { "acknowledge-unconfirmed-licence": "es-mcu-libraries" },
        directory,
        dataset: "es-mcu-libraries",
        inputs: [],
        retrievedAt: "2026-11-03T00:00:00Z",
        sourceCount: 0,
        libraries: [],
        skipped: [],
      })
      expect(report).toMatchObject({
        dryRun: true,
        cmsChecked: false,
        redistribution: "unconfirmed",
        unconfirmedLicenceAcknowledged: true,
      })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
