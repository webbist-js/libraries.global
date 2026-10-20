import type { Pool } from "pg"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiUsage } from "../store"

afterEach(() => vi.useRealTimers())

function database(startedAt: string | null, days: unknown[] = []) {
  return {
    query: vi.fn(async (sql: string) => ({
      rows: sql.includes("as started_at")
        ? [{ started_at: startedAt && new Date(startedAt) }]
        : sql.includes("as day,")
          ? days
          : [],
    })),
  } as unknown as Pool
}

describe("Team API usage history", () => {
  it("starts on the UTC day API access began, without inventing earlier zero rows", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-20T14:00:00Z"))
    const result = await apiUsage(database("2026-10-20T13:00:00Z"), "team")
    expect(result.days).toEqual([
      { day: "2026-10-20", requests: 0, bytes: 0, errors: 0 },
    ])
  })

  it("fills gaps since activation and retains actual daily totals", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-20T00:01:00Z"))
    const result = await apiUsage(
      database("2026-10-18T23:59:00Z", [
        { day: "2026-10-19", requests: "3", bytes: "2048", errors: "1" },
      ]),
      "team"
    )
    expect(result.days).toEqual([
      { day: "2026-10-18", requests: 0, bytes: 0, errors: 0 },
      { day: "2026-10-19", requests: 3, bytes: 2048, errors: 1 },
      { day: "2026-10-20", requests: 0, bytes: 0, errors: 0 },
    ])
  })

  it("caps established accounts at the latest 30 UTC calendar days", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-20T23:59:00Z"))
    const result = await apiUsage(database("2026-01-01T12:00:00Z"), "team")
    expect(result.days).toHaveLength(30)
    expect(result.days[0]?.day).toBe("2026-09-21")
    expect(result.days.at(-1)?.day).toBe("2026-10-20")
  })

  it("has no daily history before the first paid activation", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-20T14:00:00Z"))
    expect((await apiUsage(database(null), "team")).days).toEqual([])
  })
})
