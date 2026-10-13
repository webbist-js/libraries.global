import type { Pool } from "pg"
import { beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  query: vi.fn(),
  cancel: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  release: vi.fn(),
}))
vi.mock("../provider", () => ({
  billingStripe: () => ({
    subscriptions: {
      list: async function* () {
        yield { id: "sub_owned", status: "active" }
      },
      cancel: f.cancel,
    },
    checkout: { sessions: { retrieve: f.retrieve, expire: f.expire } },
  }),
}))
import { stopBillingBeforeDeletion } from "../deletion"

const pool = {
  connect: async () => ({ query: f.query, release: f.release }),
} as unknown as Pool
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BILLING_ENV", "sandbox")
  f.query.mockImplementation(async (sql: string) => {
    if (sql.includes("pg_try_advisory_lock"))
      return { rows: [{ locked: true }] }
    if (sql.includes("select customer_id"))
      return {
        rows: [{ customer_id: "cus_owned", erased_at: null, mode: "sandbox" }],
      }
    if (sql.includes("state='preparing'")) return { rows: [], rowCount: 0 }
    if (sql.includes("select session_id"))
      return { rows: [{ session_id: "cs_owned" }] }

    return { rows: [], rowCount: 1 }
  })
  f.cancel.mockResolvedValue({})
  f.retrieve.mockResolvedValue({ id: "cs_owned", status: "open" })
  f.expire.mockResolvedValue({})
})
describe("billing erasure safety", () => {
  it("stops future subscriptions and checkout before marking erasure", async () => {
    await stopBillingBeforeDeletion(pool, "owner")
    expect(f.cancel).toHaveBeenCalledWith("sub_owned")
    expect(f.expire).toHaveBeenCalledWith("cs_owned")
    const erasure = f.query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("set erased_at")
    )
    expect(f.expire.mock.invocationCallOrder[0]).toBeLessThan(
      f.query.mock.invocationCallOrder[erasure]!
    )
    expect(
      f.query.mock.calls.every(
        ([, params]) =>
          !params ||
          params.includes("owner") ||
          String(params[0]).includes("user:owner")
      )
    ).toBe(true)
  })
  it("refuses erasure when cancellation fails", async () => {
    f.cancel.mockRejectedValueOnce(new Error("provider unavailable"))
    await expect(stopBillingBeforeDeletion(pool, "owner")).rejects.toThrow(
      "cancel_membership_before_deletion"
    )
    expect(
      f.query.mock.calls.some(([sql]) => String(sql).includes("set erased_at"))
    ).toBe(false)
    expect(f.release).toHaveBeenCalled()
  })
  it("keeps an unresolved provider creation recoverable", async () => {
    const original = f.query.getMockImplementation()!
    f.query.mockImplementation(async (sql: string, ...args: unknown[]) =>
      sql.includes("state='preparing'")
        ? { rows: [{}], rowCount: 1 }
        : original(sql, ...args)
    )
    await expect(stopBillingBeforeDeletion(pool, "owner")).rejects.toThrow(
      "cancel_membership_before_deletion"
    )
    expect(
      f.query.mock.calls.some(
        ([sql]) =>
          String(sql).includes("set deleting") ||
          String(sql).includes("set erased_at")
      )
    ).toBe(false)
    expect(f.cancel).not.toHaveBeenCalled()
  })
})
