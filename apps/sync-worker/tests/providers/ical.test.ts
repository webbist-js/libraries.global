/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are the blocklist / test fixtures */
import { describe, it, expect, vi } from "vitest"

// Keep tests offline: the SSRF guard resolves hosts before fetching.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}))

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

describe("icalProvider.fetch() timezones", () => {
  const feed = (dtstart: string, dtend: string) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:tz@example.com
${dtstart}
${dtend}
SUMMARY:Talk
END:VEVENT
END:VCALENDAR`

  const fetchOne = async (text: string) => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => text })
    const events = await icalProvider.fetch(
      { feedUrl: "https://example.com/cal.ics" },
      []
    )

    return events[0]!
  }

  it("keeps the feed TZID and converts BST wall-clock time to UTC", async () => {
    const ev = await fetchOne(
      feed(
        "DTSTART;TZID=Europe/London:20260601T140000",
        "DTEND;TZID=Europe/London:20260601T150000"
      )
    )
    expect(ev.timezone).toBe("Europe/London")
    expect(ev.startTime).toBe("2026-06-01T13:00:00.000Z")
    expect(ev.endTime).toBe("2026-06-01T14:00:00.000Z")
  })

  it("converts GMT (winter) wall-clock time to UTC", async () => {
    const ev = await fetchOne(
      feed(
        "DTSTART;TZID=Europe/London:20261201T140000",
        "DTEND;TZID=Europe/London:20261201T150000"
      )
    )
    expect(ev.startTime).toBe("2026-12-01T14:00:00.000Z")
  })

  it("handles non-European zones", async () => {
    const ev = await fetchOne(
      feed(
        "DTSTART;TZID=America/New_York:20260601T090000",
        "DTEND;TZID=America/New_York:20260601T100000"
      )
    )
    expect(ev.timezone).toBe("America/New_York")
    expect(ev.startTime).toBe("2026-06-01T13:00:00.000Z")
  })

  it("treats Z-suffixed times as UTC", async () => {
    const ev = await fetchOne(
      feed("DTSTART:20260601T140000Z", "DTEND:20260601T150000Z")
    )
    expect(ev.timezone).toBe("UTC")
    expect(ev.startTime).toBe("2026-06-01T14:00:00.000Z")
  })

  it("falls back to UTC for an unknown TZID instead of throwing", async () => {
    const ev = await fetchOne(
      feed(
        "DTSTART;TZID=Not/AZone:20260601T140000",
        "DTEND;TZID=Not/AZone:20260601T150000"
      )
    )
    expect(ev.startTime).toBe("2026-06-01T14:00:00.000Z")
  })
})
