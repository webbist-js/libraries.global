import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchDrive, fetchDriveInReview, fetchHolds, getSessionSSR, search } =
  vi.hoisted(() => ({
    fetchDrive: vi.fn(),
    fetchDriveInReview: vi.fn(),
    fetchHolds: vi.fn(),
    getSessionSSR: vi.fn(),
    search: vi.fn(),
  }))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR }))
vi.mock("@/lib/drives/drive-holds-server", () => ({ fetchHolds }))

vi.mock("@/lib/drives/drives-server", () => ({
  fetchDrive,
  fetchDriveInReview,
}))
vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { index: () => ({ search }) },
  searchLocaleFilter: (l?: string) => `locale = "${l ?? "en"}"`,
}))

const { GET } = await import("../route")

const OPEN_DRIVE = {
  documentId: "drivedoc1234567890ab",
  status: "open" as const,
  scope: { places: { region: ["yorkshire"] } },
  focus: { kind: "gaps" as const, gaps: ["hours" as const] },
  // No `openedAt`: `driveFilters` only adds a `created_ts` clause once a
  // drive has opened, and this fixture keeps the filter string simple to
  // assert on exactly.
  openedAt: null,
}

const SCOPE_FILTER =
  'region_slug IN ["yorkshire"] AND operationalStatus != "permanently_closed"'
const TODO_FILTER = `${SCOPE_FILTER} AND needs IN ["hours"]`

/** A fresh client address per test, so the per-IP limiter starts empty. */
let nextIp = 0
const ip = () => {
  nextIp += 1

  return `198.51.100.${nextIp}`
}

const get = (url: string, address = ip()) =>
  GET(new Request(url, { headers: { "x-forwarded-for": address } }), {
    params: Promise.resolve({ slug: "yorkshire-hours" }),
  })

beforeEach(() => {
  getSessionSSR.mockReset().mockResolvedValue(null)
  fetchHolds.mockReset().mockResolvedValue({ heldByOthers: [], mine: null })
  fetchDrive.mockReset().mockResolvedValue(OPEN_DRIVE)
  fetchDriveInReview.mockReset().mockResolvedValue([])
  search.mockReset().mockResolvedValue({ hits: [], estimatedTotalHits: 0 })
})

