import { describe, expect, it, vi } from "vitest"

import { isCronRequest, purgeExpiredAuthRecords } from "../auth-retention"

describe("purgeExpiredAuthRecords", () => {
  it("deletes expired sessions, expired verifications and 30-day-old rate-limit rows", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 2 })
    const now = new Date("2026-10-01T03:00:00Z")

    const deleted = await purgeExpiredAuthRecords({ query }, now)

    expect(query).toHaveBeenCalledWith(
      'delete from "session" where "expiresAt" < $1',
      [now]
    )
    expect(query).toHaveBeenCalledWith(
      'delete from "verification" where "expiresAt" < $1',
      [now]
    )
    expect(query).toHaveBeenCalledWith(
      'delete from "rateLimit" where "lastRequest" < $1',
      [Date.parse("2026-09-01T03:00:00Z")]
    )
    expect(deleted).toEqual({ sessions: 2, verifications: 2, rateLimits: 2 })
  })

  it("reports zero when the driver gives no row count", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: null })

    expect(await purgeExpiredAuthRecords({ query })).toEqual({
      sessions: 0,
      verifications: 0,
      rateLimits: 0,
    })
  })

  it("removes activity older than 30 days when the optional event table exists", async () => {
    const query = vi
      .fn()
      .mockImplementation(async (sql: string) =>
        sql.includes("to_regclass")
          ? { rowCount: 1, rows: [{ name: "internal_activity_events" }] }
          : { rowCount: 0 }
      )
    await purgeExpiredAuthRecords({ query }, new Date("2026-10-23T03:00:00Z"))
    expect(query).toHaveBeenCalledWith(
      "delete from internal_activity_events where created_at < $1",
      [new Date("2026-09-23T03:00:00Z")]
    )
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
