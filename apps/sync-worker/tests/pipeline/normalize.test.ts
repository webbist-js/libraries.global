import { describe, it, expect } from "vitest"

import { normalizeEvent } from "../../src/pipeline/normalize"
import type { RawEvent } from "../../src/providers/types"

const BASE_RAW: RawEvent = {
  externalId: "evt_001",
  title: "Story Time for Toddlers",
  description:
    "A fun story time session for children aged 2-5. " + "word ".repeat(60),
  url: "https://example.com/events/evt_001",
  startTime: "2026-06-01T10:00:00+01:00",
  endTime: "2026-06-01T11:00:00+01:00",
  allDay: false,
  timezone: "Europe/London",
  providerCategory: "kids_and_family",
  tags: ["children", "storytime"],
  isFree: true,
}

const EVENT_TYPE_MAP: Record<string, "storytime" | "talk"> = {
  kids_and_family: "storytime",
  lectures_and_books: "talk",
}

describe("normalizeEvent", () => {
  const result = normalizeEvent(
    BASE_RAW,
    "eventbrite",
    42,
    7,
    "GB-MCL-001",
    EVENT_TYPE_MAP,
    false
  )

  it("sets sourceProvider and credentialId", () => {
    expect(result.sourceProvider).toBe("eventbrite")
    expect(result.credentialId).toBe(42)
  })

  it("converts startTime to UTC ISO", () => {
    expect(result.startTime).toBe("2026-06-01T09:00:00.000Z")
  })

  it("maps providerCategory via eventTypeMap", () => {
    expect(result.eventType).toBe("storytime")
  })

  it("falls back to 'other' for unmapped category", () => {
    const r = normalizeEvent(
      { ...BASE_RAW, providerCategory: "unknown_cat" },
      "eventbrite",
      1,
      1,
      "X",
      EVENT_TYPE_MAP,
      false
    )
    expect(r.eventType).toBe("other")
  })

  it("truncates summary to <= 280 chars", () => {
    expect(result.summary.length).toBeLessThanOrEqual(281)
    expect(result.summary.endsWith("…")).toBe(true)
  })

  it("computes a 40-char syncHash", () => {
    expect(result.syncHash).toMatch(/^[0-9a-f]{40}$/)
  })

  it("sets pendingReview flag", () => {
    const r = normalizeEvent(
      BASE_RAW,
      "eventbrite",
      1,
      1,
      "X",
      EVENT_TYPE_MAP,
      true
    )
    expect(r.pendingReview).toBe(true)
  })
})
