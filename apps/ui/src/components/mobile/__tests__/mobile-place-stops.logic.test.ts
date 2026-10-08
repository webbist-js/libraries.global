import { describe, expect, it } from "vitest"

import type { MobileStopHit } from "@/lib/mobile-stop-search"

import {
  nearestMobileLibraries,
  nextStopVisit,
} from "../mobile-place-stops.logic"

const stop = (library: string, id = "stop000001"): MobileStopHit => ({
  id: `${library}_${id}`,
  stop_id: id,
  name: "Green",
  where: "Village green",
  library_document_id: library,
  library_name: library,
  library_slug: library,
  library_path: null,
  area_slug: null,
  region_slug: null,
  country_slug: null,
  visit_keys: [],
  cancelled_dates: [],
  cycle: { weeks: 1, anchor: "2026-10-05" },
  visits: [
    {
      id: "visit00001",
      stopId: id,
      day: "tue",
      arrive: "13:30",
      depart: "14:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
  shares_live: false,
  timezone: "Europe/London",
})
describe("mobile place results", () => {
  it("keeps only the nearest stop per service and no more than five services", () => {
    const hits = [
      stop("first"),
      stop("first", "stop000002"),
      ...Array.from({ length: 10 }, (_, i) => stop(`other${i}`)),
    ]
    const result = nearestMobileLibraries(hits)
    expect(result).toHaveLength(5)
    expect(result[0]).toBe(hits[0])
    expect(new Set(result.map((hit) => hit.library_document_id)).size).toBe(5)
  })
  it("includes a visit later today in the service timezone", () => {
    expect(
      nextStopVisit(stop("mobile"), new Date("2026-10-06T10:00:00Z"))
    ).toMatchObject({ date: "2026-10-06", arrive: "13:30", depart: "14:00" })
  })
  it("skips cancelled dates and uses the next scheduled date", () => {
    const hit = { ...stop("mobile"), cancelled_dates: ["2026-10-06"] }
    expect(nextStopVisit(hit, new Date("2026-10-06T10:00:00Z"))?.date).toBe(
      "2026-10-13"
    )
  })
})
