import type { MobileTimetable, PublicLiveState } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { NOT_STOPPING_TODAY, publicLiveCopy } from "../live-copy"

const tt = {
  stops: [
    { id: "s1", name: "Village hall" },
    { id: "s2", name: "Market square" },
  ],
} as unknown as MobileTimetable

const base: PublicLiveState = {
  libraryDocumentId: "lib",
  kind: "timetable",
  sharesLive: true,
  stopId: null,
  nextStopId: null,
  until: null,
  scheduledAt: null,
  expectedAt: null,
  delayMin: 0,
  noticeMessage: null,
  nextService: null,
  position: null,
  skippedStopIds: [],
  updatedAt: null,
}
const TODAY = "2026-10-06" // a Tuesday
const nextService = { date: "2026-10-07", stopId: "s1", arrive: "09:30" }

describe("publicLiveCopy", () => {
  it("here: the stop and when it leaves, pulsing", () => {
    const copy = publicLiveCopy(
      { ...base, kind: "here", stopId: "s1", until: "10:30" },
      tt
    )
    expect(copy).toMatchObject({
      label: "Here now",
      sentence: "At Village hall until 10:30.",
      tone: "ok",
      pulse: true,
    })
  })

  it("names skipped stops, one or many, as not stopping today", () => {
    const one = publicLiveCopy(
      { ...base, kind: "here", stopId: "s1", skippedStopIds: ["s2"] },
      tt
    )
    expect(one.sentence).toBe(
      "At Village hall until the next stop. Market square: not stopping today."
    )
    const many = publicLiveCopy(
      {
        ...base,
        kind: "road",
        nextStopId: "s2",
        expectedAt: "11:05",
        skippedStopIds: ["s1", "s2"],
      },
      tt
    )
    expect(many.sentence).toBe(
      `Heading to Market square, about 11:05. 2 stops: ${NOT_STOPPING_TODAY.toLowerCase()}.`
    )
  })

  it("road: heading to the next stop", () => {
    const copy = publicLiveCopy(
      { ...base, kind: "road", nextStopId: "s2", expectedAt: "11:05" },
      tt
    )
    expect(copy).toMatchObject({
      label: "On the road",
      sentence: "Heading to Market square, about 11:05.",
      tone: "info",
      pulse: false,
    })
  })

  it("late: the delay, the expected time and the timetabled one", () => {
    const copy = publicLiveCopy(
      {
        ...base,
        kind: "late",
        delayMin: 12,
        nextStopId: "s2",
        expectedAt: "11:17",
        scheduledAt: "11:05",
      },
      tt
    )
    expect(copy.label).toBe("12 min late")
    expect(copy.sentence).toBe(
      "Expected at Market square about 11:17 (timetable 11:05)."
    )
    expect(copy.tone).toBe("warn")
  })

  it("not running: the notice's own words, else the next service", () => {
    expect(
      publicLiveCopy(
        { ...base, kind: "notrunning", noticeMessage: "Van off the road." },
        tt
      )
    ).toMatchObject({
      label: "Not running today",
      sentence: "Van off the road.",
      tone: "danger",
    })
    expect(
      publicLiveCopy({ ...base, kind: "notrunning", nextService }, tt, {
        today: TODAY,
      }).sentence
    ).toBe(
      "This mobile library is not running for the rest of today. Next: Tomorrow, Village hall at 09:30."
    )
  })

  it("stale: minutes since the last update and the next scheduled stop", () => {
    const now = new Date("2026-10-06T10:20:00Z")
    const copy = publicLiveCopy(
      {
        ...base,
        kind: "stale",
        updatedAt: "2026-10-06T10:00:00Z",
        nextService: { date: TODAY, stopId: "s2", arrive: "13:30" },
      },
      tt,
      { today: TODAY, now }
    )
    expect(copy.label).toBe("Timetable")
    expect(copy.tone).toBe("neutral")
    expect(copy.sentence).toMatch(
      /^No update for 20 minutes, so we.re showing the timetable\./
    )
    expect(copy.sentence).toContain(
      "Next scheduled stop: Market square at 13:30."
    )
    expect(copy.sentence).not.toContain("(Today)")
  })

  it("stale: says over 15 minutes without a clock, and the day for a later service", () => {
    const copy = publicLiveCopy(
      {
        ...base,
        kind: "stale",
        updatedAt: "2026-10-06T10:00:00Z",
        nextService,
      },
      tt,
      { today: TODAY }
    )
    expect(copy.sentence).toMatch(/^The last update was over 15 minutes ago/)
    expect(copy.sentence).toContain(
      "Next scheduled stop: Village hall at 09:30 (Tomorrow)."
    )
  })

  it("finished: the next service on a weekday or a date", () => {
    expect(
      publicLiveCopy(
        {
          ...base,
          kind: "finished",
          nextService: { ...nextService, date: "2026-10-08" },
        },
        tt,
        { today: TODAY }
      )
    ).toMatchObject({
      label: "Finished for today",
      sentence: "Finished for today. Next: Thursday, Village hall at 09:30.",
    })
    expect(
      publicLiveCopy(
        {
          ...base,
          kind: "finished",
          nextService: { ...nextService, date: "2026-10-20" },
        },
        tt,
        { today: TODAY }
      ).sentence
    ).toBe("Finished for today. Next: Tue 20 Oct, Village hall at 09:30.")
    expect(publicLiveCopy({ ...base, kind: "finished" }, tt).sentence).toBe(
      "Finished for today."
    )
  })

  it("timetable: says whether live updates are expected, and falls back for unknown stops", () => {
    expect(
      publicLiveCopy(
        { ...base, nextService: { ...nextService, stopId: "gone" } },
        tt
      ).sentence
    ).toBe(
      "No live updates yet today. Showing the timetable. Next: Wednesday, the next stop at 09:30."
    )
    expect(publicLiveCopy({ ...base, sharesLive: false }, tt)).toMatchObject({
      label: "Timetable",
      sentence: "Times are the published timetable.",
      icon: "mdi:calendar",
      pulse: false,
    })
  })
})
