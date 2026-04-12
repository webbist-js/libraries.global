import { describe, expect, it } from "vitest"

import {
  cloneTimeframe,
  createDefaultOpeningTimesValue,
  findOverlappingTimeframeIndexes,
  normalizeOpeningTimesValue,
} from "../src/customFields/openingTimes/shared"

describe("opening times helpers", () => {
  it("creates a default value with all seven days", () => {
    const value = createDefaultOpeningTimesValue()

    expect(value.days).toHaveLength(7)
    expect(value.days.every((day) => day.enabled === false)).toBe(true)
  })

  it("normalizes and sorts persisted day data", () => {
    const value = normalizeOpeningTimesValue({
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [
            {
              endTime: "18:00",
              id: "second",
              staffing: "volunteer",
              startTime: "14:00",
            },
            {
              endTime: "12:00",
              id: "first",
              staffing: "staffed",
              startTime: "09:00",
            },
          ],
        },
      ],
    })

    expect(value.days[0]).toMatchObject({
      day: "monday",
      enabled: true,
    })
    expect(value.days[0]?.timeframes.map((timeframe) => timeframe.id)).toEqual([
      "first",
      "second",
    ])
    expect(value.days[1]?.day).toBe("tuesday")
  })

  it("detects overlapping timeframes in a sorted day", () => {
    const overlaps = findOverlappingTimeframeIndexes([
      cloneTimeframe({
        startTime: "09:00",
        endTime: "12:00",
        staffing: "staffed",
      }),
      cloneTimeframe({
        startTime: "11:30",
        endTime: "14:00",
        staffing: "self_service",
      }),
      cloneTimeframe({
        startTime: "14:00",
        endTime: "16:00",
        staffing: "volunteer",
      }),
    ])

    expect([...overlaps]).toEqual([0, 1])
  })
})
