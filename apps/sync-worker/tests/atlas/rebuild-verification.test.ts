import { expect, it, vi } from "vitest"

import { AtlasIndexRebuild } from "../../src/atlas/rebuild-index"

function fixture(total: unknown) {
  const state = {
    canonical_locale: "en",
    rebuild: {
      phase: "verify",
      staging: "atlas-library-staging-12345678-1234-1234-1234-123456789012",
      epoch: "epoch",
    },
  }
  const update = vi.fn()
  const db = Object.assign(
    (table: string) => {
      const query = {
        where: () => query,
        count: () => query,
        orderBy: () => query,
        limit: () => query,
        first: async () => (table === "atlas_state" ? state : { n: "2" }),
        select: async () => [
          {
            document_id: "library",
            projection: { documentId: "library", locale: "en" },
          },
        ],
        update,
      }

      return query
    },
    { transaction: async (job) => job(db) }
  )
  // This key supports document reads/writes and deliberately refuses search.
  const request = vi.fn(async (path: string) => {
    if (path.includes("/search"))
      throw new Error("HTTP 403: search permission absent")
    if (path.includes("/documents?")) return { total, results: [] }
    if (path.endsWith("/documents/library"))
      return { documentId: "library", locale: "en" }

    return { taskUid: 1 }
  })
  const rebuild = new AtlasIndexRebuild(
    { db, fenced: async () => state } as any,
    { request, wait: vi.fn() } as any
  )

  return { rebuild, request, update }
}

it("verifies and reaches swap with document permissions, excluding the epoch marker by locale", async () => {
  const f = fixture(2)
  expect(await f.rebuild.step("lease")).toBe(true)
  expect(f.request.mock.calls.some(([path]) => path.includes("/search"))).toBe(
    false
  )
  const [path] = f.request.mock.calls[0]
  const url = new URL(path, "http://localhost")
  expect(url.searchParams.get("filter")).toBe('locale = "en"')
  expect(url.searchParams.get("limit")).toBe("0")
  expect(JSON.parse(f.update.mock.calls[0][0].rebuild).phase).toBe("swap")
})

it.each([1, undefined, null, -1, "2"])(
  "rejects a mismatched or invalid document total (%s) before swapping",
  async (total) => {
    const f = fixture(total)
    await expect(f.rebuild.step("lease")).rejects.toThrow(
      "exact count mismatch"
    )
    expect(f.update).not.toHaveBeenCalled()
  }
)
