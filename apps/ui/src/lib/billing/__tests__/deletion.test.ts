import type { Pool } from "pg"
import { beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  query: vi.fn(),
  cancel: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  release: vi.fn(),
  teams: vi.fn(),
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
vi.mock("@/lib/team-api/cms", () => ({ organiserTeams: f.teams }))
import { stopBillingBeforeDeletion } from "../deletion"

const pool = {
  connect: async () => ({ query: f.query, release: f.release }),
} as unknown as Pool
const TEAM = "team000000000000000001"
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BILLING_ENV", "sandbox")
  f.query.mockImplementation(async (sql: string) => {
    if (sql.includes("pg_try_advisory_lock"))
      return { rows: [{ locked: true }] }
    if (sql.startsWith("select customer_id,mode"))
      return { rows: [{ customer_id: "cus_api", mode: "sandbox" }] }
    if (sql.includes("state='preparing'")) return { rows: [], rowCount: 0 }
    if (sql.includes("state='open'"))
      return { rows: [{ session_id: "cs_open" }] }

    return { rows: [], rowCount: 1 }
  })
  f.retrieve.mockResolvedValue({ id: "cs_open", status: "open" })
})

describe("API account erasure safety", () => {
  it("cancels a sole holder's subscription, expires checkout and revokes keys", async () => {
    f.teams.mockResolvedValue([
      { teamId: TEAM, otherOrganisers: 0, otherMembers: 0 },
    ])
    await stopBillingBeforeDeletion(pool, "user")
    expect(f.cancel).toHaveBeenCalledWith("sub_owned")
    expect(f.expire).toHaveBeenCalledWith("cs_open")
    const sql = f.query.mock.calls.map(([q]) => q as string)
    expect(
      sql.some((q) => q.startsWith("update api_keys set revoked_at"))
    ).toBe(true)
    expect(sql.some((q) => q.includes("closed_at=coalesce"))).toBe(true)
    expect(f.release).toHaveBeenCalled()
  })
  it("leaves the account running when another organiser remains", async () => {
    f.teams.mockResolvedValue([
      { teamId: TEAM, otherOrganisers: 1, otherMembers: 3 },
    ])
    await stopBillingBeforeDeletion(pool, "user")
    expect(f.cancel).not.toHaveBeenCalled()
    expect(f.query).not.toHaveBeenCalled()
  })
  it("requires a transfer when other members rely on the account", async () => {
    f.teams.mockResolvedValue([
      { teamId: TEAM, otherOrganisers: 0, otherMembers: 2 },
    ])
    await expect(stopBillingBeforeDeletion(pool, "user")).rejects.toThrow(
      "transfer_api_account_before_deletion"
    )
    expect(f.cancel).not.toHaveBeenCalled()
  })
  it("refuses erasure when cancellation or the CMS check fails", async () => {
    f.teams.mockResolvedValue([
      { teamId: TEAM, otherOrganisers: 0, otherMembers: 0 },
    ])
    f.cancel.mockRejectedValue(new Error("provider unavailable"))
    await expect(stopBillingBeforeDeletion(pool, "user")).rejects.toThrow(
      "cancel_membership_before_deletion"
    )
    f.teams.mockRejectedValue(new Error("cms down"))
    await expect(stopBillingBeforeDeletion(pool, "user")).rejects.toThrow(
      "cancel_membership_before_deletion"
    )
  })
})
