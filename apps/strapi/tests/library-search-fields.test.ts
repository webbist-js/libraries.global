import { describe, expect, it } from "vitest"

import {
  OPEN_FIELD_NAMES,
  geoCell,
  librarySearchFields,
  openFields,
} from "../src/utils/library-search-fields"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [
        { startTime: "09:30", endTime: "13:00" },
        { startTime: "14:00", endTime: "24:00" },
      ],
    },
    {
      day: "tuesday",
      enabled: false,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
    {
      day: "friday",
      enabled: true,
      timeframes: [{ startTime: "18:00", endTime: "09:00" }],
    },
  ],
}

describe("openFields", () => {
  it("stores each enabled timeframe as minutes after local midnight", () => {
    expect(openFields(hours)).toEqual({
      open_mon_0_from: 570,
      open_mon_0_to: 780,
      open_mon_1_from: 840,
      open_mon_1_to: 1440,
    })
  })

  it("names 84 fields: seven days, six timeframes, from and to", () => {
    expect(OPEN_FIELD_NAMES).toHaveLength(84)
    expect(OPEN_FIELD_NAMES).toContain("open_sun_5_to")
  })
})

describe("librarySearchFields", () => {
  it("derives the Find libraries filters", () => {
    expect(
      librarySearchFields(
        {
          completeness: 63,
          openingTimes: hours,
          timezone: "Europe/London",
          iiifEndpoint: "https://iiif.example",
          heroImage: null,
          accessibility: [{ name: "Step-free access" }],
          services: [],
        },
        51.53,
        -0.127
      )
    ).toEqual({
      completeness: 63,
      has_hours: true,
      has_iiif: true,
      needs: ["photo"],
      open_tz: "Europe/London",
      open_mon_0_from: 570,
      open_mon_0_to: 780,
      open_mon_1_from: 840,
      open_mon_1_to: 1440,
      geo_cell: "52,0",
    })
  })

  it("marks a bare record with every gap", () => {
    expect(librarySearchFields({}, null, null)).toEqual({
      completeness: 0,
      has_hours: false,
      has_iiif: false,
      needs: ["hours", "photo", "facilities"],
      open_tz: "UTC",
    })
    expect(geoCell(null, 1)).toBeNull()
  })
})
