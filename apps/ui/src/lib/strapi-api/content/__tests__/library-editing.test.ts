import { boundedLibraryQuery } from "@repo/shared-data"
import { expect, it, vi } from "vitest"

const fetchAPI = vi.hoisted(() => vi.fn())
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fr", "cs"] },
}))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
const { fetchLibrary, fetchLibraryForEditing } = await import("../server")
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

it.each([
  ["public reader", fetchLibrary],
  ["editor baseline", fetchLibraryForEditing],
] as const)(
  "sends a CMS-valid bounded query from the %s",
  async (_name, load) => {
    fetchAPI.mockImplementation(
      async (path: string, query: Record<string, unknown>) => {
        expect(path).toBe("/libraries/by-slug/library")
        // The production route's real query guard must accept the caller's payload.
        // A permissive response mock hid the reader's unsupported sort expression.
        boundedLibraryQuery(query)

        return { data: [{ documentId: "library", name: "Current library" }] }
      }
    )
    const result = await load("library", "en")
    expect(result?.data?.documentId).toBe("library")
  }
)
