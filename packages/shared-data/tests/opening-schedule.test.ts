import { describe, expect, it } from "vitest"

import {
  normalizeOpeningSchedule,
  validateOpeningSchedule,
  openingScheduleStatus,
  effectiveLibraryHours,
  atlasWeeklyIntervals,
  atlasHoursProjection,
} from "../index"

const block = (
  startTime = "09:00",
  endTime = "17:00",
  staffing:
    | "open"
    | "staffed"
    | "self_service"
    | "appointment"
    | "volunteer" = "open"
) => ({ id: "b", startTime, endTime, staffing })
const regular = normalizeOpeningSchedule({
  days: [{ day: "monday", enabled: true, timeframes: [block()] }],
})
const now = new Date("2026-10-12T10:00:00Z")
describe("opening schedule compatibility and evaluation", () => {
  it("preserves explicit modes and marks only missing modes as unknown staffing", () => {
    const value = normalizeOpeningSchedule({
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [
            block("09:00", "12:00", "staffed"),
            { startTime: "12:00", endTime: "17:00" },
          ],
        },
      ],
    })
    expect(value.days[0]!.timeframes.map((row) => row.staffing)).toEqual([
      "staffed",
      "open",
    ])
    expect(normalizeOpeningSchedule(value)).toEqual(value)
  })
  it("keeps invalid times and rejects them instead of fabricating a range", () => {
    const value = normalizeOpeningSchedule({
      days: [{ day: "monday", enabled: true, timeframes: [block("wrong")] }],
    })
    expect(value.days[0]!.timeframes[0]!.startTime).toBe("wrong")
    expect(validateOpeningSchedule(value)).not.toEqual([])
  })
  it("rejects overlaps, invalid calendar dates and unknown modes", () => {
    expect(
      validateOpeningSchedule({
        ...regular,
        exceptions: [{ date: "2026-02-30", timeframes: [block()] }],
      })
    ).not.toEqual([])
    expect(
      validateOpeningSchedule({
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: [block(), block("10:00", "12:00")],
          },
        ],
      })
    ).not.toEqual([])
    expect(
      validateOpeningSchedule({
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: [{ ...block(), staffing: "membership" }],
          },
        ],
      })
    ).not.toEqual([])
  })
  it("shows appointment access without indexing unrestricted opening", () => {
    const value = {
      ...regular,
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [block("09:00", "17:00", "appointment")],
        },
      ],
    }
    expect(openingScheduleStatus(value, "UTC", now).state).toBe("appointment")
    expect(atlasWeeklyIntervals(value)[0]).toEqual([])
  })
  it("changes mode at an adjacent boundary without a false closure", () => {
    const value = {
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [
            block("09:00", "12:00", "staffed"),
            block("12:00", "17:00", "self_service"),
          ],
        },
      ],
    }
    expect(
      openingScheduleStatus(value, "UTC", new Date("2026-10-12T12:00Z"))
    ).toMatchObject({ state: "open", mode: "self_service" })
    const fields = atlasHoursProjection(value, [], "UTC", now)
    expect(fields.staff_open_mon_0_to).toBe(720)
    expect(fields.open_mon_1_to).toBe(1020)
  })
  it("resolves notices, exceptions, seasons and regular hours in priority order", () => {
    const value = {
      ...regular,
      seasons: [
        {
          id: "winter",
          name: "Winter",
          from: "2026-10-01",
          to: "2027-03-31",
          days: [
            {
              day: "monday",
              enabled: true,
              timeframes: [block("10:00", "14:00")],
            },
          ],
        },
      ],
      exceptions: [
        { date: "2026-10-12", timeframes: [block("11:00", "13:00")] },
      ],
    }
    const changed = {
      documentId: "changed",
      type: "changed_hours" as const,
      from: "2026-10-12",
      to: "2026-10-12",
      hours: regular,
    }
    expect(
      (effectiveLibraryHours(value, [], "2026-10-12").hours as any).days[0]
        .timeframes[0].startTime
    ).toBe("11:00")
    expect(effectiveLibraryHours(value, [changed], "2026-10-12").hours).toEqual(
      regular
    )
    expect(
      effectiveLibraryHours(
        value,
        [
          changed,
          {
            documentId: "closure",
            type: "closure",
            from: "2026-10-12",
            to: null,
          },
        ],
        "2026-10-12"
      ).closed
    ).toBe(true)
    expect(validateOpeningSchedule(value)).toEqual([])
  })
  it("looks beyond a closed dated exception and handles flagged overnight blocks", () => {
    const value = {
      ...regular,
      exceptions: [{ date: "2026-10-12", timeframes: [] }],
    }
    expect(openingScheduleStatus(value, "UTC", now).state).toBe("closed")
    const overnight = {
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [{ ...block("22:00", "02:00"), overnight: true }],
        },
      ],
    }
    expect(validateOpeningSchedule(overnight)).toEqual([])
    expect(
      openingScheduleStatus(overnight, "UTC", new Date("2026-10-13T01:00Z"))
        .state
    ).toBe("open")
    expect(atlasWeeklyIntervals(overnight)[1]).toEqual([[0, 120]])
  })
  it("uses the library timezone at DST and treats missing timezones as unknown", () => {
    expect(openingScheduleStatus(regular, null, now).state).toBe("unknown")
    expect(openingScheduleStatus(regular, "bad-zone", now).state).toBe(
      "unknown"
    )
    expect(
      openingScheduleStatus(
        regular,
        "Europe/London",
        new Date("2026-10-12T08:30Z")
      ).state
    ).toBe("open")
    expect(
      openingScheduleStatus(
        regular,
        "Europe/London",
        new Date("2026-10-26T08:30Z")
      ).state
    ).toBe("closed")
  })
})
