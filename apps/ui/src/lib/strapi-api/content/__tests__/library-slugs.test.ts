import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

const {
  fetchLibraryLocationCounts,
  fetchLibrarySlugCount,
  fetchLibrarySlugRange,
  LIBRARY_SLUGS_PAGE_SIZE,
} = await import("../library-slugs")

const row = (id: number) => ({
  id,
  slug: `lib-${id}`,
  locale: "en",
  updatedAt: "2026-09-29T00:00:00.000Z",
  continent: { slug: "europe" },
  country: { slug: "england" },
  region: { slug: "west-yorkshire" },
})

/**
 * Strapi's `/libraries/slugs` as the controller implements it: rows in id
 * order, `id > after`, then `start` skipped, `limit` capped at 1000, and
 * `meta.next` set only on a full page. Ids have gaps, as real ones do.
 */
function strapi(total: number) {
  const ids = Array.from({ length: total }, (_, i) => (i + 1) * 3)

  return async (url: string) => {
    const u = new URL(url)
    if (u.pathname === "/api/libraries/slugs/count")
      return Response.json({ count: total })
    const after = Number(u.searchParams.get("after") ?? 0)
    const start = Number(u.searchParams.get("start") ?? 0)
    const limit = Math.min(Number(u.searchParams.get("limit") ?? 1000), 1000)
    const data = ids
      .filter((id) => id > after)
      .slice(start, start + limit)
      .map(row)
    const next = data.length === limit ? data.at(-1)!.id : null

    return Response.json({
      data,
      meta: { after, start, limit, count: data.length, next },
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_REST_READONLY_API_KEY", "ro-token")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("fetchLibrarySlugRange", () => {
  it("jumps to the offset once, then walks by keyset", async () => {
    fetchMock.mockImplementation(strapi(12_500))

    const rows = await fetchLibrarySlugRange("en", 10_000, 10_000)

    expect(rows).toHaveLength(2500)
    expect(rows[0]!.slug).toBe(`lib-${10_001 * 3}`)
    expect(rows.at(-1)!.slug).toBe(`lib-${12_500 * 3}`)
    expect(new Set(rows.map((r) => r.slug)).size).toBe(2500)
    const urls = fetchMock.mock.calls.map(([url]) => new URL(url))
    expect(urls).toHaveLength(3)
    expect(urls[0]!.searchParams.get("start")).toBe("10000")
    expect(urls[0]!.searchParams.get("after")).toBe("0")
    expect(urls[1]!.searchParams.get("start")).toBe("0")
    expect(urls[1]!.searchParams.get("after")).toBe(String(11_000 * 3))
  })

  it("reads exactly the file's size and never more", async () => {
    fetchMock.mockImplementation(strapi(30_000))

    const rows = await fetchLibrarySlugRange("en", 0, 2500)

    expect(rows).toHaveLength(2500)
    const limits = fetchMock.mock.calls.map(([url]) =>
      new URL(url).searchParams.get("limit")
    )
    expect(limits).toEqual([
      String(LIBRARY_SLUGS_PAGE_SIZE),
      String(LIBRARY_SLUGS_PAGE_SIZE),
      "500",
    ])
  })

  it("sends the locale, published status, token and cache tags", async () => {
    fetchMock.mockImplementation(strapi(3))

    expect(await fetchLibrarySlugRange("en", 0, 10_000)).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    const u = new URL(url)
    expect(u.pathname).toBe("/api/libraries/slugs")
    expect(u.searchParams.get("locale")).toBe("en")
    expect(u.searchParams.get("status")).toBe("published")
    expect(init.headers).toMatchObject({ Authorization: "Bearer ro-token" })
    expect(init.next).toEqual({ revalidate: 3600, tags: ["strapi", "library"] })
  })

  it("is empty past the last row", async () => {
    fetchMock.mockImplementation(strapi(5))

    expect(await fetchLibrarySlugRange("en", 10_000, 10_000)).toEqual([])
  })

  it("throws when Strapi fails, rather than returning a partial file", async () => {
    const answer = strapi(5000)
    fetchMock.mockImplementation(async (url: string) =>
      new URL(url).searchParams.get("after") === "0"
        ? answer(url)
        : new Response("boom", { status: 500 })
    )

    await expect(fetchLibrarySlugRange("en", 0, 5000)).rejects.toThrow("500")
  })
})

describe("fetchLibrarySlugCount", () => {
  it("reads the count route", async () => {
    fetchMock.mockImplementation(strapi(2_900_000))

    expect(await fetchLibrarySlugCount("en")).toBe(2_900_000)
    expect(new URL(fetchMock.mock.calls[0]![0]).pathname).toBe(
      "/api/libraries/slugs/count"
    )
  })
})

describe("fetchLibraryLocationCounts", () => {
  it("returns the counts as a map keyed by slug path", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ data: { europe: 3, "europe/france": 3 } })
    )

    const counts = await fetchLibraryLocationCounts("en")

    expect(counts.get("europe/france")).toBe(3)
    expect(new URL(fetchMock.mock.calls[0]![0]).pathname).toBe(
      "/api/libraries/location-counts"
    )
  })
})
