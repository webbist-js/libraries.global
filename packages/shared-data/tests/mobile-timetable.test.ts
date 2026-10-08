import { describe, expect, it } from "vitest"

import {
  addDays,
  cancelledDates,
  cycleWeekOf,
  dayRoute,
  describeRepeat,
  diffTimetable,
  emptyTimetable,
  epochWeek,
  hasErrors,
  importTimetableSpreadsheet,
  isStaleTimetableSuggestion,
  spreadsheetRows,
  localDateTime,
  nextVisits,
  normalizeMobileTimetable,
  occurrences,
  scheduleState,
  stopKeys,
  summarizeDiff,
  timetableHash,
  todayKeys,
  validateMobileTimetable,
  weekFrames,
  WEEKDAYS,
  type MobileTimetable,
  type MobileVisit,
  type TimetableNotice,
} from "../mobile-timetable"

const visit = (patch: Partial<MobileVisit> = {}): MobileVisit => ({
  id: "visit00001",
  stopId: "stop000001",
  day: "mon",
  arrive: "09:30",
  depart: "10:00",
  repeat: { kind: "cycle", weeks: [1] },
  termTimeOnly: false,
  validFrom: null,
  validTo: null,
  ...patch,
})
const timetable = (visits = [visit()]): MobileTimetable => ({
  ...emptyTimetable("2020-12-28"),
  cycle: { weeks: 2, anchor: "2020-12-28" },
  stops: [
    {
      id: "stop000001",
      name: "Ford Cross",
      where: "Lay-by",
      location: { lat: 51, lng: 0 },
      areaDocumentId: null,
    },
    {
      id: "stop000002",
      name: "Hilton",
      where: "",
      location: { lat: 52, lng: 0 },
      areaDocumentId: null,
    },
  ],
  visits,
})
const notice = (patch: Partial<TimetableNotice> = {}): TimetableNotice => ({
  id: "notice",
  type: "not_running",
  scope: "service",
  scopeWeek: null,
  scopeDay: null,
  stopId: null,
  from: "2021-01-11",
  to: "2021-01-11",
  endedAt: null,
  message: "Maintenance",
  reason: "maintenance",
  ...patch,
})

