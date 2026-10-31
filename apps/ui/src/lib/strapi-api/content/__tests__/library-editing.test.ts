import { expect, it, vi } from "vitest"

const fetchAPI = vi.hoisted(() => vi.fn())
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fr", "cs"] },
}))
const { fetchLibraryForEditing } = await import("../server")
it("bypasses public caching for editor baselines and pre-submit conflict checks", async () => {
  fetchAPI.mockResolvedValue({
    data: [{ documentId: "library", name: "Current library" }],
  })
  const result = await fetchLibraryForEditing("library", "en")
  expect(result?.data?.name).toBe("Current library")
  expect(fetchAPI).toHaveBeenCalledWith(
    "/libraries/by-slug/library",
    expect.objectContaining({ locale: "en", status: "published" }),
    { next: { revalidate: 0 } }
  )
})
