import { describe, expect, it } from "vitest"

import { matchPlace, placeKey } from "../../scripts/ingests/_shared/place-match"

const places = (...names: string[]) =>
  names.map((name, i) => ({ name, slug: `p${i}` }))

describe("placeKey", () => {
  it("ignores case, accents, punctuation and spacing", () => {
    expect(placeKey("LOÍZA")).toBe(placeKey("Loíza"))
    expect(placeKey("CANOVANAS")).toBe(placeKey("Canóvanas"))
    expect(placeKey("LA SALLE")).toBe(placeKey("LaSalle County"))
    expect(placeKey("O BRIEN")).toBe(placeKey("O'Brien County"))
    expect(placeKey("PRINCE GEORGE'S")).toBe(placeKey("Prince George's County"))
    expect(placeKey("MA`OPUTASI")).toBe(placeKey("Ma'oputasi"))
  })

  it("expands St. and drops the words that only say what kind of place it is", () => {
    expect(placeKey("ST JOHNS")).toBe(placeKey("Saint Johns County"))
    expect(placeKey("ST. CROIX")).toBe(placeKey("Saint Croix Island"))
    expect(placeKey("ST JOHN BAPTIST")).toBe(
      placeKey("Saint John the Baptist Parish")
    )
    expect(placeKey("ANCHORAGE")).toBe(placeKey("Anchorage Municipality"))
    expect(placeKey("SAN FRANCISCO")).toBe(
      placeKey("City and County of San Francisco")
    )
  })
})

describe("matchPlace", () => {
  const virginia = places(
    "Richmond County",
    "City of Richmond",
    "City of Alexandria",
    "James City County"
  )

  it("finds the one place with the same key", () => {
    expect(matchPlace("ALEXANDRIA", virginia)?.name).toBe("City of Alexandria")
    expect(matchPlace("JAMES CITY", virginia)?.name).toBe("James City County")
  })

  it("returns null when nothing matches", () => {
    expect(matchPlace("LOUDON", virginia)).toBeNull()
    expect(matchPlace("", virginia)).toBeNull()
  })

  it("settles a city and a county of the same name only when the name says which", () => {
    expect(matchPlace("RICHMOND", virginia)).toBeNull()
    expect(matchPlace("RICHMOND CITY", virginia)?.name).toBe("City of Richmond")
    expect(matchPlace("Richmond city", virginia)?.name).toBe("City of Richmond")
    expect(matchPlace("Richmond County", virginia)?.name).toBe(
      "Richmond County"
    )
  })
})
