import { afterEach, expect, it, vi } from "vitest"

import { allowLibraryLookup } from "@/lib/library-query-rate"

import { GET } from "./route"

vi.mock("@/lib/library-query-rate", () => ({
  allowLibraryLookup: vi.fn().mockResolvedValue(true),
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
it("discovers in Meilisearch and resolves only bounded published identifiers in CMS", async () => {
  vi.stubEnv("MEILISEARCH_HOST", "https://search.example.org")
  vi.stubEnv("MEILISEARCH_SEARCH_API_KEY", "fixture")
  const id = "library000000000000000001"
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ hits: [{ documentId: id }] }))
    .mockResolvedValueOnce(
      Response.json({
        data: [
          { documentId: id, name: "Library", libraryType: { name: "Public" } },
        ],
      })
    )
  vi.stubGlobal("fetch", fetcher)
  const result = await GET(
    new Request("https://example.org/api/search/libraries?q=Library")
  )
  expect(result.status).toBe(200)
  expect((await result.json()).data[0].name).toBe("Library")
  const cms = new URL(fetcher.mock.calls[1]![0])
  expect(cms.searchParams.get("filters[documentId][$in][0]")).toBe(id)
  expect(cms.searchParams.get("pagination[limit]")).toBe("10")
  expect(cms.search).not.toContain("contains")
})
it("stops rejected searches before either upstream service", async () => {
  vi.mocked(allowLibraryLookup).mockResolvedValueOnce(false)
  const fetcher = vi.fn()
  vi.stubGlobal("fetch", fetcher)
  expect(
    (
      await GET(
        new Request("https://example.org/api/search/libraries?q=Library")
      )
    ).status
  ).toBe(429)
  expect(fetcher).not.toHaveBeenCalled()
})
