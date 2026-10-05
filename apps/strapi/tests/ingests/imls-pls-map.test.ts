import { parseCsv } from "../../scripts/ingests/_shared/csv"
import { properCase, slugify } from "../../scripts/ingests/_shared/text"
import {
  mapOutlet,
  outletSlug,
  type AdminRow,
  type OutletRow,
} from "../../scripts/ingests/usa/imls-pls/map"

const outlet = (over: Partial<OutletRow> = {}): OutletRow => ({
  STABR: "NY",
  FSCSKEY: "NY0001",
  FSCS_SEQ: "002",
  LIBNAME: "MONTOUR FALLS MEMORIAL LIBRARY",
  ADDRESS: "406  W MAIN STREET",
  CITY: "MONTOUR FALLS",
  ZIP: "14865",
  CNTY: "SCHUYLER",
  PHONE: "6075357489",
  C_OUT_TY: "CE",
  SQ_FEET: "2509",
  F_SQ_FT: "R_23",
  HOURS: "2210",
  F_HOURS: "R_23",
  STATSTRU: "00",
  LONGITUD: "-76.8495122",
  LATITUDE: "42.3457972",
  GEOSCORE: "100",
  GEOMTYPE: "POINTADDRESS",
  ...over,
})

const admin = (over: Partial<AdminRow> = {}): AdminRow => ({
  FSCSKEY: "NY0001",
  LIBNAME: "MONTOUR FALLS MEMORIAL LIBRARY",
  C_LEGBAS: "NP",
  ...over,
})

function mapped(row: OutletRow, ae: AdminRow | undefined = admin()) {
  const result = mapOutlet(row, ae)
  if (!result.ok) throw new Error(result.reason)

  return result.outlet
}

describe("properCase", () => {
  it("handles apostrophes, Mc names, ordinals and small words", () => {
    expect(properCase("CHILDREN'S LIBRARY OF THE 42ND STREET")).toBe(
      "Children's Library of the 42nd Street"
    )
    expect(properCase("O'NEILL MCKINLEY PARK")).toBe("O'Neill McKinley Park")
    expect(properCase("OGDEN FARMERS' LIBRARY")).toBe("Ogden Farmers' Library")
    expect(properCase("PO BOX 12")).toBe("PO Box 12")
    expect(properCase("THE WILKES-BARRE LIBRARY")).toBe(
      "The Wilkes-Barre Library"
    )
  })

  it("capitalises a word after an opening bracket or quote", () => {
    expect(properCase("SAN GERMAN PUBLIC LIBRARY (RAQUEL QUINONES)")).toBe(
      "San German Public Library (Raquel Quinones)"
    )
    expect(properCase('THE "OLD" LIBRARY (THE ANNEX)')).toBe(
      'The "Old" Library (The Annex)'
    )
  })
})

describe("slugs", () => {
  it("strips accents and apostrophes", () => {
    expect(slugify("Isaías González-Soto Branch")).toBe(
      "isaias-gonzalez-soto-branch"
    )
    expect(slugify("Clason's Point")).toBe("clasons-point")
  })

  it("adds the city unless the name has it, and always the state", () => {
    expect(
      outletSlug("Montour Falls Memorial Library", "Montour Falls", "NY")
    ).toBe("montour-falls-memorial-library-ny")
    expect(outletSlug("Powers Library Association", "Moravia", "NY")).toBe(
      "powers-library-association-moravia-ny"
    )
  })
})