describe("mobile timetable recurrence", () => {
  it("uses anchored weeks over a 53-week year and dates before the anchor", () => {
    const tt = timetable()
    expect(cycleWeekOf(tt, "2020-12-28")).toBe(1)
    expect(cycleWeekOf(tt, "2021-01-04")).toBe(2)
    expect(cycleWeekOf(tt, "2021-01-11")).toBe(1)
    expect(cycleWeekOf(tt, "2020-12-21")).toBe(2)
    expect(epochWeek("1970-01-05")).toBe(0)
    expect(epochWeek("1970-01-04")).toBe(-1)
  })
  it("expands monthly nth, last and dates with inclusive validity", () => {
    const tt = timetable([
      visit({ repeat: { kind: "monthly", nth: -1 } }),
      visit({
        id: "visit00002",
        arrive: "11:00",
        depart: "11:30",
        repeat: { kind: "monthly", nth: 2 },
        validFrom: "2021-02-08",
        validTo: "2021-02-08",
      }),
      visit({
        id: "visit00003",
        arrive: "12:00",
        depart: "12:30",
        repeat: { kind: "dates", dates: ["2021-02-15"] },
      }),
    ])
    expect(
      occurrences(tt, [], "2021-02-01", "2021-02-28").map((x) => x.date)
    ).toEqual(["2021-02-08", "2021-02-15", "2021-02-22"])
  })
  it("cancels only not-running notices, with term, stop and day scopes", () => {
    const tt = timetable([
      visit({ termTimeOnly: true }),
      visit({
        id: "visit00002",
        stopId: "stop000002",
        arrive: "11:00",
        depart: "11:30",
      }),
    ])
    expect(
      dayRoute(tt, [notice({ scope: "term_time" })], "2021-01-11").map(
        (x) => x.cancelledBy
      )
    ).toEqual(["notice", null])
    expect(
      dayRoute(
        tt,
        [notice({ scope: "stop", stopId: "stop000002" })],
        "2021-01-11"
      ).map((x) => x.cancelledBy)
    ).toEqual([null, "notice"])
    expect(
      dayRoute(
        tt,
        [notice({ scope: "day", scopeWeek: 2, scopeDay: "mon" })],
        "2021-01-11"
      ).every((x) => x.cancelledBy === null)
    ).toBe(true)
    expect(
      dayRoute(tt, [notice({ type: "times_changed" })], "2021-01-11").every(
        (x) => x.cancelledBy === null
      )
    ).toBe(true)
    expect(
      cancelledDates(tt, [notice()], "stop000001", "2021-01-10", 3)
    ).toEqual(["2021-01-11"])
  })
  it("open-ended notices end after 30 days and ended notices stop cancelling", () => {
    const tt = timetable([visit({ repeat: { kind: "cycle", weeks: [1, 2] } })])
    expect(
      dayRoute(tt, [notice({ to: null })], "2021-02-08")[0]?.cancelledBy
    ).toBe("notice")
    expect(
      dayRoute(tt, [notice({ to: null })], "2021-02-15")[0]?.cancelledBy
    ).toBeNull()
    expect(
      dayRoute(
        tt,
        [notice({ endedAt: "2021-01-11T08:00:00Z" })],
        "2021-01-11"
      )[0]?.cancelledBy
    ).toBeNull()
  })
  it("keeps local time across London and New York DST", () => {
    expect(
      localDateTime(new Date("2026-03-29T08:30:00Z"), "Europe/London").minute
    ).toBe(570)
    expect(
      localDateTime(new Date("2026-03-08T13:30:00Z"), "America/New_York").minute
    ).toBe(570)
    expect(
      localDateTime(new Date("2026-11-01T14:30:00Z"), "America/New_York").minute
    ).toBe(570)
  })
  it("includes later visits today but skips cancelled departures", () => {
    const tt = timetable()
    expect(
      nextVisits(
        tt,
        [],
        "stop000001",
        new Date("2021-01-11T09:45:00Z"),
        "UTC",
        1
      )[0]?.date
    ).toBe("2021-01-11")
    expect(
      nextVisits(
        tt,
        [notice()],
        "stop000001",
        new Date("2021-01-11T09:45:00Z"),
        "UTC",
        1
      )[0]?.date
    ).toBe("2021-01-25")
  })
  it("has half-open stop intervals and every schedule state", () => {
    const tt = timetable([
      visit(),
      visit({
        id: "visit00002",
        stopId: "stop000002",
        arrive: "11:00",
        depart: "11:30",
      }),
    ])
    const state = (time: string, notices: TimetableNotice[] = []) =>
      scheduleState(tt, notices, new Date(`2021-01-11T${time}:00Z`), "UTC").kind
    expect(state("09:00")).toBe("before_service")
    expect(state("09:30")).toBe("at_stop")
    expect(state("10:00")).toBe("between")
    expect(state("11:30")).toBe("finished")
    expect(state("09:00", [notice()])).toBe("not_running")
    expect(
      scheduleState(tt, [], new Date("2021-01-12T09:00:00Z"), "UTC").kind
    ).toBe("no_service_today")
  })
  it("matches stop search keys to recurrence for 400 days", () => {
    for (const repeat of [
      { kind: "cycle", weeks: [1] },
      { kind: "monthly", nth: 2 },
      { kind: "monthly", nth: -1 },
      { kind: "dates", dates: ["2021-03-01", "2021-06-07"] },
    ] as const) {
      const tt = timetable([visit({ repeat: repeat as MobileVisit["repeat"] })])
      for (let i = 0; i < 400; i++) {
        const date = addDays("2021-01-01", i)
        const keys = stopKeys(tt, "stop000001", date)
        expect(keys.some((k) => todayKeys(date).includes(k))).toBe(
          dayRoute(tt, [], date).length > 0
        )
      }
    }
  })
  it("matches keys for every weekday and cycle length across dates before the anchor", () => {
    for (const weeks of [1, 2, 3, 4] as const)
      for (const day of WEEKDAYS) {
        const tt = timetable([
          visit({
            day,
            repeat: {
              kind: "cycle",
              weeks: Array.from({ length: weeks }, (_, i) => i + 1).filter(
                (w) => w % 2 === 1
              ),
            },
          }),
        ])
        tt.cycle.weeks = weeks
        for (let i = 0; i < 400; i++) {
          const date = addDays("2020-01-01", i)
          expect(
            stopKeys(tt, "stop000001", date).some((key) =>
              todayKeys(date).includes(key)
            )
          ).toBe(dayRoute(tt, [], date).length > 0)
        }
      }
  })
  it("merges adjacent opening frames and leaves cancelled frames out", () => {
    const tt = timetable([
      visit(),
      visit({ id: "visit00002", arrive: "10:00", depart: "10:30" }),
    ])
    expect(
      weekFrames(tt, [], "2021-01-11", 10).days[0]?.timeframes.map((t) => [
        t.startTime,
        t.endTime,
      ])
    ).toEqual([["09:30", "10:30"]])
    expect(weekFrames(tt, [notice()], "2021-01-11", 10).days[0]?.enabled).toBe(
      false
    )
  })
})

