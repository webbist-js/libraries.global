import {
  COMPLETENESS_GAP_KEYS,
  completenessOf,
  GAP_KEYS,
  gapsOf,
  hasOpeningHours,
  isGapKey,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

const full = {
  heroImage: { id: 1 },
  openingTimes: hours,
  streetAddress: "96 Euston Road",
  location: { lat: 51.53, lng: -0.127 },
  accessibility: [{ id: 1 }],
  services: [{ id: 2 }],
  amenities: [],
  summary: "The national library of the UK.",
  foundedYear: "1973",
  website: "https://www.bl.uk",
}

describe("gap registry", () => {
  it("lists the ten keys, eight of them counted by completeness", () => {
    expect(GAP_KEYS).toEqual([
      "photo",
      "hours",
      "address",
      "location",
      "facilities",
      "about",
      "history",
      "contact",
      "accessibility",
      "services",
    ])
    expect(COMPLETENESS_GAP_KEYS).toEqual(GAP_KEYS.slice(0, 8))
    expect(isGapKey("hours")).toBe(true)
    expect(isGapKey("name")).toBe(false)
  })

  it("finds every gap in a bare record", () => {
    expect(gapsOf({})).toEqual(GAP_KEYS)
    expect(completenessOf({})).toMatchObject({
      filled: 0,
      total: 8,
      percent: 0,
    })
  })

  it("finds none in a full record", () => {
    expect(gapsOf(full)).toEqual([])
    expect(completenessOf(full).percent).toBe(100)
  })

  it("needs an enabled day with a whole timeframe for hours", () => {
    expect(hasOpeningHours(hours)).toBe(true)
    expect(
      hasOpeningHours({
        days: [{ day: "monday", enabled: false, timeframes: [] }],
      })
    ).toBe(false)
    expect(
      hasOpeningHours({
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: [{ startTime: "09:00", endTime: "" }],
          },
        ],
      })
    ).toBe(false)
    expect(hasOpeningHours(null)).toBe(false)
  })

  it("counts a confirmed No as an accessibility answer", () => {
    expect(gapsOf({ absentFacilities: ["Step-free entrance"] })).not.toContain(
      "accessibility"
    )
    // Wi-Fi is an amenity question, not an accessibility one.
    expect(gapsOf({ absentFacilities: ["Wi-Fi"] })).toContain("accessibility")
  })

  it("keeps facilities as any of accessibility, services or amenities", () => {
    const g = gapsOf({ amenities: [{ id: 3 }] })
    expect(g).not.toContain("facilities")
    expect(g).not.toContain("services")
    expect(g).toContain("accessibility")
  })

  it("scores completeness as the share of the eight sections", () => {
    // photo, hours, address, location filled: 4 of 8.
    expect(
      completenessOf({
        heroImage: { id: 1 },
        openingTimes: hours,
        streetAddress: "1 High St",
        location: { lat: 1, lng: 1 },
      })
    ).toMatchObject({ filled: 4, total: 8, percent: 50 })
    // Blank strings are not content.
    expect(completenessOf({ streetAddress: "  ", website: "" }).filled).toBe(0)
  })
})
