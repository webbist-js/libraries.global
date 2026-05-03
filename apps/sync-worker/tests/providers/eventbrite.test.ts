import { describe, it, expect, vi, beforeEach } from "vitest"

import { eventbriteProvider } from "../../src/providers/eventbrite"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => mockFetch.mockReset())

describe("eventbriteProvider.test()", () => {
  it("returns ok when org endpoint responds 200", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "org_123" }),
    })
    const r = await eventbriteProvider.test({
      organizationId: "org_123",
      accessToken: "tok_abc",
    })
    expect(r.ok).toBe(true)
  })

  it("returns error on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const r = await eventbriteProvider.test({
      organizationId: "org_123",
      accessToken: "bad",
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain("401")
  })
})

describe("eventbriteProvider.fetch()", () => {
  it("returns an empty array if API returns no events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], pagination: { has_more_items: false } }),
    })
    const events = await eventbriteProvider.fetch(
      { organizationId: "org_123", accessToken: "tok_abc" },
      [
        {
          id: 1,
          documentId: "d1",
          entityRef: "GB-MCL-001",
          name: "Manchester Library",
        },
      ]
    )
    expect(events).toEqual([])
  })

  it("maps Eventbrite event to RawEvent shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "evt_999",
            name: { text: "Story Time" },
            description: { text: "Fun for kids" },
            url: "https://eventbrite.com/e/evt_999",
            start: { utc: "2026-06-01T09:00:00Z", timezone: "Europe/London" },
            end: { utc: "2026-06-01T10:00:00Z", timezone: "Europe/London" },
            is_free: true,
            venue: {
              name: "Manchester Library",
              address: { localized_address_display: "Manchester" },
            },
            category_id: null,
            subcategory_id: null,
            format_id: null,
          },
        ],
        pagination: { has_more_items: false },
      }),
    })
    const events = await eventbriteProvider.fetch(
      { organizationId: "org_123", accessToken: "tok_abc" },
      [
        {
          id: 1,
          documentId: "d1",
          entityRef: "GB-MCL-001",
          name: "Manchester Library",
        },
      ]
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.externalId).toBe("evt_999")
    expect(events[0]!.isFree).toBe(true)
    expect(events[0]!.venueName).toBe("Manchester Library")
  })
})
