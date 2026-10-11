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

  it("names 140 fields: seven days, ten timeframes, from and to", () => {
    expect(OPEN_FIELD_NAMES).toHaveLength(140)
    expect(OPEN_FIELD_NAMES).toContain("open_sun_5_to")
  })
})

describe("librarySearchFields", () => {
  it("uses date-limited changed hours in the indexed week without treating them as a closure", () => {
    const notice = {
      id: "notice",
      type: "changed_hours" as const,
      scope: "library" as const,
      scopeWeek: null,
      scopeDay: null,
      stopId: null,
      from: "2026-10-06",
      to: "2026-10-06",
      endedAt: null,
      message: "Shorter hours today",
      reason: null,
      hours: {
        days: [
          {
            day: "tuesday",
            enabled: true,
            timeframes: [{ startTime: "12:00", endTime: "14:00" }],
          },
        ],
      },
    }
    const result = librarySearchFields(
      { openingTimes: hours, timezone: "Europe/London" },
      null,
      null,
      { now: new Date("2026-10-06T12:00:00Z"), notices: [notice] }
    )
    expect(result.open_tue_0_from).toBe(720)
    expect(result.open_tue_0_to).toBe(840)
    expect(result.open_mon_0_from).toBe(570)
    expect(result.closed_dates).toEqual([])
    expect(result.notice_active).toBe(true)
    expect(result.openingTimes).toMatchObject({
      days: expect.arrayContaining([
        expect.objectContaining({ day: "tuesday", enabled: true }),
      ]),
    })
  })
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
      source: null,
      completeness: 63,
      has_hours: true,
      has_staff: false,
      stop_count: 0,
      cycle_weeks: 0,
      closed_dates: [],
      notice_active: false,
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
      source: null,
      completeness: 0,
      has_hours: false,
      has_staff: false,
      stop_count: 0,
      cycle_weeks: 0,
      closed_dates: [],
      notice_active: false,
      has_iiif: false,
      needs: ["hours", "photo", "facilities"],
      open_tz: "UTC",
    })
    expect(geoCell(null, 1)).toBeNull()
  })
})

describe("drive fields", () => {
  it("uses the stored gaps as needs", () => {
    expect(
      librarySearchFields(
        { gaps: ["hours", "contact", "bogus"], openingTimes: null },
        null,
        null
      ).needs
    ).toEqual(["hours", "contact"])
  })

  it("falls back to the three legacy needs before gaps are stored", () => {
    expect(librarySearchFields({}, null, null).needs).toEqual([
      "hours",
      "photo",
      "facilities",
    ])
  })

  it("adds created and verified timestamps in seconds", () => {
    const f = librarySearchFields(
      {
        createdAt: "2026-10-01T00:00:00.000Z",
        lastVerifiedAt: "2026-10-03T00:00:00.000Z",
        verifiedSections: { hours: "2026-10-02T00:00:00.000Z", nope: "x" },
      },
      null,
      null
    )
    expect(f.created_ts).toBe(Date.parse("2026-10-01T00:00:00.000Z") / 1000)
    expect(f.last_verified_ts).toBe(
      Date.parse("2026-10-03T00:00:00.000Z") / 1000
    )
    expect(f.verified_hours_ts).toBe(
      Date.parse("2026-10-02T00:00:00.000Z") / 1000
    )
    expect(f).not.toHaveProperty("verified_status_ts")
  })

  it("dates every section by lastVerifiedAt on a legacy row with no stamps", () => {
    const last = Date.parse("2026-10-03T00:00:00.000Z") / 1000
    for (const verifiedSections of [undefined, null, {}, { hours: "junk" }]) {
      const f = librarySearchFields(
        { lastVerifiedAt: "2026-10-03T00:00:00.000Z", verifiedSections },
        null,
        null
      )
      expect(f.last_verified_ts).toBe(last)
      expect(f.verified_hours_ts).toBe(last)
      expect(f.verified_status_ts).toBe(last)
      expect(f.verified_address_ts).toBe(last)
      expect(f.verified_contact_ts).toBe(last)
    }
  })

  it("never dates an unstamped section by lastVerifiedAt once any is stamped", () => {
    const f = librarySearchFields(
      {
        lastVerifiedAt: "2026-10-03T00:00:00.000Z",
        verifiedSections: { contact: "2026-10-03T00:00:00.000Z" },
      },
      null,
      null
    )
    expect(f.verified_contact_ts).toBe(
      Date.parse("2026-10-03T00:00:00.000Z") / 1000
    )
    expect(f).not.toHaveProperty("verified_hours_ts")
  })
})
