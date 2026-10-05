import { describe, expect, it } from "vitest"

import type { OpeningTimesValue } from "@/components/library/library-page.helpers"

import {
  describeGaps,
  GAP_DEFS,
  groupScreenPoints,
  lowerFirst,
  pickNearby,
  placeLabels,
  pluralizeLabel,
  recordGaps,
  regionHelpBody,
  singularizeLabel,
  summariseWeek,
} from "../location-page.helpers"

const week = (
  hours: Partial<Record<string, [string, string] | null>>
): OpeningTimesValue => ({
  days: (
    [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ] as const
  ).map((day) => {
    const h = hours[day]

    return {
      day,
      enabled: Boolean(h),
      timeframes: h ? [{ startTime: h[0], endTime: h[1] }] : [],
    }
  }),
})

describe("labels", () => {
  it("pluralises and singularises region type labels", () => {
    expect(pluralizeLabel("County")).toBe("Counties")
    expect(pluralizeLabel("Authority")).toBe("Authorities")
    expect(pluralizeLabel("Region")).toBe("Regions")
    expect(pluralizeLabel("Council area")).toBe("Council areas")
    expect(singularizeLabel("Counties")).toBe("County")
    expect(singularizeLabel("Council areas")).toBe("Council area")
    expect(singularizeLabel("Länder")).toBe("Länder")
  })

  it("keeps proper nouns capitalised mid-sentence", () => {
    expect(lowerFirst("County")).toBe("county")
    expect(lowerFirst("London Borough")).toBe("London Borough")
  })

  it("lets a Region name its own Areas, over the country's", () => {
    const england = {
      regionTypeLabel: "County",
      regionsSectionLabel: "Counties",
      areaTypeLabel: "District",
      areasSectionLabel: "Districts",
    }
    const london = { areaTypeLabel: "Borough", areasSectionLabel: "Boroughs" }
    expect(placeLabels(england, london)).toEqual({
      region: { name: "County", plural: "Counties", singular: "county" },
      area: { name: "Borough", plural: "Boroughs", singular: "borough" },
    })
    expect(
      placeLabels(england, { areaTypeLabel: " ", areasSectionLabel: null }).area
        .name
    ).toBe("District")
    expect(placeLabels(england, null).area.name).toBe("District")
  })

  it("derives what a country calls its Regions and Areas", () => {
    expect(
      placeLabels({ regionTypeLabel: "Canton", areaTypeLabel: "District" })
    ).toEqual({
      region: { name: "Canton", plural: "Cantons", singular: "canton" },
      area: { name: "District", plural: "Districts", singular: "district" },
    })
    expect(
      placeLabels({
        regionsSectionLabel: "Council areas",
        regionTypeLabel: "Authority",
      }).region
    ).toEqual({
      name: "Council area",
      plural: "Council areas",
      singular: "council area",
    })
    expect(
      placeLabels({ areasSectionLabel: "Local government areas" }).area
    ).toEqual({
      name: "Local government area",
      plural: "Local government areas",
      singular: "local government area",
    })
  })

  it("falls back to Region and Area", () => {
    const fallback = {
      region: { name: "Region", plural: "Regions", singular: "region" },
      area: { name: "Area", plural: "Areas", singular: "area" },
    }
    expect(placeLabels({})).toEqual(fallback)
    expect(placeLabels(null)).toEqual(fallback)
    expect(
      placeLabels({
        regionTypeLabel: "County / Unitary Authority / London Borough",
      }).region
    ).toEqual(fallback.region)
  })
})

describe("summariseWeek", () => {
  it("returns null when no hours are recorded", () => {
    expect(summariseWeek(null)).toBeNull()
    expect(summariseWeek(week({}))).toBeNull()
  })

  it("groups consecutive days with the same hours", () => {
    const nineToFive: [string, string] = ["09:00", "17:00"]
    expect(
      summariseWeek(
        week({
          monday: nineToFive,
          tuesday: nineToFive,
          wednesday: nineToFive,
          thursday: nineToFive,
          friday: nineToFive,
          saturday: ["10:00", "13:00"],
        })
      )
    ).toBe("Mon–Fri 09:00–17:00 · Sat 10:00–13:00")
    expect(summariseWeek(week({ monday: ["09:30", "17:30"] }))).toBe(
      "Mon 09:30–17:30"
    )
  })

  it("collapses varied weeks to the open days", () => {
    expect(
      summariseWeek(
        week({
          monday: ["13:00", "18:00"],
          tuesday: ["10:00", "18:00"],
          wednesday: ["10:00", "17:00"],
          friday: ["10:00", "16:00"],
          saturday: ["10:00", "16:00"],
        })
      )
    ).toBe("Open Mon–Wed, Fri–Sat · hours vary by day")
  })
})

