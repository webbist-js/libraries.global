import { describe, expect, it } from "vitest"

import { validateLibraries } from "../../scripts/ingests/_shared/pipeline"
import { mapCanadianLibrary } from "../../scripts/ingests/canada/statcan-odcaf/map"
import {
  parseCanadianArchive,
  validateCanadianRows,
} from "../../scripts/ingests/canada/statcan-odcaf/source"
import {
  ambiguousMexicanMunicipalities,
  mapMexicanLibrary,
  mexicanText,
  MEXICAN_STATES,
} from "../../scripts/ingests/mexico/sic-rnbp/map"
import { validateMexicanSource } from "../../scripts/ingests/mexico/sic-rnbp/source"
import { DATASET_SEED } from "../../src/seeds/datasets"

import datasetSchema from "../../src/api/dataset/content-types/dataset/schema.json"

const mexico = {
  rnbp_id: 79478,
  rnbp_numero_coleccion: 5892,
  rnbp_nombre: "Jos&eacute; Mar&iacute;a Morelos y Pav&oacute;n",
  rnbp_calle_numero: "Coba nro. 302",
  rnbp_cp: "02068",
  rnbp_telefono1: "449 977 5921",
  rnbp_adscripcion: "Gobierno Municipal",
  municipio_id: 1,
  estado_id: 1,
  nom_ent: "Aguascalientes",
  nom_mun: "Aguascalientes",
  nom_loc: "Total del Municipio",
  gmaps_latitud: 21.85783,
  gmaps_longitud: -102.25617,
}
const canada = {
  Index: "6",
  Facility_Name: "100 Mile House Branch",
  Source_Facility_Type: "cariboo regional district library system",
  ODCAF_Facility_Type: "library or archives",
  Provider: "government of british columbia",
  Prov_Terr: "bc",
  PRUID: "59",
  CSDUID: "5941005",
  City: "pender island",
  CSD_Name: "One Hundred Mile House",
  Source_Format_Address: "449 s. birch avenue",
  Postal_Code: "V0K 2E0",
  Latitude: "51.64139",
  Longitude: "-121.29562",
}

describe("Mexico SIC mapping", () => {
  it("uses SIC IDs, decodes accents, preserves postal zeros and omits geographic placeholders", () => {
    const mapped = mapMexicanLibrary(mexico)
    expect(mapped).toMatchObject({
      recordId: "79478",
      countryCode: "MX",
      regionName: "Aguascalientes",
      areaName: "Aguascalientes",
      data: {
        name: "José María Morelos y Pavón",
        slug: "jose-maria-morelos-y-pavon-mx-sic-79478",
        postalCode: "02068",
        district: "Aguascalientes",
        libraryType: "Public",
        operationalStatus: "unknown",
        operatorType: "Municipality",
        sourceUrl:
          "https://sic.cultura.gob.mx/ficha.php?table=rnbp&table_id=79478",
        location: { lat: 21.85783, lng: -102.25617 },
      },
    })
    if (typeof mapped === "string") throw new Error(mapped)
    expect(mapped.data.city).toBeUndefined()
    expect(mapped.data.email).toBeUndefined()
    expect(mapped.data.openingTimes).toBeUndefined()
    expect(() => validateLibraries([mapped])).not.toThrow()
    expect(
      mapMexicanLibrary({ ...mexico, rnbp_numero_coleccion: 9999 })
    ).toEqual(mapped)
  })
  it("decodes numeric references without accepting invalid Unicode", () => {
    expect(mexicanText("&#74;os&#xE9; &quot;Ni&ntilde;o&quot;&nbsp;")).toBe(
      'José "Niño"'
    )
    expect(mexicanText("&#x110000;")).toBe("&#x110000;")
    expect(mexicanText(null)).toBeUndefined()
    expect(mexicanText("Sin dato")).toBeUndefined()
  })
  it("validates state identities and matches the existing Atlas aliases", () => {
    for (const [code, [source, target]] of Object.entries(MEXICAN_STATES)) {
      expect(
        mapMexicanLibrary({
          ...mexico,
          estado_id: Number(code),
          nom_ent: source,
        })
      ).toMatchObject({ regionName: target })
    }
    expect(mapMexicanLibrary({ ...mexico, estado_id: 9 })).toMatch(/disagree/)
    expect(mapMexicanLibrary({ ...mexico, rnbp_id: null })).toMatch(/identity/)
    expect(mapMexicanLibrary({ ...mexico, rnbp_nombre: "S/N" })).toMatch(/name/)
  })
  it("keeps unsupported coordinates, links, operators and long fields out of writes", () => {
    const mapped = mapMexicanLibrary({
      ...mexico,
      gmaps_latitud: 0,
      gmaps_longitud: 0,
      rnbp_cp: "1234",
      rnbp_calle_numero: "x".repeat(256),
      rnbp_adscripcion: "Unknown institution",
      pagina_web: "data:text/plain,ignored",
      nom_loc: "Localidad real",
    })
    if (typeof mapped === "string") throw new Error(mapped)
    for (const field of [
      "location",
      "postalCode",
      "streetAddress",
      "operatorType",
      "website",
    ])
      expect(mapped.data[field]).toBeUndefined()
    expect(mapped.data.city).toBe("Localidad real")
    expect(mapped.warnings).toHaveLength(3)
    expect(() => validateLibraries([mapped])).not.toThrow()
  })
  it("omits partial coordinate pairs instead of coercing missing values to zero", () => {
    expect(mapMexicanLibrary({ ...mexico, gmaps_latitud: null })).toMatchObject(
      { warnings: [expect.stringMatching(/coordinates/)] }
    )
    expect(mapMexicanLibrary({ ...mexico, gmaps_longitud: "" })).toMatchObject({
      warnings: [expect.stringMatching(/coordinates/)],
    })
  })
})

