import { describe, expect, it } from "vitest"

import { streetLine, toPlace, toPlaces } from "../place"
import {
  BAVARIAN_STATE_LIBRARY,
  BRITISH_LIBRARY,
  BRONTE_MUSEUM,
  CHURCH_STREET,
  HAWORTH_CHURCHYARD,
  HAWORTH_VILLAGE,
} from "./photon-fixtures"

describe("toPlace", () => {
  it("reads a library with a house number, number first in the UK", () => {
    expect(toPlace(BRITISH_LIBRARY)).toEqual({
      id: "W4680891",
      label: "British Library",
      detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
      kind: "Library",
      lat: 51.5299119,
      lng: -0.1276918,
      precise: true,
      address: {
        streetAddress: "96 Euston Road",
        district: "Somers Town",
        city: "London",
        postalCode: "NW1 2DB",
        country: "United Kingdom",
        countryCode: "GB",
        state: "England",
        county: "",
      },
    })
  })

  it("puts the number after the street in Germany", () => {
    const place = toPlace(BAVARIAN_STATE_LIBRARY)
    expect(place?.address.streetAddress).toBe("Ludwigstraße 16")
    expect(place?.address.city).toBe("Munich")
    expect(place?.address.countryCode).toBe("DE")
  })

  it("reads a building on a street without a number", () => {
    const place = toPlace(BRONTE_MUSEUM)
    expect(place).toMatchObject({
      label: "Bronte Parsonage Museum",
      kind: "Museum",
      precise: true,
      detail:
        "Church Street, Haworth and Stanbury, Bradford, West Yorkshire, England, United Kingdom",
    })
    expect(place?.address).toMatchObject({
      streetAddress: "Church Street",
      district: "Haworth and Stanbury",
      city: "Bradford",
      postalCode: "BD22 8DR",
      county: "West Yorkshire",
    })
  })

  it("names a settlement as its own city, without its stray postcode", () => {
    expect(toPlace(HAWORTH_VILLAGE)).toMatchObject({
      label: "Haworth",
      kind: "Village",
      precise: false,
      detail: "West Yorkshire, England, United Kingdom",
      address: { city: "Haworth", district: "", postalCode: "" },
    })
  })

  it("takes a street result's name as the street", () => {
    expect(toPlace(CHURCH_STREET)).toMatchObject({
      label: "Church Street",
      kind: "Street",
      precise: false,
      detail:
        "Haworth and Stanbury, Bradford, West Yorkshire, England, United Kingdom",
      address: { streetAddress: "Church Street", postalCode: "BD22 8DR" },
    })
  })

  it("reads a reverse answer with no street", () => {
    expect(toPlace(HAWORTH_CHURCHYARD)).toMatchObject({
      label: "Haworth Churchyard",
      kind: "Cemetery",
      precise: false,
      address: { streetAddress: "", city: "Bradford", postalCode: "" },
    })
  })

  it("skips a feature without a position or anything to call it", () => {
    expect(toPlace({ properties: { name: "Nowhere" } })).toBeNull()
    expect(
      toPlace({ geometry: { coordinates: [0, 0] }, properties: {} })
    ).toBeNull()
  })
})

describe("streetLine", () => {
  it("orders the number as the country writes it", () => {
    expect(streetLine("Euston Road", "96", "GB")).toBe("96 Euston Road")
    expect(streetLine("Ludwigstraße", "16", "DE")).toBe("Ludwigstraße 16")
    expect(streetLine("Main St", "", "US")).toBe("Main St")
    expect(streetLine("", "3", "GB")).toBe("")
  })
})

describe("toPlaces", () => {
  it("reads a FeatureCollection, dropping duplicates and junk", () => {
    const places = toPlaces({
      features: [
        BRITISH_LIBRARY,
        BRITISH_LIBRARY,
        { properties: {} },
        HAWORTH_VILLAGE,
      ],
    })
    expect(places.map((p) => p.id)).toEqual(["W4680891", "N4813966154"])
  })

  it("is empty for anything that isn't one", () => {
    expect(toPlaces(null)).toEqual([])
    expect(toPlaces({ features: "x" })).toEqual([])
  })
})
