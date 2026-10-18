import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchDiscussionReviewCount } from "@/lib/moderation-work-counts"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("discussion workspace counts", () => {
  const user = { id: "reviewer", email: "reviewer@example.test" }
  it("projects totals without exposing any discussion content", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ total: 3, data: [{ privateText: "private" }] })
      )
      .mockResolvedValueOnce(Response.json({ total: 2 }))
    vi.stubGlobal("fetch", fetcher)
    expect(await fetchDiscussionReviewCount(user)).toBe(5)
    expect(String(fetcher.mock.calls[0]![0])).toContain(
      "moderation/revisions?limit=1"
    )
    expect(fetcher.mock.calls[0]![1].headers["X-Ba-User-Id"]).toBe(user.id)
  })
  it("preserves a real zero", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ total: 0 }))
    )
    expect(await fetchDiscussionReviewCount(user)).toBe(0)
  })
  it.each([403, 500])(
    "doesn't present a failed count as zero (%s)",
    async (status) => {
      vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({}, { status }))
      )
      expect(await fetchDiscussionReviewCount(user)).toBeNull()
    }
  )
})