const completeMexicanSource = () =>
  Array.from({ length: 7000 }, (_, index) => {
    const code = (index % 32) + 1

    return {
      ...mexico,
      rnbp_id: index + 1,
      estado_id: code,
      nom_ent: MEXICAN_STATES[code][0],
    }
  })

describe("Mexican municipality identities", () => {
  it("does not name-match distinct municipalities within one state", () => {
    const first = {
      ...mexico,
      estado_id: 20,
      nom_ent: "Oaxaca",
      nom_mun: "San Juan Mixtepec",
      municipio_id: 208,
    }
    const second = { ...first, rnbp_id: 79479, municipio_id: 209 }
    const ambiguities = ambiguousMexicanMunicipalities([first, second])
    expect(ambiguities.size).toBe(1)
    for (const row of [first, second]) {
      const mapped = mapMexicanLibrary(row, ambiguities)
      if (typeof mapped === "string") throw new Error(mapped)
      expect(mapped.areaName).toBeUndefined()
      expect(mapped.data.district).toBe("San Juan Mixtepec")
      expect(mapped.warnings).toContain(
        "Municipality name identifies multiple official codes; state placement retained"
      )
    }
    expect(
      ambiguousMexicanMunicipalities([first, { ...second, estado_id: 19 }]).size
    ).toBe(0)
  })
})

describe("complete Mexican source validation", () => {
  it("accepts all states and rejects truncated or duplicate downloads", () => {
    const rows = completeMexicanSource()
    expect(() => validateMexicanSource(rows)).not.toThrow()
    expect(() => validateMexicanSource(rows.slice(0, 20))).toThrow(/coverage/)
    rows[1].rnbp_id = rows[0].rnbp_id
    expect(() => validateMexicanSource(rows)).toThrow(/Duplicate/)
  })
  it("rejects missing states, unknown state codes and removed source fields", () => {
    expect(() =>
      validateMexicanSource(
        completeMexicanSource().map((row) => ({ ...row, estado_id: 1 }))
      )
    ).toThrow(/state coverage/)
    const rows: Record<string, unknown>[] = completeMexicanSource()
    rows[0].estado_id = 33
    expect(() => validateMexicanSource(rows)).toThrow(/state code/)
    rows[0].estado_id = 1
    delete rows[0].gmaps_latitud
    expect(() => validateMexicanSource(rows)).toThrow(/schema changed/)
  })
})

