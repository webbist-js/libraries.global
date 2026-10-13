import { describe, expect, it, vi } from "vitest"

const { search } = vi.hoisted(() => ({
  search: vi.fn().mockResolvedValue({ hits: [] }),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => ({
    user: { id: "place-filter-test", email: "test@example.com" },
  }),
}))
vi.mock("@/lib/drives/drives-server", () => ({
  fetchDrive: async () => ({
    documentId: "drive123",
    status: "open",
    scope: { places: { continent: ["europe"] } },
    focus: { kind: "gaps", gaps: ["hours"] },
  }),
  fetchDriveInReview: async () => [],
}))
vi.mock("@/lib/drives/drive-holds-server", () => ({
  fetchHolds: async () => ({ heldByOthers: [], mine: null }),
  placeHold: vi.fn(),
}))
vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { index: () => ({ search }) },
  searchLocaleFilter: () => 'locale = "en"',
}))
const { POST } = await import("../route")

describe("next drive task with a selected place", () => {
  it("keeps the drive’s scope and focus while narrowing to the chosen country", async () => {
    const request = new Request(
      "http://localhost/api/drives/europe-hours/next",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place: { country: "greece" }, locale: "en" }),
      }
    )
    const response = await POST(request, {
      params: Promise.resolve({ slug: "europe-hours" }),
    })
    expect(response.status).toBe(200)
    expect(search.mock.calls[0]?.[1].filter).toBe(
      'continent_slug IN ["europe"] AND operationalStatus != "permanently_closed" AND needs IN ["hours"] AND locale = "en" AND country_slug = "greece"'
    )
  })
})
