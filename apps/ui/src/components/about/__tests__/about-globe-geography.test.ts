import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  createCountryPicker,
  globeInteractionReady,
  withUkCountries,
  type LocalBoundaries,
  type CountryBoundaries,
} from "@/components/about/about-globe-geography"
import type { AboutGlobeCountry } from "@/components/about/about-globe.types"

const country = (iso3: string): AboutGlobeCountry => ({
  iso3,
  slug: iso3,
  name: iso3,
  iso2: null,
  continent: "test",
  libraryCount: null,
  center: null,
})
const boundaries = JSON.parse(
  readFileSync(
    new URL(
      "../../../../public/atlas/countries-a786ca1df034714e.geojson",
      import.meta.url
    ),
    "utf8"
  )
) as CountryBoundaries
const pick = createCountryPicker(
  boundaries,
  boundaries.features.map((feature) => country(feature.properties.iso3))
)

describe("country geography on the globe", () => {
  it.each([
    [51.5, -0.12, "GBR"],
    [48.86, 2.35, "FRA"],
    [52.52, 13.4, "DEU"],
    [52.37, 4.9, "NLD"],
    [-1.29, 36.82, "KEN"],
    [35.68, 139.69, "JPN"],
    [-33.87, 151.21, "AUS"],
    [38.89, -77.01, "USA"],
  ])("matches the existing Atlas boundary at %s, %s", (lat, lng, expected) => {
    expect(pick(lat as number, lng as number)?.iso3).toBe(expected)
  })
  it("does not assign ocean or an unpublished country to the nearest light", () => {
    expect(pick(0, -140)).toBeNull()
    expect(
      createCountryPicker(boundaries, [country("DEU")])(48.86, 2.35)
    ).toBeNull()
  })
  it("handles holes and islands across the antimeridian", () => {
    const shape: CountryBoundaries = {
      features: [
        {
          properties: { iso3: "TST" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [170, -10],
                  [-170, -10],
                  [-170, 10],
                  [170, 10],
                  [170, -10],
                ],
              ],
              [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 10],
                  [0, 0],
                ],
                [
                  [4, 4],
                  [6, 4],
                  [6, 6],
                  [4, 6],
                  [4, 4],
                ],
              ],
            ],
          },
        },
      ],
    }
    const lookup = createCountryPicker(shape, [country("TST")])
    expect(lookup(0, 179)?.iso3).toBe("TST")
    expect(lookup(0, -179)?.iso3).toBe("TST")
    expect(lookup(-5, 0)).toBeNull()
    expect(lookup(3, 3)?.iso3).toBe("TST")
    expect(lookup(5, 5)).toBeNull()
  })
})

describe("About globe activation", () => {
  it("waits for the complete desktop reveal and the visible frame", () => {
    expect(globeInteractionReady(0.7, true, 57, 900, 900)).toBe(false)
    expect(globeInteractionReady(1, true, 57, 900, 900)).toBe(true)
    expect(globeInteractionReady(1, true, -10, 900, 900)).toBe(false)
  })
  it("requires the whole frame on touch and reduced motion layouts", () => {
    expect(globeInteractionReady(1, false, 150, 650, 800)).toBe(true)
    expect(globeInteractionReady(1, false, 150, 950, 800)).toBe(false)
  })
})

it("keeps the CMS UK countries distinct with the existing ONS display boundaries", () => {
  const local = JSON.parse(
    readFileSync(
      new URL(
        "../../../../public/atlas/local-areas-30b18da5fa5e47bb.geojson",
        import.meta.url
      ),
      "utf8"
    )
  ) as LocalBoundaries
  const lookup = createCountryPicker(withUkCountries(boundaries, local), [
    country("ENG"),
    country("SCT"),
    country("WLS"),
    country("NIR"),
  ])
  expect(lookup(51.5, -0.12)?.iso3).toBe("ENG")
  expect(lookup(55.95, -3.2)?.iso3).toBe("SCT")
  expect(lookup(51.48, -3.18)?.iso3).toBe("WLS")
  expect(lookup(54.6, -5.93)?.iso3).toBe("NIR")
})