describe("recordGaps", () => {
  it("lists the visitor-facing gaps in a fixed order", () => {
    const gaps = recordGaps({
      openingTimes: week({ monday: ["09:00", "17:00"] }),
      accessibility: [],
      website: null,
    })
    expect(gaps).toEqual(["photo", "accessibility", "contact"])
    expect(describeGaps(gaps)).toBe(
      "a photo, accessibility details and contact details"
    )
  })

  it("is empty for a complete record", () => {
    expect(
      recordGaps({
        heroImage: { url: "/x.jpg" },
        openingTimes: week({ monday: ["09:00", "17:00"] }),
        accessibility: [{}],
        website: "https://example.org",
      })
    ).toEqual([])
  })

  it("shows location pages the four gaps visitors need first", () => {
    expect(GAP_DEFS.map((g) => g.key)).toEqual([
      "hours",
      "photo",
      "accessibility",
      "contact",
    ])
    expect(recordGaps({ absentFacilities: ["Hearing loop"] })).not.toContain(
      "accessibility"
    )
  })
})

/** A loaded record for the help text: its name and location gaps. */
const loadedLib = (name: string, gaps: ("hours" | "photo" | "contact")[]) => ({
  name,
  gaps,
})

describe("regionHelpBody", () => {
  const add = "Start there, or add another library."

  describe("with search counts", () => {
    it("reads the counts even when the loaded records have no gaps", () => {
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [loadedLib("A", []), loadedLib("B", [])],
          gapCounts: { total: 300, gaps: { hours: 40, photo: 90, contact: 5 } },
        })
      ).toBe(
        `Libraries here are most often missing a photo and opening hours. ${add}`
      )
    })

    it("never names one loaded record while the counts cover many", () => {
      const body = regionHelpBody({
        placeName: "York",
        loaded: [loadedLib("A", ["hours"]), loadedLib("B", [])],
        gapCounts: { total: 300, gaps: { hours: 120 } },
      })
      expect(body).toBe(
        `Libraries here are most often missing opening hours. ${add}`
      )
      expect(body).not.toContain("A’s record")
    })

    it("says every record has its core details only when the counts do", () => {
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [loadedLib("A", ["hours"])],
          gapCounts: { total: 300, gaps: { location: 4 } },
        })
      ).toBe(
        "Every record here has its core details. Know a library that’s missing? Add it and we’ll review it."
      )
    })

    it("names the only library from its counted gaps", () => {
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [loadedLib("A", [])],
          gapCounts: { total: 1, gaps: { photo: 1, hours: 1 } },
        })
      ).toBe(`A’s record is missing opening hours and a photo. ${add}`)
    })

    it("asks for a library when the counts find none", () => {
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [],
          gapCounts: { total: 0, gaps: {} },
        })
      ).toBe(
        "Know a library in York? Add it with a source and a reviewer will check it before it’s published."
      )
    })
  })

  describe("without search counts", () => {
    it("reads the loaded records", () => {
      expect(
        regionHelpBody({ placeName: "York", loaded: [], gapCounts: null })
      ).toContain("Know a library in York?")
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [loadedLib("A", [])],
          gapCounts: null,
        })
      ).toContain("Every record here has its core details.")
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [loadedLib("A", ["photo", "contact"]), loadedLib("B", [])],
          gapCounts: null,
        })
      ).toBe(`A’s record is missing a photo and contact details. ${add}`)
      expect(
        regionHelpBody({
          placeName: "York",
          loaded: [
            loadedLib("A", ["photo"]),
            loadedLib("B", ["photo", "hours"]),
            loadedLib("C", []),
          ],
          gapCounts: null,
        })
      ).toBe(
        `2 of 3 records here are missing details, most often a photo and opening hours. ${add}`
      )
    })
  })
})

describe("pickNearby", () => {
  const herts = { lat: 51.8, lng: -0.2 }
  const siblings = [
    {
      name: "Greater London",
      libraryCount: 5,
      center: { lat: 51.5, lng: -0.1 },
    },
    { name: "Bedfordshire", libraryCount: 0, center: { lat: 52, lng: -0.4 } },
    { name: "Essex", libraryCount: 1, center: { lat: 51.8, lng: 0.6 } },
    { name: "Cornwall", libraryCount: 2, center: { lat: 50.3, lng: -4.9 } },
    { name: "Nowhere", libraryCount: 3, center: null },
  ]

  it("prefers the nearest siblings with libraries", () => {
    const { mode, items } = pickNearby(herts, siblings, 2)
    expect(mode).toBe("nearby")
    expect(items.map((s) => s.name)).toEqual(["Greater London", "Essex"])
  })

  it("falls back to the busiest siblings without a centre", () => {
    const { mode, items } = pickNearby(null, siblings, 2)
    expect(mode).toBe("most")
    expect(items.map((s) => s.name)).toEqual(["Greater London", "Nowhere"])
  })
})

describe("groupScreenPoints", () => {
  it("groups points within the radius around the heaviest", () => {
    const groups = groupScreenPoints(
      [
        { id: "a", x: 0, y: 0, weight: 3 },
        { id: "b", x: 10, y: 0, weight: 1 },
        { id: "c", x: 100, y: 0, weight: 2 },
      ],
      20
    )
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ ids: ["a", "b"], weight: 4 })
    expect(groups[0]!.x).toBeCloseTo(2.5)
    expect(groups[1]).toMatchObject({ ids: ["c"], x: 100, weight: 2 })
  })
})