describe("Canadian ODCAF mapping", () => {
  it("scopes generated identities to v1.0 and keeps province placement separate from census subdivisions", () => {
    const mapped = mapCanadianLibrary(canada)
    expect(mapped).toMatchObject({
      recordId: "v1.0-6",
      countryCode: "CA",
      regionName: "British Columbia",
      data: {
        name: "100 Mile House Branch",
        city: "One Hundred Mile House",
        libraryType: "Public",
        operationalStatus: "unknown",
      },
    })
    if (typeof mapped === "string") throw new Error(mapped)
    expect(mapped.areaName).toBeUndefined()
    expect(mapped.warnings).toEqual([expect.stringMatching(/differs/)])
    for (const field of ["operatorType", "email", "website", "openingTimes"])
      expect(mapped.data[field]).toBeUndefined()
    expect(() => validateLibraries([mapped])).not.toThrow()
  })
  it("rejects system records, archives, headquarters, mobile bases and unrelated facilities", () => {
    expect(
      mapCanadianLibrary({ ...canada, Provider: "government of ontario" })
    ).toMatch(/systems/)
    expect(
      mapCanadianLibrary({
        ...canada,
        Provider: "canadian museums association",
      })
    ).toMatch(/review/)
    expect(
      mapCanadianLibrary({
        ...canada,
        Facility_Name: "Provincial Archives",
        Source_Facility_Type: "archive",
      })
    ).toMatch(/Archive/)
    expect(
      mapCanadianLibrary({ ...canada, Source_Facility_Type: "hq" })
    ).toMatch(/administrative/)
    expect(
      mapCanadianLibrary({ ...canada, Facility_Name: "Mobile Library" })
    ).toMatch(/Mobile/)
    expect(
      mapCanadianLibrary({ ...canada, ODCAF_Facility_Type: "museum" })
    ).toMatch(/Not a/)
  })
  it("requires library evidence when the source combines libraries and archives", () => {
    expect(
      mapCanadianLibrary({
        ...canada,
        Source_Facility_Type: "..",
        Provider: "other publisher",
        Facility_Name: "Unknown Centre",
      })
    ).toMatch(/does not establish/)
    expect(
      mapCanadianLibrary({
        ...canada,
        Source_Facility_Type: "..",
        Provider: "city of toronto",
        Facility_Name: "Agincourt",
      })
    ).toMatchObject({ data: { libraryType: "Public" } })
    expect(
      mapCanadianLibrary({
        ...canada,
        Source_Facility_Type: "municipale",
        Provider: "other publisher",
        Facility_Name: "Centre culturel",
      })
    ).toMatchObject({ data: { libraryType: "Public" } })
  })
  it("requires province and census code agreement", () => {
    expect(mapCanadianLibrary({ ...canada, PRUID: "35" })).toMatch(/disagree/)
    expect(mapCanadianLibrary({ ...canada, CSDUID: "3541005" })).toMatch(
      /disagree/
    )
    expect(mapCanadianLibrary({ ...canada, Prov_Terr: "xx" })).toMatch(
      /disagree/
    )
  })
  it("handles missing markers, invalid coordinates and normalized postcodes", () => {
    const mapped = mapCanadianLibrary({
      ...canada,
      Latitude: "..",
      Longitude: "..",
      Source_Format_Address: "..",
      Postal_Code: "v0k2e0",
      CSD_Name: "..",
    })
    if (typeof mapped === "string") throw new Error(mapped)
    expect(mapped.data).toMatchObject({ postalCode: "V0K 2E0" })
    expect(mapped.data.location).toBeUndefined()
    expect(mapped.data.streetAddress).toBeUndefined()
    expect(mapped.data.city).toBeUndefined()
    expect(mapped.warnings).toEqual([expect.stringMatching(/coordinates/)])
  })
  it("does not infer a public-library type from a generic library name", () => {
    expect(
      mapCanadianLibrary({
        ...canada,
        Provider: "city example",
        Facility_Name: "Research Library",
      })
    ).toMatchObject({ data: { libraryType: "Other" } })
    expect(
      mapCanadianLibrary({
        ...canada,
        Facility_Name: "Université Example Library",
      })
    ).toMatchObject({ data: { libraryType: "University" } })
  })
})

describe("Canadian source integrity", () => {
  it("refuses changed archive bytes before parsing them", () => {
    expect(() =>
      parseCanadianArchive(Buffer.from("changed release").toString("base64"))
    ).toThrow(/archive changed/)
  })
  it("rejects duplicate IDs, changed columns and unknown provinces", () => {
    expect(() => validateCanadianRows([canada])).not.toThrow()
    expect(() =>
      validateCanadianRows([
        { ...canada, ODCAF_Facility_Type: "museum", Prov_Terr: ".." },
      ])
    ).not.toThrow()
    expect(() => validateCanadianRows([canada, canada])).toThrow(/Duplicate/)
    expect(() =>
      validateCanadianRows([{ ...canada, Prov_Terr: "xx" }])
    ).toThrow(/province/)
    const changed = { ...canada }
    delete changed.Provider
    expect(() => validateCanadianRows([changed])).toThrow(/schema changed/)
  })
})

describe("North American dataset provenance", () => {
  it.each(["mx-sic-rnbp", "ca-statcan-odcaf"])(
    "registers %s with publisher reuse terms and attribution",
    (key) => {
      const datasets = DATASET_SEED.filter((row) => row.key === key)
      expect(datasets).toHaveLength(1)
      expect(datasets[0]).toMatchObject({
        licenceStatus: "stated_by_publisher",
        redistribution: "permitted_with_attribution",
      })
      expect(datasets[0].attribution).toBeTruthy()
      expect(datasets[0].licenceUrl).toMatch(/^https:/)
      const attributes = datasetSchema.attributes as Record<
        string,
        { type: string; maxLength?: number }
      >
      for (const [field, value] of Object.entries(datasets[0])) {
        const attribute = attributes[field]
        if (attribute && ["string", "uid"].includes(attribute.type))
          expect(value.length, `${key}.${field}`).toBeLessThanOrEqual(
            attribute.maxLength ?? 255
          )
      }
    }
  )
})
