import { describe, expect, it } from "vitest"

import {
  boundaryFor,
  countryBounds,
  perHundredThousand,
} from "@/lib/atlas-countries"

describe("Atlas countries", () => {
  it("draws each record as a boundary: iso3, then iso2, then name, UK nations as GBR", () => {
    expect(boundaryFor({ slug: "france", name: "France", iso3: "FRA" })).toBe(
      "FRA"
    )
    expect(
      boundaryFor({ slug: "australia", name: "Australia", iso2: "AU" })
    ).toBe("AUS")
    expect(boundaryFor({ slug: "mexico", name: "Mexico" })).toBe("MEX")
    expect(
      boundaryFor({ slug: "scotland", name: "Scotland", iso3: "SCT" })
    ).toBe("GBR")
    expect(boundaryFor({ slug: "nowhere", name: "Nowhere" })).toBeNull()
  })

  it("fits to the boundary's bounds and rates libraries per 100,000 people", () => {
    expect(countryBounds("FIN")).toMatchObject({
      west: expect.any(Number),
      north: expect.any(Number),
    })
    expect(perHundredThousand(962, 5_622_045)).toBe(17.1)
    expect(perHundredThousand(null, 100)).toBeNull()
  })
})
