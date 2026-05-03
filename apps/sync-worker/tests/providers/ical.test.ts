import { describe, it, expect, vi } from "vitest"

import { icalProvider } from "../../src/providers/ical"

const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
 UID:abc-123@example.com
DTSTART;TZID=Europe/London:20260601T140000
DTEND;TZID=Europe/London:20260601T150000
SUMMARY:Reading Group
DESCRIPTION:Monthly reading group for adults.
URL:https://example.com/events/1
END:VEVENT
END:VCALENDAR`

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("icalProvider.test()", () => {
  it("returns ok when feed URL is reachable", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_ICAL })
    const r = await icalProvider.test({
      feedUrl: "https://example.com/cal.ics",
    })
    expect(r.ok).toBe(true)
  })

  it("returns error on HTTP failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const r = await icalProvider.test({
      feedUrl: "https://example.com/bad.ics",
    })
    expect(r.ok).toBe(false)
  })
})

describe("icalProvider.fetch()", () => {
  it("parses a VEVENT into a RawEvent", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_ICAL })
    const events = await icalProvider.fetch(
      { feedUrl: "https://example.com/cal.ics" },
      [
        {
          id: 1,
          documentId: "d1",
          entityRef: "GB-MCL-001",
          name: "Test Library",
        },
      ]
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.externalId).toBe("abc-123@example.com")
    expect(events[0]!.title).toBe("Reading Group")
    expect(events[0]!.isFree).toBe(true)
  })
})
