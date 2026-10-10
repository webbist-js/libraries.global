import { describe, expect, it } from "vitest"

import { stopFrequencies, type MobileVisit } from "../mobile-timetable"

const visit = (repeat: MobileVisit["repeat"]): MobileVisit => ({
  id: "visit",
  stopId: "stop",
  day: "tue",
  arrive: "11:00",
  depart: "12:30",
  repeat,
  termTimeOnly: false,
  validFrom: null,
  validTo: null,
})
describe("mobile stop frequency filters", () => {
  it("recognises weekly visits within a multi-week cycle", () => {
    expect(
      stopFrequencies([visit({ kind: "cycle", weeks: [1, 2, 3, 4] })], {
        weeks: 4,
        anchor: "2026-10-05",
      })
    ).toEqual(["weekly"])
  })
  it("recognises alternating weeks but keeps irregular cycles distinct", () => {
    expect(
      stopFrequencies([visit({ kind: "cycle", weeks: [1, 3] })], {
        weeks: 4,
        anchor: "2026-10-05",
      })
    ).toEqual(["fortnightly"])
    expect(
      stopFrequencies([visit({ kind: "cycle", weeks: [1] })], {
        weeks: 2,
        anchor: "2026-10-05",
      })
    ).toEqual(["fortnightly"])
    expect(
      stopFrequencies([visit({ kind: "cycle", weeks: [1, 2] })], {
        weeks: 4,
        anchor: "2026-10-05",
      })
    ).toEqual([])
  })
  it("keeps monthly and specific-date visits distinct, without duplicate facets", () => {
    expect(
      stopFrequencies(
        [
          visit({ kind: "monthly", nth: 1 }),
          visit({ kind: "monthly", nth: -1 }),
          visit({ kind: "dates", dates: ["2026-10-06"] }),
        ],
        { weeks: 1, anchor: "2026-10-05" }
      )
    ).toEqual(["monthly"])
  })
})