describe("GET /api/drives/[slug]/tasks", () => {
  it("404s when the drive doesn't exist", async () => {
    fetchDrive.mockResolvedValue(null)

    const res = await get("http://localhost/api/drives/missing/tasks")

    expect(res.status).toBe(404)
    expect(search).not.toHaveBeenCalled()
  })

  it("404s for a drive that isn't open (closed)", async () => {
    fetchDrive.mockResolvedValue({ ...OPEN_DRIVE, status: "closed" })

    const res = await get("http://localhost/api/drives/closed-drive/tasks")

    expect(res.status).toBe(404)
    expect(search).not.toHaveBeenCalled()
  })

  it("404s for a scheduled drive", async () => {
    fetchDrive.mockResolvedValue({ ...OPEN_DRIVE, status: "scheduled" })

    const res = await get("http://localhost/api/drives/soon/tasks")

    expect(res.status).toBe(404)
  })

  it("filters on the drive's to-do scope, joined with the locale", async () => {
    await get("http://localhost/api/drives/yorkshire-hours/tasks")

    const [, params] = search.mock.calls[0] as [string, { filter: string }]
    expect(params.filter).toBe(`${TODO_FILTER} AND locale = "en"`)
  })

  it("excludes libraries already in review", async () => {
    fetchDriveInReview.mockResolvedValue(["lib1", "lib2"])

    await get("http://localhost/api/drives/yorkshire-hours/tasks")

    const [, params] = search.mock.calls[0] as [string, { filter: string }]
    expect(params.filter).toBe(
      `${TODO_FILTER} AND locale = "en" AND documentId NOT IN ["lib1", "lib2"]`
    )
  })

  it("omits the exclusion clause when nothing is in review", async () => {
    await get("http://localhost/api/drives/yorkshire-hours/tasks")

    const [, params] = search.mock.calls[0] as [string, { filter: string }]
    expect(params.filter).not.toContain("NOT IN")
  })

  it("passes q through to the search query", async () => {
    await get("http://localhost/api/drives/yorkshire-hours/tasks?q=leeds")

    expect(search.mock.calls[0]?.[0]).toBe("leeds")
  })

  it("sorts by completeness by default, limit 10", async () => {
    await get("http://localhost/api/drives/yorkshire-hours/tasks")

    const [, params] = search.mock.calls[0] as [
      string,
      { sort?: string[]; limit: number; offset: number },
    ]
    expect(params.sort).toEqual(["completeness:desc", "name:asc"])
    expect(params.limit).toBe(10)
    expect(params.offset).toBe(0)
  })

  it("pages with offset = page * 10", async () => {
    await get("http://localhost/api/drives/yorkshire-hours/tasks?page=2")

    const [, params] = search.mock.calls[0] as [string, { offset: number }]
    expect(params.offset).toBe(20)
  })

  it("sorts by distance when near is given", async () => {
    await get(
      "http://localhost/api/drives/yorkshire-hours/tasks?near=53.8,-1.5"
    )

    const [, params] = search.mock.calls[0] as [string, { sort?: string[] }]
    expect(params.sort).toEqual(["_geoPoint(53.8, -1.5):asc"])
  })

  it("reports hasMore true when more hits remain past this page", async () => {
    search.mockResolvedValue({
      hits: Array.from({ length: 10 }, (_, i) => ({
        documentId: `lib${i}`,
        slug: `lib-${i}`,
        name: `Library ${i}`,
      })),
      estimatedTotalHits: 25,
    })

    const res = await get("http://localhost/api/drives/yorkshire-hours/tasks")
    const body = (await res.json()) as { page: number; hasMore: boolean }

    expect(body.page).toBe(0)
    expect(body.hasMore).toBe(true)
  })

  it("reports hasMore false on the last page", async () => {
    search.mockResolvedValue({
      hits: Array.from({ length: 5 }, (_, i) => ({
        documentId: `lib${i}`,
        slug: `lib-${i}`,
        name: `Library ${i}`,
      })),
      estimatedTotalHits: 25,
    })

    const res = await get(
      "http://localhost/api/drives/yorkshire-hours/tasks?page=2"
    )
    const body = (await res.json()) as { hasMore: boolean }

    expect(body.hasMore).toBe(false)
  })

  it("builds each task's href from its place slugs and drops the raw slugs", async () => {
    search.mockResolvedValue({
      hits: [
        {
          documentId: "lib1",
          slug: "leeds-central",
          name: "Leeds Central Library",
          continent_slug: "europe",
          country_slug: "united-kingdom",
          region_slug: "yorkshire",
        },
      ],
      estimatedTotalHits: 1,
    })

    const res = await get("http://localhost/api/drives/yorkshire-hours/tasks")
    const body = (await res.json()) as { data: Record<string, unknown>[] }

    expect(body.data[0]).toMatchObject({
      documentId: "lib1",
      slug: "leeds-central",
      name: "Leeds Central Library",
      href: "/europe/united-kingdom/yorkshire/leeds-central",
      inReview: false,
    })
    expect(body.data[0]).not.toHaveProperty("continent_slug")
    expect(body.data[0]).not.toHaveProperty("country_slug")
    expect(body.data[0]).not.toHaveProperty("region_slug")
  })

  it("is null when a place slug is missing", async () => {
    search.mockResolvedValue({
      hits: [{ documentId: "lib1", slug: "leeds-central", name: "Leeds" }],
      estimatedTotalHits: 1,
    })

    const res = await get("http://localhost/api/drives/yorkshire-hours/tasks")
    const body = (await res.json()) as { data: { href: string | null }[] }

    expect(body.data[0]!.href).toBeNull()
  })

  it("attaches distanceKm from _geoDistance when sorting near", async () => {
    search.mockResolvedValue({
      hits: [
        {
          documentId: "lib1",
          slug: "leeds-central",
          name: "Leeds Central Library",
          _geoDistance: 2500,
        },
      ],
      estimatedTotalHits: 1,
    })

    const res = await get(
      "http://localhost/api/drives/yorkshire-hours/tasks?near=53.8,-1.5"
    )
    const body = (await res.json()) as { data: { distanceKm?: number }[] }

    expect(body.data[0]!.distanceKm).toBe(2.5)
  })

  it("leaves distanceKm out without a near search", async () => {
    search.mockResolvedValue({
      hits: [{ documentId: "lib1", slug: "leeds-central", name: "Leeds" }],
      estimatedTotalHits: 1,
    })

    const res = await get("http://localhost/api/drives/yorkshire-hours/tasks")
    const body = (await res.json()) as { data: Record<string, unknown>[] }

    expect(body.data[0]).not.toHaveProperty("distanceKm")
  })

  it("rate limits at 120 requests a minute per address", async () => {
    const address = ip()
    for (let i = 0; i < 120; i++) {
      const res = await get(
        "http://localhost/api/drives/yorkshire-hours/tasks",
        address
      )
      expect(res.status).toBe(200)
    }

    const res = await get(
      "http://localhost/api/drives/yorkshire-hours/tasks",
      address
    )

    expect(res.status).toBe(429)
  })
})
