import type { Pool } from "pg"
import { describe, expect, it, vi } from "vitest"

import { hasManagedMembership } from "../current-membership"

const snapshot = {
  mode: "sandbox",
  plan: "supporter",
  interval: "month",
  currency: "gbp",
  unitAmount: 300,
  memberSince: "2026-10-12T00:00:00Z",
  periodEnd: null,
  paidThrough: null,
  pastDueSince: null,
  status: "active",
  revoked: false,
  cancelAtPeriodEnd: false,
}
const pool = (rows: unknown[]) =>
  ({
    query: vi
      .fn()
      .mockResolvedValue({ rows: rows.map((snapshot) => ({ snapshot })) }),
  }) as unknown as Pool

describe("purchase page membership routing", () => {
  it("routes an active or still-paid canceled membership to billing management", async () => {
    expect(await hasManagedMembership(pool([snapshot]), "owner")).toBe(true)
    expect(
      await hasManagedMembership(
        pool([
          {
            ...snapshot,
            status: "canceled",
            paidThrough: "2099-01-01T00:00:00Z",
          },
        ]),
        "owner"
      )
    ).toBe(true)
  })
  it("does not treat a terminal, malformed or different-mode snapshot as a current subscription", async () => {
    expect(
      await hasManagedMembership(
        pool([
          {
            ...snapshot,
            status: "canceled",
            paidThrough: "2000-01-01T00:00:00Z",
          },
          { ...snapshot, mode: "live" },
          { role: "admin" },
        ]),
        "owner"
      )
    ).toBe(false)
  })
  it("keeps the public purchase page usable before migration but propagates an outage", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({ code: "42P01" })
      .mockRejectedValueOnce(new Error("database unavailable"))
    const db = { query } as unknown as Pool
    expect(await hasManagedMembership(db, "owner")).toBe(false)
    await expect(hasManagedMembership(db, "owner")).rejects.toThrow(
      "database unavailable"
    )
  })
})
