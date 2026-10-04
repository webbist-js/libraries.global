import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { fetchAPI } = vi.hoisted(() => ({ fetchAPI: vi.fn() }))

vi.mock("@/lib/strapi-api", () => ({
  PublicStrapiClient: { fetchAPI },
  PrivateStrapiClient: { fetchAPI: vi.fn() },
}))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("next/headers", () => ({ draftMode: vi.fn() }))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fr"] },
}))

const { fetchAllRegions } = await import("../server")
const { logNonBlockingError } = await import("@/lib/logging")

const row = (i: number) => ({
  slug: `region-${i}`,
  locale: "en",
  country: { slug: "united-kingdom" },
  continent: { slug: "europe" },
})

/**
 * Strapi's `/regions/slugs?withLibraries=1` as the controller implements it:
 * rows with a library, in id order, `id > after`, `limit` capped, and
 * `meta.next` set only on a full page.
 */
function strapi(total: number, pageSize = 1000) {
  const ids = Array.from({ length: total }, (_, i) => i + 1)

  return async (_path: string, params: Record<string, unknown>) => {
    const after = Number(params.after ?? 0)
    const limit = Math.min(Number(params.limit ?? 1000), pageSize)
    const data = ids
      .filter((id) => id > after)
      .slice(0, limit)
      .map(row)
    const next = data.length === limit ? after + data.length : null

    return { data, meta: { after, limit, count: data.length, next } }
  }
}

beforeEach(() => {
  fetchAPI.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe("fetchAllRegions", () => {
  it("walks every page by keyset until `meta.next` is null", async () => {
    fetchAPI.mockImplementation(strapi(2500))

    const result = await fetchAllRegions("en" as never)

    expect(result.data).toHaveLength(2500)
    expect(fetchAPI).toHaveBeenCalledTimes(3)
  })

  it("asks Strapi for only Regions with a library, in this locale", async () => {
    fetchAPI.mockImplementation(strapi(1))

    await fetchAllRegions("fr" as never)

    expect(fetchAPI).toHaveBeenCalledWith(
      "/regions/slugs",
      expect.objectContaining({
        locale: "fr",
        status: "published",
        withLibraries: "1",
        after: "0",
        limit: "1000",
      })
    )
  })

  it("is empty when nothing has a library", async () => {
    fetchAPI.mockResolvedValue({ data: [], meta: { next: null } })

    const result = await fetchAllRegions("en" as never)

    expect(result.data).toEqual([])
    expect(fetchAPI).toHaveBeenCalledTimes(1)
  })

  it("logs and returns an empty page rather than throwing, on a Strapi failure", async () => {
    fetchAPI.mockRejectedValue(new Error("boom"))

    const result = await fetchAllRegions("en" as never)

    expect(result).toEqual({ data: [] })
    expect(logNonBlockingError).toHaveBeenCalled()
  })
})
