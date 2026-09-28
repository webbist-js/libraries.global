import { describe, expect, it } from "vitest"

import {
  buildCitation,
  distanceKm,
  formatDayList,
  formatDistance,
  hasStaffingDetail,
  type OpeningTimesValue,
  opensOn,
  recordChecklist,
  summariseHours,
  timelinePercent,
  timelineWindow,
  toLatLng,
} from "../library-page.helpers"

const day = (
  key: OpeningTimesValue["days"][number]["day"],
  ...frames: [string, string, string?][]
) => ({
  day: key,
  enabled: frames.length > 0,
  timeframes: frames.map(([startTime, endTime, staffing]) => ({
    startTime,
    endTime,
    staffing: staffing ?? null,
  })),
})

const NAILSEA: OpeningTimesValue = {
  days: [
    day("monday", ["08:00", "20:00", "self_service"]),
    day(
      "tuesday",
      ["08:00", "09:30", "self_service"],
      ["09:30", "18:00", "staffed"],
      ["18:15", "20:00", "self_service"]
    ),
    day("wednesday", ["08:00", "20:00"]),
    day("thursday", ["08:00", "20:00"]),
    day("friday", ["08:00", "20:00"]),
    day("saturday", ["08:00", "20:00"]),
    day("sunday", ["08:00", "20:00"]),
  ],
}

const WEEKDAYS: OpeningTimesValue = {
  days: [
    day("monday", ["09:00", "17:00"]),
    day("tuesday", ["09:00", "19:00"]),
    day("wednesday", ["09:00", "17:00"]),
    day("thursday", ["09:00", "19:00"]),
    day("friday", ["09:00", "17:00"]),
    day("saturday", ["10:00", "13:00"]),
    day("sunday"),
  ],
}

describe("formatDayList", () => {
  it("names runs of three or more as a range", () => {
    expect(formatDayList(["monday", "tuesday", "wednesday", "friday"])).toBe(
      "Mon–Wed, Fri"
    )
  })

  it("lists short runs day by day", () => {
    expect(formatDayList(["thursday", "tuesday"])).toBe("Tue, Thu")
  })

  it("says every day for the whole week", () => {
    expect(
      formatDayList([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ])
    ).toBe("Every day")
  })
})

describe("summariseHours", () => {
  it("reports late opening every day and Sunday hours", () => {
    expect(summariseHours(NAILSEA)).toEqual({
      lateLabel: "Open late",
      lateValue: "Every day until 20:00",
      sunday: "Open 08:00–20:00",
    })
  })

  it("names only the latest days, and a closed Sunday", () => {
    expect(summariseHours(WEEKDAYS)).toEqual({
      lateLabel: "Open late",
      lateValue: "Tue, Thu until 19:00",
      sunday: "Closed",
    })
  })

  it("falls back to the latest closing when nothing is late", () => {
    const early: OpeningTimesValue = {
      days: [
        day("monday", ["09:00", "17:00"]),
        day("friday", ["09:00", "17:30"]),
      ],
    }

    expect(summariseHours(early)?.lateLabel).toBe("Latest closing")
    expect(summariseHours(early)?.lateValue).toBe("Fri until 17:30")
  })

  it("is null without hours", () => {
    expect(summariseHours(null)).toBeNull()
    expect(summariseHours({ days: [day("monday")] })).toBeNull()
  })
})

describe("opensOn", () => {
  it("checks one day", () => {
    expect(opensOn(WEEKDAYS, "saturday")).toBe(true)
    expect(opensOn(WEEKDAYS, "sunday")).toBe(false)
  })
})

describe("timelineWindow", () => {
  it("spans the earliest opening to the latest closing", () => {
    expect(timelineWindow(NAILSEA)).toEqual({ startHour: 8, endHour: 20 })
  })

  it("widens a short day to eight hours", () => {
    const short: OpeningTimesValue = {
      days: [day("monday", ["10:00", "13:30"])],
    }

    expect(timelineWindow(short)).toEqual({ startHour: 8, endHour: 16 })
  })

  it("places times as percentages", () => {
    const w = { startHour: 8, endHour: 20 }

    expect(timelinePercent("08:00", w)).toBe(0)
    expect(timelinePercent("14:00", w)).toBe(50)
    expect(timelinePercent("23:00", w)).toBe(100)
  })
})

describe("hasStaffingDetail", () => {
  it("is true only when a self-service range is recorded", () => {
    expect(hasStaffingDetail(NAILSEA)).toBe(true)
    expect(hasStaffingDetail(WEEKDAYS)).toBe(false)
  })
})

describe("distances", () => {
  it("parses coordinates, including strings", () => {
    expect(toLatLng({ lat: "51.4", lng: -2.7 })).toEqual({
      lat: 51.4,
      lng: -2.7,
    })
    expect(toLatLng({ lat: null, lng: 1 })).toBeNull()
    expect(toLatLng(null)).toBeNull()
  })

  it("measures Nailsea to Backwell at about 2.9 km", () => {
    const km = distanceKm(
      { lat: 51.4328, lng: -2.7595 },
      { lat: 51.4144, lng: -2.7271 }
    )

    expect(km).toBeGreaterThan(2.7)
    expect(km).toBeLessThan(3.1)
  })

  it("formats metres and kilometres", () => {
    expect(formatDistance(0.648)).toBe("650 m")
    expect(formatDistance(2.94)).toBe("2.9 km")
    expect(formatDistance(38.4)).toBe("38 km")
  })
})

describe("recordChecklist", () => {
  it("counts the eight parts", () => {
    const { done, total, items } = recordChecklist({
      name: "Nailsea Library",
      streetAddress: "6–8 Colliers Walk",
      openingTimes: NAILSEA,
      openedYear: "1972",
      website: "https://n-somerset.gov.uk",
      accessibility: [],
    })

    expect(total).toBe(8)
    expect(done).toBe(5)
    expect(items.filter((i) => !i.done).map((i) => i.key)).toEqual([
      "accessibility",
      "collections",
      "photos",
    ])
  })
})

describe("buildCitation", () => {
  it("includes the reference, date and URL", () => {
    expect(
      buildCitation({
        name: "Nailsea Library",
        entityRef: "GB-ENG-0412",
        updatedAt: "2026-05-19T10:00:00Z",
        url: "https://libraries.global/en/europe/england/north-somerset/nailsea-library",
      })
    ).toBe(
      "“Nailsea Library.” Libraries Global, record GB-ENG-0412, updated 19 May 2026. https://libraries.global/en/europe/england/north-somerset/nailsea-library"
    )
  })

  it("leaves out what it doesn't have", () => {
    expect(buildCitation({ name: "X", url: "https://x" })).toBe(
      "“X.” Libraries Global. https://x"
    )
  })
})
