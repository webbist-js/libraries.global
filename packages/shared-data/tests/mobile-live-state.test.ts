import { describe, expect, it } from "vitest"

import {
  publicLiveState,
  type LiveSessionSnapshot,
} from "../mobile-timetable/live-state"
import type {
  MobileTimetable,
  TimetableNotice,
} from "../mobile-timetable/types"

const tt: MobileTimetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [
    {
      id: "stop000001",
      name: "One",
      where: "",
      location: null,
      areaDocumentId: null,
    },
    {
      id: "stop000002",
      name: "Two",
      where: "",
      location: null,
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "tue",
      arrive: "09:00",
      depart: "09:30",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
    {
      id: "visit00002",
      stopId: "stop000002",
      day: "tue",
      arrive: "10:00",
      depart: "10:30",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const session: LiveSessionSnapshot = {
  status: "active",
  endReason: null,
  serviceDate: "2026-10-06",
  phase: "at_stop",
  currentStopId: "stop000001",
  nextStopId: "stop000002",
  delayMin: 0,
  skipped: [],
  lastEventAt: "2026-10-06T09:05:00Z",
  publishedPosition: { lat: 51, lng: 0 },
}
const state = (
  override: Partial<LiveSessionSnapshot> = {},
  notices: TimetableNotice[] = [],
  now = new Date("2026-10-06T09:06:00Z")
) =>
  publicLiveState({
    libraryDocumentId: "mobile",
    tt,
    notices,
    session: { ...session, ...override },
    sharesLive: true,
    now,
    tz: "UTC",
  })
describe("public live states", () => {
  it("covers check-ins, delays, stale, finish and timetable without leaking a position at stops", () => {
    expect(state()).toMatchObject({
      kind: "here",
      stopId: "stop000001",
      until: "09:30",
      position: null,
    })
    expect(state({ phase: "between" })).toMatchObject({
      kind: "road",
      expectedAt: "10:00",
      position: { lat: 51, lng: 0 },
    })
    expect(state({ phase: "between", delayMin: 15 })).toMatchObject({
      kind: "late",
      scheduledAt: "10:00",
      expectedAt: "10:15",
    })
    expect(state({}, [], new Date("2026-10-06T09:20:00Z"))).toMatchObject({
      kind: "stale",
      position: null,
    })
    expect(state({ status: "ended", endReason: "manual" })).toMatchObject({
      kind: "finished",
      position: null,
    })
    expect(state({ status: "ended", endReason: "breakdown" })).toMatchObject({
      kind: "notrunning",
      position: null,
    })
    expect(state({ status: "ended", endReason: "revoked" })).toMatchObject({
      kind: "timetable",
      position: null,
    })
    expect(
      publicLiveState({
        libraryDocumentId: "mobile",
        tt,
        notices: [],
        session,
        sharesLive: false,
        now: new Date("2026-10-06T09:06:00Z"),
        tz: "UTC",
      })
    ).toMatchObject({ kind: "timetable", position: null })
  })
  it("a not-running notice takes precedence over a check-in and includes its message", () => {
    const notice: TimetableNotice = {
      id: "n",
      type: "not_running",
      scope: "service",
      scopeWeek: null,
      scopeDay: null,
      stopId: null,
      from: "2026-10-06",
      to: "2026-10-06",
      endedAt: null,
      message: "Off the road today",
      reason: "breakdown",
    }
    expect(state({}, [notice])).toMatchObject({
      kind: "notrunning",
      noticeMessage: "Off the road today",
      position: null,
    })
  })
  it("ignores yesterday's session and supports a swapped route on an unscheduled day", () => {
    expect(state({ serviceDate: "2026-10-05" })).toMatchObject({
      kind: "timetable",
      position: null,
    })
    const now = new Date("2026-10-07T09:06:00Z")
    expect(
      state(
        {
          serviceDate: "2026-10-07",
          lastEventAt: now.toISOString(),
          route: [
            {
              date: "2026-10-07",
              visitId: "visit00001",
              stopId: "stop000001",
              arrive: "09:00",
              depart: "09:30",
              cancelledBy: null,
            },
          ],
        },
        [],
        now
      )
    ).toMatchObject({ kind: "here", until: "09:30" })
  })
})
