import { describe, expect, it } from "vitest"

import {
  placeLibrary,
  regionKey,
  type PlaceIndex,
} from "../../scripts/libraryon-placement"

const index: PlaceIndex = {
  areasByGss: new Map([
    ["E07000039", { regionId: "derbyshire", areaId: "south-derbyshire" }],
  ]),
  regionsByName: new Map([
    [regionKey("scotland", "Glasgow City"), ["glasgow"]],
    [regionKey("scotland", "Nah-Eileanan Siar"), ["western-isles"]],
    [regionKey("northern-ireland", "Lisburn and Castlereagh"), ["lisburn"]],
    [
      regionKey("northern-ireland", "Lisburn City and Castlereagh"),
      ["lisburn-old"],
    ],
    [regionKey("wales", "Cardiff"), ["cardiff-1", "cardiff-2"]],
  ]),
}

describe("placeLibrary", () => {
  it("files an English library under its district's Area and county", () => {
    expect(
      placeLibrary(
        { country: "England", name: "South Derbyshire", code: "E07000039" },
        index
      )
    ).toEqual({
      countrySlug: "england",
      regionId: "derbyshire",
      areaId: "south-derbyshire",
    })
  })

  it("never falls back to a name in England", () => {
    expect(
      placeLibrary(
        { country: "England", name: "Derbyshire", code: "E99999999" },
        index
      )
    ).toEqual({ error: "no Area with GSS code E99999999 (Derbyshire)" })
  })

  it("files a Scottish, Welsh or NI library under its council by name", () => {
    expect(
      placeLibrary(
        { country: "Scotland", name: "Glasgow City", code: "S12000049" },
        index
      )
    ).toEqual({ countrySlug: "scotland", regionId: "glasgow", areaId: null })
    expect(
      placeLibrary(
        {
          country: "Northern Ireland",
          name: "Lisburn and Castlereagh",
          code: "N09000007",
        },
        index
      )
    ).toMatchObject({ regionId: "lisburn" })
  })

  it("joins postcodes.io's Gaelic spelling to the atlas's", () => {
    expect(
      placeLibrary(
        { country: "Scotland", name: "Na h-Eileanan Siar", code: "S12000013" },
        index
      )
    ).toMatchObject({ regionId: "western-isles" })
  })

  it("refuses an ambiguous or unknown council instead of guessing", () => {
    expect(
      placeLibrary(
        { country: "Wales", name: "Cardiff", code: "W06000015" },
        index
      )
    ).toEqual({ error: "2 Regions named Cardiff in Wales" })
    expect(
      placeLibrary(
        { country: "Wales", name: "Powys", code: "W06000023" },
        index
      )
    ).toEqual({ error: "no Region named Powys in Wales" })
  })

  it("refuses places outside the four nations, or no council at all", () => {
    expect(
      placeLibrary({ country: "Isle of Man", name: "", code: "" }, index)
    ).toEqual({ error: "outside the four UK nations (Isle of Man)" })
    expect(placeLibrary(null, index)).toEqual({
      error: "no council found at its location",
    })
  })
})
