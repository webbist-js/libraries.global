import { expect, it, vi } from "vitest"

const { fetchAPI } = vi.hoisted(() => ({
  fetchAPI: vi.fn(async () => ({ data: { name: "England" } })),
}))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "cs"] },
}))
const { fetchCountry } = await import("../server")
it("does not turn unmatched map asset paths into country reads with an invalid locale", async () => {
  for (const locale of ["undefined", "atlas", "_next"]) {
    fetchAPI.mockClear()
    expect(await fetchCountry("0-255.pbf", locale as never)).toBeUndefined()
    expect(fetchAPI).not.toHaveBeenCalled()
  }
})
it("still reads the country detail in a supported locale", async () => {
  expect(await fetchCountry("england", "en")).toEqual({
    data: { name: "England" },
    localeFallback: false,
  })
  expect(fetchAPI).toHaveBeenCalledWith("/countries/detail/england", {
    locale: "en",
    status: "published",
  })
})