describe("mapOutlet", () => {
  it("maps a central library", () => {
    const o = mapped(outlet())

    expect(o.recordId).toBe("NY0001-002")
    expect(o.data).toMatchObject({
      name: "Montour Falls Memorial Library",
      slug: "montour-falls-memorial-library-ny",
      libraryType: "Public",
      operationalStatus: "open",
      operatorType: "Independent",
      streetAddress: "406 W Main Street",
      city: "Montour Falls",
      postalCode: "14865",
      phone: "(607) 535-7489",
      location: { lat: 42.3457972, lng: -76.8495122 },
      timezone: "America/New_York",
      source: "imls-pls",
    })
    expect(o.geo).toEqual({
      regionName: "New York",
      regionSlug: "new-york",
      county: "SCHUYLER",
      areaName: "Schuyler County",
      areaSlug: "schuyler-county-ny",
      areaTypeLabel: "County",
    })
  })

  it("prefixes a place-named branch with the system name before its comma", () => {
    const o = mapped(
      outlet({
        C_OUT_TY: "BR",
        LIBNAME: "KINGSBRIDGE BRANCH",
        FSCSKEY: "NY0778",
      }),
      admin({ LIBNAME: "NEW YORK PUBLIC LIBRARY, THE BRANCH LIBRARIES" })
    )

    expect(o.data.name).toBe("New York Public Library, Kingsbridge Branch")
  })

  it("names a bookmobile filed under its library's name as a bookmobile", () => {
    const o = mapped(
      outlet({ C_OUT_TY: "BS", LIBNAME: "CASEY COUNTY PUBLIC LIBRARY" })
    )

    expect(o.data.name).toBe("Casey County Public Library Bookmobile")
    expect(o.data.libraryType).toBe("Mobile")
  })

  it("keeps only reported stats, never imputed ones", () => {
    const o = mapped(outlet({ F_HOURS: "IP22", F_SQ_FT: "R_23" }))

    expect(o.data.libraryStats).toEqual([
      {
        value: "2,509 sq ft",
        label: "Floor area",
        note: "IMLS Public Libraries Survey, FY 2023",
      },
    ])
  })

  it("maps temporary closure and survey non-response", () => {
    expect(mapped(outlet({ STATSTRU: "23" })).data.operationalStatus).toBe(
      "temporarily_closed"
    )
    expect(mapped(outlet({ STATSTRU: "25" })).data.operationalStatus).toBe(
      "unknown"
    )
  })

  it("leaves timezone empty in a state that spans zones", () => {
    const o = mapped(outlet({ STABR: "TX", CITY: "EL PASO", CNTY: "EL PASO" }))

    expect(o.data.timezone).toBeUndefined()
    expect(o.geo.areaSlug).toBe("el-paso-county-tx")
  })

  it("names Virginia's independent cities as cities", () => {
    const o = mapped(outlet({ STABR: "VA", CNTY: "RICHMOND CITY" }))

    expect(o.geo.areaName).toBe("Richmond City")
    expect(o.geo.areaTypeLabel).toBe("City")
  })

  it("keeps the survey's county as written, for matching to the atlas", () => {
    expect(mapped(outlet({ CNTY: "ST LAWRENCE" })).geo.county).toBe(
      "ST LAWRENCE"
    )
  })

  it("uses a state's own Region slug, and no Area where it has no counties", () => {
    expect(mapped(outlet({ STABR: "MT" })).geo.regionSlug).toBe("montana-us")

    const dc = mapped(outlet({ STABR: "DC", CNTY: "DIST OF COLUMBIA" }))
    expect(dc.geo.regionSlug).toBe("district-of-columbia")
    expect(dc.geo.areaSlug).toBeUndefined()
  })

  it("files a territory as its own Country, with its Region from the survey", () => {
    const pr = mapped(outlet({ STABR: "PR", CNTY: "BAYAMÓN", CITY: "BAYAMON" }))
    expect(pr.geo).toEqual({
      countrySlug: "puerto-rico",
      regionName: "Bayamón",
      regionSlug: "bayamon",
    })
    expect(pr.data.timezone).toBe("America/Puerto_Rico")

    const gu = mapped(outlet({ STABR: "GU", CNTY: "GUAM", CITY: "AGAT" }))
    expect(gu.geo.countrySlug).toBe("guam")
    expect(gu.geo.regionName).toBe("Agat")
    expect(
      mapped(outlet({ STABR: "GU", CNTY: "GUAM", CITY: "AGANA" })).geo
        .regionName
    ).toBe("Hagatna")
  })

  it("skips unknown state codes and books-by-mail services", () => {
    expect(mapOutlet(outlet({ STABR: "ZZ" }), admin()).ok).toBe(false)
    expect(mapOutlet(outlet({ C_OUT_TY: "BM" }), admin()).ok).toBe(false)
  })
})

describe("parseCsv", () => {
  it("reads quoted fields with commas, quotes and CRLF", () => {
    expect(parseCsv('A,B\r\n"x, y","say ""hi"""\r\n')).toEqual([
      { A: "x, y", B: 'say "hi"' },
    ])
  })
})
