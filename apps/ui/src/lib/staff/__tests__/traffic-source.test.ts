import { afterEach, describe, expect, it, vi } from "vitest"

import {
  parseTrafficRange,
  SampleTrafficSource,
  trafficSource,
  VercelTrafficSource,
} from "../traffic-source"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("SampleTrafficSource", () => {
  it("answers the same illustrative numbers for the same library and range", async () => {
    const source = new SampleTrafficSource()
    const a = await source.getSummary("lib000000000000000000001", 30)
    const b = await source.getSummary("lib000000000000000000001", 30)
    expect(a).toEqual(b)
    const other = await source.getSummary("lib000000000000000000002", 30)
    expect(other.viewsPerDay.map((p) => p.value)).not.toEqual(
      a.viewsPerDay.map((p) => p.value)
    )
  })

  it("is marked as a sample and shaped for the Traffic tab", async () => {
    const summary = await new SampleTrafficSource().getSummary("lib1", 7)
    expect(summary.sample).toBe(true)
    expect(summary.range).toBe(7)
    expect(summary.kpis.map((k) => k.key)).toEqual([
      "views",
      "visitors",
      "directions",
      "catalogue",
    ])
    expect(summary.viewsPerDay).toHaveLength(7)
    const dates = summary.viewsPerDay.map((p) => p.date)
    expect([...dates].sort()).toEqual(dates)
    expect(dates.at(-1)).toBe(new Date().toISOString().slice(0, 10))
    expect(summary.kpis[0]?.value).toBe(
      summary.viewsPerDay.reduce((sum, p) => sum + p.value, 0)
    )
    expect(summary.referrers.reduce((sum, r) => sum + r.pct, 0)).toBe(100)
    expect(summary.searches.length).toBeGreaterThan(0)
  })
})

describe("VercelTrafficSource", () => {
  it("is a stub that reports it isn't configured", async () => {
    await expect(new VercelTrafficSource().getSummary()).rejects.toThrow(
      "not_configured"
    )
  })
})

describe("trafficSource", () => {
  it("defaults to the sample source and picks Vercel from TRAFFIC_SOURCE", () => {
    expect(trafficSource()).toBeInstanceOf(SampleTrafficSource)
    vi.stubEnv("TRAFFIC_SOURCE", "vercel")
    expect(trafficSource()).toBeInstanceOf(VercelTrafficSource)
    vi.stubEnv("TRAFFIC_SOURCE", "anything-else")
    expect(trafficSource()).toBeInstanceOf(SampleTrafficSource)
  })
})

describe("parseTrafficRange", () => {
  it("accepts 7, 30 and 90 (first of a list) and falls back to 30", () => {
    expect(parseTrafficRange("7")).toBe(7)
    expect(parseTrafficRange(["90", "7"])).toBe(90)
    expect(parseTrafficRange("15")).toBe(30)
    expect(parseTrafficRange(undefined)).toBe(30)
    expect(parseTrafficRange("x")).toBe(30)
  })
})
