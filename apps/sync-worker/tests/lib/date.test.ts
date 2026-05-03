import { describe, it, expect } from "vitest"

import { toUtcIso, truncateSummary, computeSyncHash } from "../../src/lib/date"

describe("toUtcIso", () => {
  it("leaves a UTC string unchanged in value", () => {
    const iso = "2026-06-01T14:00:00.000Z"
    expect(toUtcIso(iso)).toBe(iso)
  })

  it("converts offset datetime to UTC", () => {
    const result = toUtcIso("2026-06-01T15:00:00+01:00")
    expect(result).toBe("2026-06-01T14:00:00.000Z")
  })
})

describe("truncateSummary", () => {
  it("returns original if under 280 chars", () => {
    expect(truncateSummary("short")).toBe("short")
  })

  it("truncates at word boundary", () => {
    const long = "word ".repeat(70) // 350 chars
    const result = truncateSummary(long)
    expect(result.length).toBeLessThanOrEqual(281) // 280 + ellipsis
    expect(result.endsWith("…")).toBe(true)
    expect(result).not.toMatch(/word \u2026$/) // shouldn't cut mid-word
  })
})

describe("computeSyncHash", () => {
  it("produces a 40-char hex string", () => {
    const h = computeSyncHash(
      "evt_123",
      "eventbrite",
      "2026-06-01T14:00:00.000Z",
      "Story Time"
    )
    expect(h).toMatch(/^[0-9a-f]{40}$/)
  })

  it("is deterministic", () => {
    const a = computeSyncHash("x", "ical", "2026-01-01T00:00:00.000Z", "Talk")
    const b = computeSyncHash("x", "ical", "2026-01-01T00:00:00.000Z", "Talk")
    expect(a).toBe(b)
  })

  it("differs when any input changes", () => {
    const base = computeSyncHash(
      "x",
      "ical",
      "2026-01-01T00:00:00.000Z",
      "Talk"
    )
    expect(
      computeSyncHash("y", "ical", "2026-01-01T00:00:00.000Z", "Talk")
    ).not.toBe(base)
  })
})
