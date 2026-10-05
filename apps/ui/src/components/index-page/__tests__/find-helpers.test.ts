import { describe, expect, it } from "vitest"

import type { FindLocation } from "@/lib/find-search"

import {
  ALL_NEED_KEYS,
  DEFAULT_FIND_STATE,
  findQueryOf,
  findStateFromParams,
  findStateToParams,
  hasActiveFindFilters,
  openStatus,
  pickPlace,
  placeChoices,
  placeName,
  placePath,
} from "../find-helpers"

describe("NEED_KEYS", () => {
  it("covers every gap a contributor can fill, in order", () => {
    expect(ALL_NEED_KEYS).toEqual([
      "hours",
      "photo",
      "accessibility",
      "services",
      "contact",
      "address",
    ])
  })

  it("keeps only the recognised keys from ?needs=", () => {
    expect(
      findStateFromParams(new URLSearchParams("needs=hours,facilities")).needs
    ).toEqual(["hours"])
  })
})

describe("place scope", () => {
  it("reads a continent, country or region slug from the URL", () => {
    expect(
      findStateFromParams(new URLSearchParams("continent=europe")).place
    ).toEqual({ level: "continent", slug: "europe" })
    expect(
      findStateFromParams(new URLSearchParams("country=england&q=radlett"))
        .place
    ).toEqual({ level: "country", slug: "england" })
  })

  it("prefers the narrowest place when several are given", () => {
    expect(
      findStateFromParams(
        new URLSearchParams("continent=europe&region=hertfordshire")
      ).place
    ).toEqual({ level: "region", slug: "hertfordshire" })
  })

  it("round-trips and counts as an active filter", () => {
    const state = {
      ...DEFAULT_FIND_STATE,
      place: { level: "region" as const, slug: "hertfordshire" },
    }
    expect(findStateToParams(state).toString()).toBe("region=hertfordshire")
    expect(hasActiveFindFilters(state)).toBe(true)
    expect(hasActiveFindFilters(DEFAULT_FIND_STATE)).toBe(false)
  })

  it("round-trips area and source through the URL", () => {
    const state = findStateFromParams(
      new URLSearchParams(
        "region=new-york&area=schuyler-county-ny&source=imls-pls"
      )
    )
    expect(state.place).toEqual({
      level: "area",
      slug: "schuyler-county-ny",
    })
    expect(state.source).toBe("imls-pls")
    const back = findStateToParams(state)
    expect(back.get("area")).toBe("schuyler-county-ny")
    expect(back.get("source")).toBe("imls-pls")
  })

  it("leaves source null without the param", () => {
    expect(findStateFromParams(new URLSearchParams("")).source).toBeNull()
    expect(findQueryOf(DEFAULT_FIND_STATE, "en").source).toBeUndefined()
  })
})

describe("Location filter", () => {
  const location: FindLocation = {
    continent: { slug: "europe", name: "Europe" },
    country: { slug: "england", name: "England" },
    region: { slug: "hertfordshire", name: "Hertfordshire" },
    continents: [{ slug: "europe", name: "Europe", count: 900 }],
    countries: [
      { slug: "england", name: "England", count: 800 },
      { slug: "wales", name: "Wales", count: 100 },
    ],
    regions: [{ slug: "hertfordshire", name: "Hertfordshire", count: 40 }],
    areas: [],
  }
  const region = { level: "region" as const, slug: "hertfordshire" }

  it("fills the parents from the search once it has named the place", () => {
    expect(placePath(region, location)).toEqual({
      continent: "europe",
      country: "england",
      region: "hertfordshire",
      area: "",
    })
    expect(placePath(null, location)).toEqual({
      continent: "",
      country: "",
      region: "",
      area: "",
    })
  })

  it("offers an area once a region is chosen, keeping it when the region clears", () => {
    const withArea: FindLocation = {
      ...location,
      area: { slug: "cheshunt", name: "Cheshunt" },
      areas: [{ slug: "cheshunt", name: "Cheshunt", count: 5 }],
    }
    const area = { level: "area" as const, slug: "cheshunt" }
    expect(placePath(area, withArea)).toEqual({
      continent: "europe",
      country: "england",
      region: "hertfordshire",
      area: "cheshunt",
    })
    const path = placePath(area, withArea)
    expect(placeChoices("area", path, withArea)).toEqual([
      { slug: "cheshunt", name: "Cheshunt", count: 5 },
    ])
    // Clearing the region also clears the area: there is no level to step to.
    expect(pickPlace(path, "region", "")).toEqual({
      level: "country",
      slug: "england",
      parents: { continent: "europe" },
    })
  })

  it("keeps the picked parents until then", () => {
    const wales = {
      level: "country" as const,
      slug: "wales",
      parents: { continent: "europe" },
    }
    expect(placePath(wales, location)).toEqual({
      continent: "europe",
      country: "wales",
      region: "",
      area: "",
    })
    // The regions listed are England's, so Wales offers none yet.
    expect(
      placeChoices("region", placePath(wales, location), location)
    ).toEqual([])
    expect(placeName(wales, location)).toBe("Wales")
  })

  it("picks a place under the current parents, or steps back up", () => {
    const path = placePath(region, location)
    expect(pickPlace(path, "country", "wales")).toEqual({
      level: "country",
      slug: "wales",
      parents: { continent: "europe" },
    })
    expect(pickPlace(path, "region", "")).toEqual({
      level: "country",
      slug: "england",
      parents: { continent: "europe" },
    })
    expect(pickPlace(path, "continent", "")).toBeNull()
  })

  it("always offers the chosen place, named from its slug if need be", () => {
    const path = placePath(
      { level: "region", slug: "new-york", parents: { country: "usa" } },
      location
    )
    expect(placeChoices("region", path, location)).toEqual([
      { slug: "new-york", name: "New York" },
    ])
  })

  it("leaves the parents out of the search and the URL", () => {
    const state = {
      ...DEFAULT_FIND_STATE,
      place: {
        ...region,
        parents: { continent: "europe", country: "england" },
      },
    }
    expect(findQueryOf(state, "en").place).toEqual(region)
    expect(findStateToParams(state).toString()).toBe("region=hertfordshire")
  })
})

describe("findQueryOf", () => {
  it("maps type groups, the radius and the page to a search", () => {
    expect(
      findQueryOf(
        {
          ...DEFAULT_FIND_STATE,
          groups: ["academic"],
          nearLat: 1,
          nearLng: 2,
          radiusKm: 5,
          page: 3,
        },
        "en"
      )
    ).toMatchObject({
      libraryTypes: ["Academic", "University"],
      nearRadius: 5000,
      page: 3,
      hitsPerPage: 24,
      sort: "complete",
      locale: "en",
    })
  })

  it("leaves the radius off without a location", () => {
    expect(
      findQueryOf({ ...DEFAULT_FIND_STATE, radiusKm: 5 }, "en").nearRadius
    ).toBeUndefined()
  })
})

describe("openStatus", () => {
  const hours = {
    days: [
      {
        day: "saturday",
        enabled: true,
        timeframes: [{ startTime: "20:00", endTime: "21:00" }],
      },
    ],
  }
  // Sunday 00:30 UTC is Saturday 20:30 in New York.
  const now = new Date("2026-10-04T00:30:00Z")

  it("reads the library's own weekday and time", () => {
    expect(openStatus(hours, "America/New_York", now)).toEqual({
      known: true,
      open: true,
      until: "21:00",
    })
    expect(openStatus(hours, "Europe/London", now)).toEqual({
      known: true,
      open: false,
    })
    expect(openStatus(undefined, "Europe/London", now).known).toBe(false)
  })
})
