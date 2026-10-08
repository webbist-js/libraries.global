import type { MobileTimetable, TimetableNotice } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { foldCalendarLine, localTimeToUtc, mobileCalendar } from "../calendar"

const tt: MobileTimetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [
    {
      id: "stop000001",
      name: "Green, East",
      where: "Outside; café",
      location: null,
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "mon",
      arrive: "09:30",
      depart: "10:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const notice: TimetableNotice = {
  id: "closed",
  type: "not_running",
  scope: "stop",
  scopeWeek: null,
  scopeDay: null,
  stopId: "stop000001",
  from: "2026-10-12",
  to: "2026-10-12",
  endedAt: null,
  message: "Cancelled",
  reason: "breakdown",
}
describe("mobile calendar", () => {
  it("keeps local times across daylight saving", () => {
    expect(
      localTimeToUtc("2026-10-19", "09:30", "Europe/London").toISOString()
    ).toBe("2026-10-19T08:30:00.000Z")
    expect(
      localTimeToUtc("2026-10-26", "09:30", "Europe/London").toISOString()
    ).toBe("2026-10-26T09:30:00.000Z")
    expect(
      localTimeToUtc("2026-10-19", "09:30", "Asia/Kathmandu").toISOString()
    ).toBe("2026-10-19T03:45:00.000Z")
  })
  it("exports cancellations with stable visit UIDs and escaped text", () => {
    const args = {
      id: "library",
      name: "Bus",
      timetable: tt,
      notices: [notice],
      stopId: "stop000001",
      timezone: "Europe/London",
      from: "2026-10-06",
      updatedAt: "2026-10-06T12:00:00Z",
    }
    const output = mobileCalendar(args)
    expect(output).toContain(
      "UID:library-visit00001-2026-10-12@libraries.global\r\n"
    )
    expect(output).toContain("STATUS:CANCELLED\r\n")
    expect(output).toContain(String.raw`Green\, East`)
    expect(output).toContain(String.raw`Outside\; café`)
    expect(output).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT12H")
    expect(mobileCalendar(args)).toBe(output)
    expect(output).not.toContain("2026-04-")
  })
  it("folds without splitting UTF-8 characters or exceeding 75 octets", () => {
    const line = "DESCRIPTION:" + "é".repeat(100)
    const folded = foldCalendarLine(line)
    expect(folded.replaceAll("\r\n ", "")).toBe(line)
    expect(
      folded
        .split("\r\n")
        .every((part) => new TextEncoder().encode(part).length <= 75)
    ).toBe(true)
  })
})
