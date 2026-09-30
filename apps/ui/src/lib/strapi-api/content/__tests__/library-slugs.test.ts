import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

const { fetchAllLibrarySlugs, LIBRARY_SLUGS_PAGE_SIZE } =
  await import("../library-slugs")

const row = (n: number) => ({
  slug: `lib-${n}`,
  locale: "en",
  updatedAt: "2026-09-29T00:00:00.000Z",
  continent: { slug: "europe" },
  country: { slug: "england" },
  region: { slug: "west-yorkshire" },
})

/** Strapi's capped slugs route: `total` rows, `pageSize` per page. */
function strapi(total: number) {
  return async (url: string) => {
    const u = new URL(url)
    const page = Number(u.searchParams.get("page") ?? 1)
    const pageSize = Number(u.searchParams.get("pageSize"))
    const start = (page - 1) * pageSize
    const data = Array.from(
      { length: Math.max(0, Math.min(pageSize, total - start)) },
      (_, i) => row(start + i)
    )

    return Response.json({
      data,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
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

describe("fetchAllLibrarySlugs", () => {
  it("reads GET /libraries/slugs page by page until the last page", async () => {
    fetchMock.mockImplementation(strapi(LIBRARY_SLUGS_PAGE_SIZE * 2 + 5))

    const { data } = await fetchAllLibrarySlugs("en")

    expect(data).toHaveLength(LIBRARY_SLUGS_PAGE_SIZE * 2 + 5)
    expect(data[0]).toEqual(row(0))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, init] = fetchMock.mock.calls[0]!
    const u = new URL(url)
    expect(u.pathname).toBe("/api/libraries/slugs")
    expect(u.searchParams.get("locale")).toBe("en")
    expect(u.searchParams.get("status")).toBe("published")
    expect(u.searchParams.get("pageSize")).toBe(String(LIBRARY_SLUGS_PAGE_SIZE))
    expect(init.headers).toMatchObject({ Authorization: "Bearer ro-token" })
    expect(init.next).toEqual({ revalidate: 3600, tags: ["strapi", "library"] })
  })

  it("stops after one page when there is only one", async () => {
    fetchMock.mockImplementation(strapi(3))

    const { data } = await fetchAllLibrarySlugs("en")

    expect(data).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns an empty list when Strapi fails", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))

    expect(await fetchAllLibrarySlugs("en")).toEqual({ data: [] })
  })

  it("keeps what it has if a later page fails", async () => {
    const answer = strapi(LIBRARY_SLUGS_PAGE_SIZE * 3)
    fetchMock.mockImplementation(async (url: string) =>
      new URL(url).searchParams.get("page") === "3"
        ? new Response("boom", { status: 500 })
        : answer(url)
    )

    const { data } = await fetchAllLibrarySlugs("en")

    expect(data).toHaveLength(LIBRARY_SLUGS_PAGE_SIZE * 2)
  })
})
