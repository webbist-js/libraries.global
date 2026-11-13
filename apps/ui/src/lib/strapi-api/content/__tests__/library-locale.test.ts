import { beforeEach, expect, it, vi } from "vitest"

const { fetchAPI } = vi.hoisted(() => ({ fetchAPI: vi.fn() }))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "ja"] },
}))
const { fetchLibrary } = await import("../server")
beforeEach(() => fetchAPI.mockReset())

it("keeps a Japanese library translation on the same document and route", async () => {
  const library = {
    documentId: "same-library",
    slug: "library",
    name: "図書館",
  }
  fetchAPI.mockResolvedValueOnce({ data: [library] })
  expect(await fetchLibrary("library", "ja")).toEqual({
    data: library,
    meta: {},
    localeFallback: false,
  })
  expect(fetchAPI).toHaveBeenCalledTimes(1)
  expect(fetchAPI).toHaveBeenCalledWith(
    "/libraries/by-slug/library",
    { locale: "ja", status: "published" },
    undefined
  )
})

it.each(["empty", "disabled"])(
  "falls back to English while Japanese content is %s",
  async (state) => {
    if (state === "disabled")
      fetchAPI.mockRejectedValueOnce(new Error("Invalid locale"))
    else fetchAPI.mockResolvedValueOnce({ data: [] })
    const library = {
      documentId: "same-library",
      slug: "library",
      name: "Library",
    }
    fetchAPI.mockResolvedValueOnce({ data: [library] })
    expect(await fetchLibrary("library", "ja")).toEqual({
      data: library,
      meta: {},
      localeFallback: true,
    })
    expect(fetchAPI.mock.calls.map(([, params]) => params.locale)).toEqual([
      "ja",
      "en",
    ])
  }
)
