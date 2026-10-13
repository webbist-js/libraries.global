import { describe, expect, it } from "vitest"

import type { Place, PlaceAddress } from "@/lib/geocode/place"

import {
  addressIsEmpty,
  applyPlace,
  atlasCountryCodes,
  locationKey,
  matchByName,
  placeKey,
  withAddress,
} from "../location.apply"
import { EMPTY_FORM } from "../wizard.types"

const ADDRESS: PlaceAddress = {
  streetAddress: "96 Euston Road",
  district: "Somers Town",
  city: "London",
  postalCode: "NW1 2DB",
  country: "United Kingdom",
  countryCode: "GB",
  state: "England",
  county: "",
}

const LIBRARY: Place = {
  id: "W4680891",
  label: "British Library",
  detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
  kind: "Library",
  lat: 51.5299119,
  lng: -0.1276918,
  precise: true,
  address: ADDRESS,
}

describe("applyPlace", () => {
  it("writes the address and the coordinates", () => {
    expect(applyPlace({ ...EMPTY_FORM, name: "BL" }, LIBRARY)).toEqual({
      ...EMPTY_FORM,
      name: "BL",
      streetAddress: "96 Euston Road",
      district: "Somers Town",
      city: "London",
      postalCode: "NW1 2DB",
      country: "United Kingdom",
      lat: "51.529912",
      lng: "-0.127692",
    })
  })

  it("keeps what the place doesn't have", () => {
    const form = { ...EMPTY_FORM, district: "Camden", postalCode: "NW1 9ZZ" }
    const place = {
      ...LIBRARY,
      address: { ...ADDRESS, district: "", postalCode: "" },
    }
    expect(applyPlace(form, place)).toMatchObject({
      district: "Camden",
      postalCode: "NW1 9ZZ",
      city: "London",
    })
  })
})

describe("withAddress", () => {
  it("leaves the coordinates alone", () => {
    const form = { ...EMPTY_FORM, lat: "53.83", lng: "-1.95" }
    expect(withAddress(form, ADDRESS)).toMatchObject({
      lat: "53.83",
      lng: "-1.95",
      city: "London",
    })
  })
})

describe("addressIsEmpty", () => {
  it("ignores the coordinates and blank space", () => {
    expect(addressIsEmpty(EMPTY_FORM)).toBe(true)
    expect(addressIsEmpty({ ...EMPTY_FORM, lat: "1", city: "  " })).toBe(true)
    expect(addressIsEmpty({ ...EMPTY_FORM, country: "England" })).toBe(false)
  })
})

describe("locationKey", () => {
  it("changes with any address field or coordinate", () => {
    const key = locationKey(EMPTY_FORM)
    expect(locationKey({ ...EMPTY_FORM, name: "x" })).toBe(key)
    expect(locationKey({ ...EMPTY_FORM, city: "x" })).not.toBe(key)
    expect(locationKey({ ...EMPTY_FORM, lng: "1" })).not.toBe(key)
  })
})

describe("atlasCountryCodes", () => {
  it("tries the UK's countries by their own codes first", () => {
    expect(atlasCountryCodes(ADDRESS)).toEqual(["GB-ENG", "GB"])
    expect(atlasCountryCodes({ ...ADDRESS, state: "Scotland" })).toEqual([
      "GB-SCT",
      "GB",
    ])
    expect(atlasCountryCodes({ ...ADDRESS, state: "" })).toEqual(["GB"])
  })

  it("uses the plain code elsewhere, and nothing without one", () => {
    expect(
      atlasCountryCodes({ ...ADDRESS, countryCode: "DE", state: "Bavaria" })
    ).toEqual(["DE"])
    expect(atlasCountryCodes({ ...ADDRESS, countryCode: "" })).toEqual([])
  })
})

describe("placeKey", () => {
  it("ignores case, accents, spacing and a leading qualifier", () => {
    expect(placeKey("Greater London")).toBe("london")
    expect(placeKey("  The   Hague ")).toBe("hague")
    expect(placeKey("Île-de-France")).toBe("ile-de-france")
    expect(placeKey("County of Durham")).toBe("durham")
    expect(placeKey("West Yorkshire")).toBe("west yorkshire")
  })
})

describe("matchByName", () => {
  const regions = [
    { documentId: "gl", name: "Greater London" },
    { documentId: "wy", name: "West Yorkshire" },
  ]

  it("finds the one option named like any of the names", () => {
    expect(matchByName(regions, ["England", "", "London"])).toBe("gl")
    expect(matchByName(regions, ["west yorkshire"])).toBe("wy")
  })

  it("is null for no match or several", () => {
    expect(matchByName(regions, ["Kent"])).toBeNull()
    expect(matchByName(regions, ["London", "West Yorkshire"])).toBeNull()
    expect(matchByName([{ documentId: "x", name: "" }], [""])).toBeNull()
  })
})
