import { describe, expect, it } from "vitest"

import {
  computeCompleteness,
  formatCoordinates,
  formatDayTimes,
  getOpenStatus,
  type OpeningTimesValue,
} from "../library-page.helpers"

const HOURS: OpeningTimesValue = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
    {
      day: "tuesday",
      enabled: true,
      timeframes: [
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "13:00", endTime: "20:00" },
      ],
    },
    { day: "wednesday", enabled: false, timeframes: [] },
    {
      day: "thursday",
      enabled: true,
      timeframes: [{ startTime: "10:00", endTime: "16:00" }],
    },
    { day: "friday", enabled: false, timeframes: [] },
    { day: "saturday", enabled: false, timeframes: [] },
    { day: "sunday", enabled: false, timeframes: [] },
  ],
}

// 2026-09-21 is a Monday. Use UTC times with the UTC zone for determinism.
const monday10 = new Date("2026-09-21T10:00:00Z")
const monday18 = new Date("2026-09-21T18:00:00Z")
const tuesday1230 = new Date("2026-09-22T12:30:00Z")
const wednesday12 = new Date("2026-09-23T12:00:00Z")

describe("getOpenStatus", () => {
  it("reports open with today's closing time", () => {
    expect(getOpenStatus(HOURS, "UTC", monday10)).toEqual({
      state: "open",
      label: "Open until 17:00 today",
    })
  })

  it("reports closed after hours with next opening (tomorrow)", () => {
    expect(getOpenStatus(HOURS, "UTC", monday18)).toEqual({
      state: "closed",
      label: "Closed · opens 09:00 tomorrow",
    })
  })

  it("handles a midday gap between timeframes", () => {
    expect(getOpenStatus(HOURS, "UTC", tuesday1230)).toEqual({
      state: "closed",
      label: "Closed · opens 13:00 today",
    })
  })

  it("skips disabled days when finding the next opening", () => {
    expect(getOpenStatus(HOURS, "UTC", wednesday12)).toEqual({
      state: "closed",
      label: "Closed · opens 10:00 tomorrow",
    })
  })

  it("returns unknown when no hours exist", () => {
    expect(getOpenStatus(null, "UTC").state).toBe("unknown")
    expect(getOpenStatus({ days: [] }, "UTC").state).toBe("unknown")
    expect(
      getOpenStatus(
        { days: [{ day: "monday", enabled: false, timeframes: [] }] },
        "UTC"
      ).state
    ).toBe("unknown")
  })
})

describe("formatDayTimes", () => {
  it("formats single and multiple timeframes", () => {
    expect(formatDayTimes(HOURS.days[0])).toBe("09:00–17:00")
    expect(formatDayTimes(HOURS.days[1])).toBe("09:00–12:00, 13:00–20:00")
    expect(formatDayTimes(HOURS.days[2])).toBe("Closed")
  })
})

describe("formatCoordinates", () => {
  it("formats N/E and S/W hemispheres", () => {
    expect(formatCoordinates({ lat: 51.5299, lng: -0.1277 })).toBe(
      "51.5299° N, 0.1277° W"
    )
    expect(formatCoordinates({ lat: -33.8688, lng: 151.2093 })).toBe(
      "33.8688° S, 151.2093° E"
    )
    expect(formatCoordinates(null)).toBeNull()
  })
})

describe("computeCompleteness", () => {
  it("counts filled sections", () => {
    const { filled, total } = computeCompleteness({
      openingTimes: HOURS,
      streetAddress: "1 High St",
      location: { lat: 1, lng: 2 },
      website: "https://example.org",
    })
    expect(total).toBe(8)
    expect(filled).toBe(4) // hours, address, location, contact
  })
})
