/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are test fixtures */
import type * as Undici from "undici"
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
// Keep tests offline: the SSRF guard resolves hosts before fetching, and
// requests go through undici's own fetch (see src/lib/safe-fetch.ts).
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}))
vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<typeof Undici>()),
  fetch: mockFetch,
}))

import { ProviderStatusError } from "../../src/errors"
import { eventbriteProvider } from "../../src/providers/eventbrite"

beforeEach(() => mockFetch.mockReset())

describe("eventbriteProvider.test()", () => {
  it("resolves when org endpoint responds 200", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "org_123" }),
    })
    await expect(
      eventbriteProvider.test({
        organizationId: "org_123",
        accessToken: "tok_abc",
      })
    ).resolves.toBeUndefined()
  })

  it("throws ProviderStatusError on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const err = await eventbriteProvider
      .test({ organizationId: "org_123", accessToken: "bad" })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderStatusError)
    expect((err as ProviderStatusError).status).toBe(401)
  })
})

describe("eventbriteProvider.fetch()", () => {
  it("returns an empty array if API returns no events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ events: [], pagination: { has_more_items: false } }),
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
      status: 200,
      text: async () =>
        JSON.stringify({
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
