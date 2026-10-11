import { afterEach, describe, expect, it, vi } from "vitest"

import { refreshLibraryProjections } from "../scripts/refresh-library-projections"
import { seededIndexes } from "../scripts/seed-meilisearch"
import type * as SeedModule from "../scripts/seed-meilisearch"

vi.mock("../scripts/seed-meilisearch", async (importOriginal) => ({
  ...(await importOriginal<typeof SeedModule>()),
  readEnvFile: () => ({
    MEILISEARCH_HOST: "http://search.test",
    MEILISEARCH_ADMIN_API_KEY: "test-admin-key",
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("library search settings repair", () => {
  it("applies the configured hours fields and waits for success without reading or rewriting CMS documents", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "")
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "refresh-library-projections.ts",
      "--settings-only",
    ])
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ taskUid: 42 }))
      .mockResolvedValueOnce(Response.json({ status: "succeeded" }))
    vi.stubGlobal("fetch", request)

    await refreshLibraryProjections()

    expect(request).toHaveBeenCalledTimes(2)
    const [url, options] = request.mock.calls[0]!
    expect(url).toBe("http://search.test/indexes/library/settings")
    expect(options.method).toBe("PATCH")
    const settings = JSON.parse(options.body)
    expect(settings).toEqual(seededIndexes()[0]!.settings)
    expect(settings.filterableAttributes).toEqual(
      expect.arrayContaining([
        "clock_valid_until_ts",
        "staff_open_mon_0_from",
        "regular_open_mon_0_from",
      ])
    )
    expect(request.mock.calls[1]![0]).toBe("http://search.test/tasks/42")
  })

  it("reports a failed settings task instead of proceeding to document writes", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "")
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "refresh-library-projections.ts",
      "--settings-only",
    ])
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ taskUid: 42 }))
      .mockResolvedValueOnce(Response.json({ status: "failed" }))
    vi.stubGlobal("fetch", request)

    await expect(refreshLibraryProjections()).rejects.toThrow(
      "Search task 42 failed"
    )
    expect(request).toHaveBeenCalledTimes(2)
  })
})
