import { describe, expect, it, vi } from "vitest"

import { isCronRequest, purgeExpiredAuthRecords } from "../auth-retention"

describe("purgeExpiredAuthRecords", () => {
  it("delegates auth retention to Strapi and deletes only local application state", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "synthetic-retention-test")
    const fetcher = vi.fn(async (_url: unknown, _options: unknown) =>
      Response.json({ sessions: 2, verifications: 3, rateLimits: 4 })
    )
    vi.stubGlobal("fetch", fetcher)
    try {
      const query = vi.fn().mockResolvedValue({ rowCount: 1 })
      const now = new Date("2026-10-01T03:00:00Z")
      expect(await purgeExpiredAuthRecords({ query }, now)).toEqual({
        sessions: 2,
        verifications: 3,
        rateLimits: 4,
        applicationState: 1,
      })
      expect(query).toHaveBeenCalledExactlyOnceWith(
        'delete from "app_auth_state" where "expiresAt" < $1',
        [now]
      )
      expect(String(fetcher.mock.calls[0]?.[0])).toContain(
        "/api/auth-internal/retention"
      )
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })
})

describe("isCronRequest", () => {
  it("accepts the matching bearer secret", () => {
    expect(isCronRequest("Bearer s3cret", "s3cret")).toBe(true)
  })

  it.each([
    ["missing header", null, "s3cret"],
    ["wrong secret", "Bearer nope", "s3cret"],
    ["no configured secret", "Bearer ", undefined],
    ["empty configured secret", "Bearer ", ""],
  ])("rejects %s", (_label, header, secret) => {
    expect(isCronRequest(header, secret)).toBe(false)
  })
})
