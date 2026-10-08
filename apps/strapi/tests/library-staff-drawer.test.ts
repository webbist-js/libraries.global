import type { MobileTimetable } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import {
  driveNeed,
  nextRouteOf,
} from "../src/plugins/library-staff/server/drawer-service"

/**
 * The staff drawer's "next route" for a Mobile library: the first visit
 * still ahead in the library's zone, across the whole cycle, never a
 * visit that has already begun today.
 */

const stop = (id: string, name: string) => ({
  id,
  name,
  where: "",
  location: { lat: 51, lng: 0 },
  areaDocumentId: null,
})
const visit = (
  id: string,
  stopId: string,
  day: string,
  arrive: string,
  depart: string,
  weeks: number[]
) => ({
  id,
  stopId,
  day,
  arrive,
  depart,
  repeat: { kind: "cycle", weeks },
  termTimeOnly: false,
  validFrom: null,
  validTo: null,
})
// A two-week cycle from Monday 2026-10-05: Tue 2026-10-06 is week 1, Thu
// 2026-10-15 is week 2.
const tt = {
  version: 1,
  cycle: { weeks: 2, anchor: "2026-10-05" },
  stops: [stop("stop000001", "Village green"), stop("stop000002", "Harbour")],
  visits: [
    visit("visit00001", "stop000001", "tue", "09:30", "10:00", [1]),
    visit("visit00002", "stop000002", "tue", "22:30", "23:00", [1]),
    visit("visit00003", "stop000001", "thu", "13:00", "14:00", [2]),
  ],
} as unknown as MobileTimetable
const at = (iso: string) => new Date(iso)
/** A "not running" notice for one stop on one day. */
const cancelled = (stopId: string, date: string) =>
  ({
    id: "notice0001",
    type: "not_running",
    scope: "stop",
    scopeWeek: null,
    scopeDay: null,
    stopId,
    from: date,
    to: date,
    endedAt: null,
    message: "Road closed",
    reason: "other",
  }) as any

describe("nextRouteOf", () => {
  it("skips today's visits that have already begun and points at the one still ahead", () => {
    // 21:20: the morning's 09:30 has long started; the 22:30 stop is next.
    expect(nextRouteOf(tt, [], at("2026-10-06T21:20:00Z"), "UTC")).toEqual({
      date: "2026-10-06",
      time: "22:30",
    })
    // Exactly at 09:30 the visit has begun: the evening stop is next.
    expect(nextRouteOf(tt, [], at("2026-10-06T09:30:00Z"), "UTC")).toEqual({
      date: "2026-10-06",
      time: "22:30",
    })
    // 09:29: the morning stop is still ahead.
    expect(nextRouteOf(tt, [], at("2026-10-06T09:29:00Z"), "UTC")).toEqual({
      date: "2026-10-06",
      time: "09:30",
    })
  })

  it("looks across the cycle once today is over: the week-2 Thursday, not next Tuesday's week-1 stop", () => {
    expect(nextRouteOf(tt, [], at("2026-10-06T23:30:00Z"), "UTC")).toEqual({
      date: "2026-10-15",
      time: "13:00",
    })
    // From the Thursday evening of week 2, the next is week 1's Tuesday.
    expect(nextRouteOf(tt, [], at("2026-10-15T15:00:00Z"), "UTC")).toEqual({
      date: "2026-10-20",
      time: "09:30",
    })
  })

  it("reads the clock in the library's zone", () => {
    // 21:35Z is 22:35 in London (BST): the 22:30 stop has begun.
    expect(
      nextRouteOf(tt, [], at("2026-10-06T21:35:00Z"), "Europe/London")
    ).toEqual({ date: "2026-10-15", time: "13:00" })
    expect(
      nextRouteOf(tt, [], at("2026-10-06T21:20:00Z"), "Europe/London")
    ).toEqual({ date: "2026-10-06", time: "22:30" })
  })

  it("passes over a visit a notice cancels, and is null with no visits ahead", () => {
    expect(
      nextRouteOf(
        tt,
        [cancelled("stop000002", "2026-10-06")],
        at("2026-10-06T21:20:00Z"),
        "UTC"
      )
    ).toEqual({ date: "2026-10-15", time: "13:00" })
    const empty = { ...tt, visits: [] } as MobileTimetable
    expect(nextRouteOf(empty, [], at("2026-10-06T21:20:00Z"), "UTC")).toBeNull()
  })
})

describe("driveNeed", () => {
  it("phrases what the drive asks of this library, or null when it needs nothing", () => {
    expect(driveNeed(null, ["hours"])).toBeNull()
    expect(
      driveNeed({ kind: "gaps", gaps: ["photo", "hours"] } as any, ["hours"])
    ).toEqual(expect.any(String))
    expect(
      driveNeed({ kind: "gaps", gaps: ["photo"] } as any, ["hours"])
    ).toBeNull()
    expect(
      driveNeed({ kind: "verify", sections: ["hours", "status"] } as any, [])
    ).toBe("a fresh check of its hours, status")
    expect(driveNeed({ kind: "completeness" } as any, [])).toBe(
      "a more complete record"
    )
  })
})
