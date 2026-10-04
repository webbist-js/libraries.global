import { describe, expect, it } from "vitest"

import { placeSelectLabels } from "../place-select-labels"

const empty = { continents: [], countries: [], regions: [] }

describe("placeSelectLabels", () => {
  it("names the Region select as the chosen country does", () => {
    const region = placeSelectLabels({
      ...empty,
      country: {
        slug: "switzerland",
        name: "Switzerland",
        regionTypeLabel: "Canton",
        regionsSectionLabel: "Cantons",
      },
    })[2]
    expect(region).toEqual({
      level: "region",
      label: "Canton",
      all: "All cantons",
    })
  })

  it("says Region with no country or no label", () => {
    expect(placeSelectLabels()[2]).toEqual({
      level: "region",
      label: "Region",
      all: "All regions",
    })
    expect(
      placeSelectLabels({ ...empty, country: { slug: "x", name: "X" } })[2]
    ).toEqual({ level: "region", label: "Region", all: "All regions" })
  })

  it("keeps continent and country", () => {
    const [continent, country] = placeSelectLabels()
    expect(continent).toEqual({
      level: "continent",
      label: "Continent",
      all: "All continents",
    })
    expect(country).toEqual({
      level: "country",
      label: "Country",
      all: "All countries",
    })
  })
})
