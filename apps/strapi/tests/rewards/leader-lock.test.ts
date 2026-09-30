import { describe, expect, it, vi } from "vitest"

import {
  REWARDS_SNAPSHOT_LOCK_KEY,
  withLeaderLock,
} from "../../src/plugins/rewards/server/utils/leader-lock"
import plugin from "../../src/plugins/rewards/strapi-server"

function pgStrapi(locked: boolean) {
  const raw = vi.fn(async () => ({ rows: [{ locked }] }))
  const trx = { raw }
  const transaction = vi.fn(async (cb: (t: typeof trx) => Promise<unknown>) =>
    cb(trx)
  )
  const strapi: any = {
    db: { dialect: { client: "postgres" }, connection: { transaction } },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  return { strapi, raw, transaction }
}

describe("withLeaderLock", () => {
  it("runs the job while holding a transaction-scoped advisory lock", async () => {
    const { strapi, raw, transaction } = pgStrapi(true)
    const job = vi.fn(async () => "ran")
    await expect(withLeaderLock(strapi, 42, job)).resolves.toEqual({
      ran: true,
      result: "ran",
    })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(raw.mock.calls[0][0]).toContain("pg_try_advisory_xact_lock(?)")
    expect(raw.mock.calls[0][1]).toEqual([42])
    expect(job).toHaveBeenCalledTimes(1)
  })

  it("skips the job when another instance holds the lock", async () => {
    const { strapi } = pgStrapi(false)
    const job = vi.fn(async () => "ran")
    await expect(withLeaderLock(strapi, 42, job)).resolves.toEqual({
      ran: false,
    })
    expect(job).not.toHaveBeenCalled()
    expect(strapi.log.debug).toHaveBeenCalledTimes(1)
  })

  it("is a no-op on sqlite", async () => {
    const transaction = vi.fn()
    const strapi: any = {
      db: { dialect: { client: "sqlite" }, connection: { transaction } },
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }
    const job = vi.fn(async () => 1)
    await expect(withLeaderLock(strapi, 42, job)).resolves.toEqual({
      ran: true,
      result: 1,
    })
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe("rewards cron", () => {
  async function bootstrapWith(locked: boolean) {
    const { strapi } = pgStrapi(locked)
    const takeWeeklySnapshot = vi.fn(async () => {})
    const tasks: Record<string, { task: () => Promise<void> }> = {}
    strapi.service = vi.fn(() => ({
      actionProvider: { registerMany: vi.fn(async () => {}) },
    }))
    strapi.cron = { add: vi.fn((t: typeof tasks) => Object.assign(tasks, t)) }
    strapi.plugin = vi.fn(() => ({ service: () => ({ takeWeeklySnapshot }) }))
    await plugin.bootstrap({ strapi })

    return { strapi, tasks, takeWeeklySnapshot }
  }

  it("takes the weekly snapshot only as the leader", async () => {
    const leader = await bootstrapWith(true)
    await leader.tasks["rewards-leaderboard-snapshot"].task()
    expect(leader.takeWeeklySnapshot).toHaveBeenCalledTimes(1)
    expect(leader.strapi.db.connection.transaction).toHaveBeenCalledTimes(1)
    const raw = leader.strapi.db.connection.transaction.mock.results[0]
    expect(raw).toBeDefined()

    const follower = await bootstrapWith(false)
    await follower.tasks["rewards-leaderboard-snapshot"].task()
    expect(follower.takeWeeklySnapshot).not.toHaveBeenCalled()
  })

  it("uses a fixed lock key", () => {
    expect(Number.isInteger(REWARDS_SNAPSHOT_LOCK_KEY)).toBe(true)
  })
})
