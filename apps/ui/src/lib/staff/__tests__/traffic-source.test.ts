import { describe, expect, it } from "vitest"

import type { Ga4Report } from "../ga4-data-api"
import {
  libraryPagePaths,
  parseTrafficRange,
  reportDays,
  summariseTraffic,
  trafficRequests,
} from "../traffic-source"

describe("parseTrafficRange", () => {
  it("accepts 7, 30 and 90 (first of a list) and falls back to 30", () => {
    expect(parseTrafficRange("7")).toBe(7)
    expect(parseTrafficRange(["90", "7"])).toBe(90)
    expect(parseTrafficRange("15")).toBe(30)
    expect(parseTrafficRange(undefined)).toBe(30)
    expect(parseTrafficRange("x")).toBe(30)
  })
})

describe("libraryPagePaths", () => {
  it("lists the unprefixed path and every locale prefix", () => {
    expect(
      libraryPagePaths(["europe", "uk", "london", "lib"], ["en", "fr"])
    ).toEqual([
      "/europe/uk/london/lib",
      "/en/europe/uk/london/lib",
      "/fr/europe/uk/london/lib",
    ])
  })

  it("refuses an incomplete address rather than widening the filter", () => {
    expect(libraryPagePaths(["europe", "uk", null, "lib"], ["en"])).toBeNull()
    expect(libraryPagePaths(["europe", "uk", "lib"], ["en"])).toBeNull()
  })
})

describe("trafficRequests", () => {
  const paths = ["/europe/uk/london/lib", "/fr/europe/uk/london/lib"]

  it("scopes every report to the exact paths on the production host", () => {
    const requests = trafficRequests(paths, 30)
    expect(requests).toHaveLength(4)
    for (const request of requests) {
      const json = JSON.stringify(request.dimensionFilter)
      expect(json).toContain('"fieldName":"hostName"')
      expect(json).toContain('"value":"libraries.global"')
      expect(json).toContain(
        JSON.stringify({ values: paths, caseSensitive: true })
      )
      // Never a pattern filter over the shared route.
      expect(json).not.toMatch(
        /PARTIAL_REGEXP|FULL_REGEXP|CONTAINS|BEGINS_WITH/
      )
    }
  })

  it("compares complete days with the equal period before", () => {
    const [totals] = trafficRequests(paths, 7)
    expect(totals!.dateRanges).toEqual([
      { name: "current", startDate: "7daysAgo", endDate: "yesterday" },
      { name: "previous", startDate: "14daysAgo", endDate: "8daysAgo" },
    ])
  })
})

const report = (
  dims: string[],
  metrics: string[],
  rows: [string[], number[]][],
  metadata?: Ga4Report["metadata"]
): Ga4Report => ({
  dimensionHeaders: dims.map((name) => ({ name })),
  metricHeaders: metrics.map((name) => ({ name })),
  rows: rows.map(([d, m]) => ({
    dimensionValues: d.map((value) => ({ value })),
    metricValues: m.map((value) => ({ value: String(value) })),
  })),
  metadata: metadata ?? { timeZone: "Etc/GMT" },
})

describe("summariseTraffic", () => {
  const now = new Date("2026-11-03T12:00:00Z")
  const reports = [
    report(
      ["dateRange"],
      ["screenPageViews", "totalUsers"],
      [
        [["current"], [120, 80]],
        [["previous"], [100, 90]],
      ]
    ),
    report(
      ["date"],
      ["screenPageViews"],
      [
        [["20261102"], [70]],
        [["20261031"], [50]],
      ]
    ),
    report(
      ["sessionDefaultChannelGroup"],
      ["screenPageViews"],
      [
        [["Organic Search"], [60]],
        [["Direct"], [30]],
        [["Referral"], [10]],
        [["Email"], [8]],
        [["Organic Social"], [6]],
        [["Unassigned"], [4]],
        [["Display"], [2]],
      ]
    ),
    report(
      ["customEvent:action_type", "dateRange"],
      ["eventCount"],
      [
        [["directions", "current"], [12]],
        [["catalogue", "current"], [5]],
        [["directions", "previous"], [8]],
      ]
    ),
  ]

  it("reads totals per period, including unique visitors as reported", () => {
    const summary = summariseTraffic(reports, 7, now)
    expect(
      summary.kpis.map((k) => [k.key, k.value, k.previous, k.changePct])
    ).toEqual([
      ["views", 120, 100, 20],
      ["visitors", 80, 90, -11],
      ["directions", 12, 8, 50],
      ["catalogue", 5, 0, null],
    ])
  })

  it("fills every complete day in the property's zone with zeros", () => {
    const summary = summariseTraffic(reports, 7, now)
    expect(summary.viewsPerDay.map((d) => d.date)).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ])
    expect(summary.viewsPerDay.map((d) => d.value)).toEqual([
      0, 0, 0, 0, 50, 0, 70,
    ])
    expect(summary.through).toBe("2026-11-02")
    expect(summary.timeZone).toBe("Etc/GMT")
  })

  it("uses the property's day boundary, not the server's", () => {
    // 23:30 UTC on 2 Nov is already 3 Nov in Auckland.
    const late = new Date("2026-11-02T23:30:00Z")
    expect(reportDays(7, "Pacific/Auckland", late).at(-1)).toBe("2026-11-02")
    expect(reportDays(7, "Etc/GMT", late).at(-1)).toBe("2026-11-01")
  })

  it("keeps the five largest channels and folds the rest into Other", () => {
    const { referrers } = summariseTraffic(reports, 7, now)
    expect(referrers.map((r) => r.label)).toEqual([
      "Organic Search",
      "Direct",
      "Referral",
      "Email",
      "Organic Social",
      "Other",
    ])
    expect(referrers[0]!.pct).toBe(50)
    expect(referrers.at(-1)!.pct).toBe(5)
  })

  it("reports genuine zero traffic as zeros, not as missing", () => {
    const empty = summariseTraffic(
      [
        report([], [], []),
        report([], [], []),
        report([], [], []),
        report([], [], []),
      ],
      30,
      now
    )
    expect(empty.kpis.every((k) => k.value === 0 && k.changePct === null)).toBe(
      true
    )
    expect(empty.viewsPerDay).toHaveLength(30)
    expect(empty.referrers).toEqual([])
    expect(empty.incomplete).toBe(false)
  })

  it("flags thresholded or folded results as incomplete", () => {
    const thresholded = [
      report(["dateRange"], ["screenPageViews", "totalUsers"], [], {
        timeZone: "Etc/GMT",
        subjectToThresholding: true,
      }),
    ]
    expect(summariseTraffic(thresholded, 7, now).incomplete).toBe(true)
  })
})