describe("mobile timetable writes", () => {
  it("allows new library submissions without a previous timetable hash", () => {
    expect(
      isStaleTimetableSuggestion(
        "new_library",
        { mobileTimetable: timetable() },
        undefined
      )
    ).toBe(false)
    expect(
      isStaleTimetableSuggestion(
        "new_library",
        { mobileTimetable: null },
        undefined
      )
    ).toBe(false)
  })

  it.each(["correction", "library_edit"])(
    "requires %s timetable suggestions to match the current value",
    (submissionType) => {
      const current = timetable()
      const fields = {
        mobileTimetable: timetable([visit({ arrive: "09:00" })]),
        previousHash: timetableHash(current),
      }
      expect(isStaleTimetableSuggestion(submissionType, fields, current)).toBe(
        false
      )
      expect(isStaleTimetableSuggestion(submissionType, fields, null)).toBe(
        true
      )
      expect(
        isStaleTimetableSuggestion(
          submissionType,
          { mobileTimetable: fields.mobileTimetable },
          current
        )
      ).toBe(true)
    }
  )

  it("ignores submissions which do not change the timetable", () => {
    expect(
      isStaleTimetableSuggestion("correction", { name: "New name" }, null)
    ).toBe(false)
    expect(isStaleTimetableSuggestion("correction", undefined, null)).toBe(
      false
    )
  })

  it("previews mapped clipboard columns and CSV landmarks without changing existing stop ids", () => {
    const tt = timetable([])
    const rows =
      'Village,Weekday,Start time,Leave,Landmark,How often\nFord Cross,Monday,9:30,10:00,"Outside the shop, by the ""old"" gate",fortnightly\n'
    expect(spreadsheetRows(rows)[1]?.[4]).toBe(
      'Outside the shop, by the "old" gate'
    )
    const imported = importTimetableSpreadsheet(tt, rows)
    expect(imported.errors).toEqual([])
    expect(imported.imported).toBe(1)
    expect(imported.timetable.visits[0]).toMatchObject({
      stopId: "stop000001",
      arrive: "09:30",
      repeat: { kind: "cycle", weeks: [1] },
    })
    expect(tt.visits).toEqual([])
    const mapped = importTimetableSpreadsheet(
      tt,
      "Place\tWhen\tBegins\tEnds\nHilton\tMonday\t11:00\t11:30",
      { name: 0, day: 1, arrive: 2, depart: 3 }
    )
    expect(mapped.errors).toEqual([])
    expect(mapped.timetable.visits[0]?.stopId).toBe("stop000002")
  })

  it("rejects incomplete or oversized imports and recognises monthly and term-time frequencies", () => {
    const tt = timetable([])
    expect(
      importTimetableSpreadsheet(tt, "Stop,Day\nHill,Monday").errors
    ).toHaveLength(1)
    expect(importTimetableSpreadsheet(tt, '"Unfinished').errors[0]).toMatch(
      /closing quote/
    )
    expect(
      importTimetableSpreadsheet(tt, "x".repeat(200001)).errors[0]
    ).toMatch(/200 KB/)
    const imported = importTimetableSpreadsheet(
      tt,
      "Stop,Day,Arrive,Leave,How often\nFord Cross,Monday,09:00,09:30,last Monday of the month\nHilton,Monday,11:00,11:30,term time only"
    )
    expect(imported.timetable.visits[0]?.repeat).toEqual({
      kind: "monthly",
      nth: -1,
    })
    expect(imported.timetable.visits[1]?.termTimeOnly).toBe(true)
    expect(
      importTimetableSpreadsheet(
        tt,
        "Stop,Day,Arrive,Leave,How often\nFord Cross,Monday,09:00,09:30,every 3 weeks"
      ).errors[0]
    ).toMatch(/matching cycle length/)
  })
  it("normalises only known keys, trims and sorts without changing ids", () => {
    const tt = timetable([
      visit({ id: "visit00002", arrive: "11:00", depart: "11:30" }),
      visit(),
    ])
    const normalized = normalizeMobileTimetable({
      ...tt,
      admin: true,
      stops: tt.stops.map((s) => ({
        ...s,
        name: ` ${s.name} `,
        secret: "ignored",
      })),
    })!
    expect(normalized.visits[0]?.id).toBe("visit00001")
    expect(normalized.stops[0]?.name).toBe("Ford Cross")
    expect(JSON.stringify(normalized)).not.toContain("secret")
    expect(normalizeMobileTimetable({ ...tt, version: 2 })).toBeNull()
  })
  it("refuses unsafe text, invalid grids, unknown stops and wrong weekdays", () => {
    const tt = timetable([
      visit({
        stopId: "missing001",
        arrive: "09:31",
        repeat: { kind: "dates", dates: ["2021-01-12"] },
      }),
    ])
    tt.cycle.anchor = "2021-01-12"
    tt.stops[0]!.name = "unsafe"
    const codes = validateMobileTimetable(tt, {
      today: "2021-01-01",
      isSafeText: (s) => s !== "unsafe",
    }).map((x) => x.code)
    expect(codes).toEqual(
      expect.arrayContaining([
        "unknown_stop",
        "bad_time",
        "anchor_not_monday",
        "date_weekday",
        "unsafe_text",
      ])
    )
  })
  it("detects overlap across cycle/monthly kinds and allows touching visits", () => {
    const tt = timetable([
      visit(),
      visit({
        id: "visit00002",
        arrive: "09:45",
        depart: "10:30",
        repeat: { kind: "monthly", nth: 2 },
      }),
    ])
    expect(
      validateMobileTimetable(tt, { today: "2021-01-01" }).some(
        (x) => x.code === "overlap"
      )
    ).toBe(true)
    tt.visits[1]!.arrive = "10:00"
    expect(
      hasErrors(validateMobileTimetable(tt, { today: "2021-01-01" }))
    ).toBe(false)
  })
  it("flags implausible travel and unused or unmapped stops as warnings", () => {
    const tt = timetable([
      visit(),
      visit({
        id: "visit00002",
        stopId: "stop000002",
        arrive: "10:15",
        depart: "10:30",
      }),
    ])
    expect(
      validateMobileTimetable(tt, { today: "2021-01-01" }).some(
        (x) => x.code === "travel_time" && x.level === "warning"
      )
    ).toBe(true)
    tt.stops.push({
      id: "stop000003",
      name: "Unused",
      where: "",
      location: null,
      areaDocumentId: null,
    })
    expect(validateMobileTimetable(tt).map((x) => x.code)).toEqual(
      expect.arrayContaining(["stop_without_visits", "stop_without_pin"])
    )
  })
  it("enforces every size cap", () => {
    const tt = timetable()
    tt.stops = Array.from({ length: 301 }, (_, i) => ({
      ...tt.stops[0]!,
      id: i.toString().padStart(10, "0"),
    }))
    tt.visits = Array.from({ length: 601 }, (_, i) =>
      visit({
        id: i.toString().padStart(10, "0"),
        repeat: {
          kind: "dates",
          dates: Array.from({ length: 53 }, (_, j) =>
            addDays("2021-01-11", j * 7)
          ),
        },
      })
    )
    expect(validateMobileTimetable(tt).map((x) => x.code)).toEqual(
      expect.arrayContaining([
        "too_many_stops",
        "too_many_visits",
        "too_many_dates",
      ])
    )
  })
  it("hashes canonical normalised values and describes diffs", () => {
    const tt = timetable()
    expect(timetableHash(null)).toBe("empty")
    expect(timetableHash(tt)).toMatch(/^[a-f0-9]{16}$/)
    expect(timetableHash({ ...tt, stops: [...tt.stops].reverse() })).toBe(
      timetableHash(tt)
    )
    const next = structuredClone(tt)
    next.visits[0]!.arrive = "09:35"
    expect(summarizeDiff(diffTimetable(tt, next))).toBe("1 time changed")
    expect(timetableHash(next)).not.toBe(timetableHash(tt))
    expect(describeRepeat(visit(), tt.cycle)).toBe("Every 2 weeks · Week 1")
  })
})
