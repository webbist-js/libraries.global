import { describe, expect, it, vi } from "vitest"

import createPoints from "../../src/plugins/rewards/server/services/points"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const EVENTS = "plugin::rewards.point-event"

type Raw = { sql: string; bindings: unknown[] }

// A knex stub for the one raw statement award() runs on `user_profiles`.
// It applies the two SQL shapes points.ts writes to the fake store's row:
// `COALESCE(points, 0) + ?` and the month-boundary CASE.
function attachKnex(strapi: any, store: Record<string, any[]>) {
  const calls: { transacting: unknown; where: unknown; data: unknown }[] = []
  const knex: any = vi.fn((table: string) => {
    if (table !== "user_profiles") throw new Error(`unexpected ${table}`)
    const state: { transacting?: unknown; where?: Record<string, unknown> } = {}
    const b: any = {
      transacting: (t: unknown) => {
        state.transacting = t

        return b
      },
      where: (w: Record<string, unknown>) => {
        state.where = w

        return b
      },
      max: async () => [{ n: 41 }],
      update: async (data: Record<string, number | Raw>) => {
        calls.push({ transacting: state.transacting, where: state.where, data })
        const row = (store[PROFILE] ?? []).find(
          (p) => p.baUserId === state.where?.ba_user_id
        )
        if (!row) return 0
        for (const [col, v] of Object.entries(data)) {
          if (typeof v !== "object") continue
          if (col === "points") {
            row.points = (row.points ?? 0) + Number(v.bindings[0])
          } else if (col === "points_this_month") {
            const [month, add, reset] = v.bindings as [string, number, number]
            row.pointsThisMonth =
              String(row.lastActivityDate ?? "").slice(0, 7) === month
                ? (row.pointsThisMonth ?? 0) + add
                : reset
          }
        }

        return 1
      },
    }

    return b
  })
  knex.raw = (sql: string, bindings: unknown[] = []): Raw => ({ sql, bindings })
  strapi.db.connection = knex
  strapi.db.dialect = { client: "sqlite" }

  return calls
}

function setup(profile: Record<string, unknown> | null) {
  const fake = makeFakeStrapi({
    [PROFILE]: profile ? [{ documentId: "p1", ...profile }] : [],
    [EVENTS]: [],
  })
  const calls = attachKnex(fake.strapi, fake.store)
  const checkAndAward = vi.fn(async () => {})
  fake.services["rewards.badges"] = { checkAndAward }
  const svc: any = createPoints({ strapi: fake.strapi })

  return { ...fake, calls, svc, checkAndAward }
}

describe("points.award: atomicity", () => {
  it("rolls back the point event when a later write throws, so the key can be retried", async () => {
    const { strapi, store, svc } = setup({
      baUserId: "u1",
      points: 0,
      pointsThisMonth: 0,
      tier: "Reader",
      lastActivityDate: null,
    })
    const original = strapi.db.query
    let failures = 1
    strapi.db.query = (uid: string) => {
      const q = original(uid)
      if (uid === PROFILE) {
        const update = q.update
        q.update = async (args: unknown) => {
          if (failures-- > 0) throw new Error("boom")

          return update(args)
        }
      }

      return q
    }

    await expect(
      svc.award("u1", "correction_approved", 2, {}, "s1:correction_approved")
    ).rejects.toThrow("boom")
    expect(store[EVENTS]).toHaveLength(0)
    expect(store[PROFILE][0].points).toBe(0)

    await expect(
      svc.award("u1", "correction_approved", 2, {}, "s1:correction_approved")
    ).resolves.toEqual({ awarded: true })
    expect(store[EVENTS]).toHaveLength(1)
    expect(store[PROFILE][0].points).toBe(2)
    expect(store[PROFILE][0].tier).toBe("Reader")
  })

  it("runs the counter update on the transaction", async () => {
    const { strapi, calls, svc } = setup({
      baUserId: "u1",
      points: 0,
      pointsThisMonth: 0,
      lastActivityDate: null,
    })
    await svc.award("u1", "correction_approved", 2, {}, "k1")
    expect(strapi.db.transaction).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
    expect(calls[0].transacting).toEqual({ __fake: true })
    expect(calls[0].where).toEqual({ ba_user_id: "u1" })
  })

  it("resets points_this_month in SQL when the last activity was another month", async () => {
    const { store, calls, svc } = setup({
      baUserId: "u1",
      points: 100,
      pointsThisMonth: 40,
      lastActivityDate: "2000-01-15",
    })
    await svc.award("u1", "correction_approved", 2, {}, "k2")
    const data = calls[0].data as Record<string, Raw>
    expect(data.points_this_month.sql).toMatch(/^CASE WHEN substr\(/)
    expect(data.points_this_month.bindings).toEqual([
      new Date().toISOString().slice(0, 7),
      2,
      2,
    ])
    expect(store[PROFILE][0].pointsThisMonth).toBe(2)
    expect(store[PROFILE][0].points).toBe(102)
  })

  it("adds to points_this_month within the same month", async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { store, svc } = setup({
      baUserId: "u1",
      points: 100,
      pointsThisMonth: 40,
      lastActivityDate: today,
      streak: 1,
    })
    await svc.award("u1", "correction_approved", 2, {}, "k3")
    expect(store[PROFILE][0].pointsThisMonth).toBe(42)
  })

  it("awards the daily_streak point once per day on a consecutive day", async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { store, svc } = setup({
      baUserId: "u1",
      points: 100,
      pointsThisMonth: 40,
      lastActivityDate: today,
      streak: 3,
    })
    await svc.award("u1", "correction_approved", 2, {}, "k3a")
    await svc.award("u1", "correction_approved", 2, {}, "k3b")
    const streakEvents = store[EVENTS].filter(
      (e) => e.action === "daily_streak"
    )
    expect(streakEvents).toHaveLength(1)
    expect(streakEvents[0]).toMatchObject({
      points: 1,
      idempotencyKey: `streak:u1:${today}`,
      metadata: { streak: 3 },
    })
    expect(store[PROFILE][0].points).toBe(105)
    expect(store[PROFILE][0].pointsThisMonth).toBe(45)
  })

  it("creates a fallback profile with the next contributor number", async () => {
    const { store, svc } = setup(null)
    await svc.award("u9", "correction_approved", 2, {}, "k4")
    expect(store[PROFILE]).toHaveLength(1)
    expect(store[PROFILE][0]).toMatchObject({
      baUserId: "u9",
      username: "contributor42",
      contributorNumber: 42,
    })
    expect(store[EVENTS]).toHaveLength(1)
  })

  it("checks badges after the transaction has committed, with the new streak", async () => {
    const order: string[] = []
    const { strapi, svc, checkAndAward } = setup({
      baUserId: "u1",
      points: 0,
      pointsThisMonth: 0,
      lastActivityDate: null,
    })
    const tx = strapi.db.transaction
    strapi.db.transaction = vi.fn(async (cb: any) => {
      const res = await tx(cb)
      order.push("commit")

      return res
    })
    checkAndAward.mockImplementation(async () => {
      order.push("badges")
    })
    await svc.award("u1", "correction_approved", 2, {}, "k5")
    expect(order).toEqual(["commit", "badges"])
    expect(checkAndAward).toHaveBeenCalledWith("u1", { streak: 1 })
  })
})
