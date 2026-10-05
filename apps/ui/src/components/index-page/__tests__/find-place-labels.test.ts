import { describe, expect, it } from "vitest"

import { placeSelectLabels } from "../place-select-labels"

const empty = { continents: [], countries: [], regions: [], areas: [] }

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

  it("names the Area select from the country, or says Area with no label", () => {
    const area = placeSelectLabels({
      ...empty,
      country: {
        slug: "switzerland",
        name: "Switzerland",
        areaTypeLabel: "Commune",
        areasSectionLabel: "Communes",
      },
    })[3]
    expect(area).toEqual({
      level: "area",
      label: "Commune",
      all: "All communes",
    })
    expect(placeSelectLabels()[3]).toEqual({
      level: "area",
      label: "Area",
      all: "All areas",
    })
  })

  it("prefers a Region's own Area label over its country's", () => {
    const area = placeSelectLabels({
      ...empty,
      country: {
        slug: "gb",
        name: "United Kingdom",
        areaTypeLabel: "District",
        areasSectionLabel: "Districts",
      },
      region: {
        slug: "greater-london",
        name: "Greater London",
        areaTypeLabel: "Borough",
        areasSectionLabel: "Boroughs",
      },
    })[3]
    expect(area).toEqual({
      level: "area",
      label: "Borough",
      all: "All boroughs",
    })
  })
})
