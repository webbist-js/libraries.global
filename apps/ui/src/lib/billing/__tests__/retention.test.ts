import type { Pool } from "pg"
import { describe, expect, it, vi } from "vitest"

import { purgeBillingMetadata } from "../retention"

describe("minimal billing retention", () => {
  it("removes only completed events and old erased bindings, preserving pending and live accounts", async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) =>
      sql.startsWith("select user_id")
        ? { rows: [{ user_id: "erased_owner" }], rowCount: 1 }
        : { rows: [], rowCount: 2 }
    )
    const release = vi.fn()
    const result = await purgeBillingMetadata(
      { connect: async () => ({ query, release }) } as unknown as Pool,
      new Date("2032-10-12T00:00:00Z")
    )
    expect(result).toEqual({ events: 2, erasedAccounts: 1 })
    expect(query.mock.calls[1]?.[0]).toContain(
      "state in ('complete','ignored')"
    )
    expect(query.mock.calls[2]?.[0]).toContain("erased_at<$2")
    expect(query.mock.calls[2]?.[1]).toEqual([
      "sandbox",
      new Date("2026-10-12T00:00:00Z"),
    ])
    expect(query.mock.calls[3]?.[1]).toEqual([["erased_owner"]])
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT")
    expect(release).toHaveBeenCalled()
  })
  it("rolls back partial deletion and releases the connection on failure", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(new Error("unavailable"))
    const release = vi.fn()
    await expect(
      purgeBillingMetadata({
        connect: async () => ({ query, release }),
      } as unknown as Pool)
    ).rejects.toThrow("unavailable")
    expect(query).toHaveBeenLastCalledWith("ROLLBACK")
    expect(release).toHaveBeenCalled()
  })
})
