import { describe, expect, it, vi } from "vitest"

import createPoints from "../../src/plugins/rewards/server/services/points"

type Raw = { sql: string; bindings: (number | string)[] }

// Same fake shape as award.test.ts's fakeStrapi, extended with a seedable
// starting `tier` (the "previous tier" the award() call reads via `fresh`)
// and an exposed `profileUpdate` mock so tests can inspect the exact `data`
// payload sent to the final tier/streak update. The atomic counter update is
// exposed as `update` so tests can read the recognition columns it sets.
function fakeStrapi(initial: { points: number | null; tier: string }) {
  const events: any[] = []
  const profile: Record<string, any> = {
    baUserId: "u1",
    points: initial.points,
    points_this_month: initial.points,
    tier: initial.tier,
    lastActivityDate: null,
  }
  const update = vi.fn(async (data: Record<string, number | Raw>) => {
    for (const [col, v] of Object.entries(data)) {
      if (typeof v === "object" && v && "sql" in v) {
        if (
          v.sql.startsWith("CASE WHEN substr(last_activity_date, 1, 7) = ?")
        ) {
          // Month-boundary reset: [month, add, reset]
          const [month, add, reset] = v.bindings as unknown as [
            string,
            number,
            number,
          ]
          profile[col] =
            String(profile.lastActivityDate ?? "").slice(0, 7) === month
              ? (profile[col] ?? 0) + add
              : reset
          continue
        }
        if (v.sql === "COALESCE(accepted_contributions, 0) + 1") {
          profile[col] = (profile[col] ?? 0) + 1
          continue
        }
        if (v.sql.startsWith("CASE WHEN last_contribution_at IS NULL")) {
          const [at] = v.bindings as string[]
          profile[col] =
            profile[col] == null || profile[col] < at! ? at : profile[col]
          continue
        }
        const coalesce = /^COALESCE\(\w+, 0\) \+ \?$/.test(v.sql)
        const cur = profile[col]
        profile[col] =
          cur == null && !coalesce ? null : (cur ?? 0) + v.bindings[0]
      } else profile[col] = v
    }
  })
  const knex: any = vi.fn(() => {
    const b: any = { transacting: () => b, where: () => b, update }

    return b
  })
  knex.raw = (sql: string, bindings: number[]): Raw => ({ sql, bindings })

  const profileUpdate = vi.fn(async ({ data }: any) =>
    Object.assign(profile, data)
  )

  const strapi: any = {
    db: {
      // Same contract as the real one: run the callback, no rollback modelling.
      transaction: vi.fn(async (cb: any) => cb({ trx: {} })),
      connection: knex,
      query: vi.fn((uid: string) => ({
        findOne: vi.fn(async ({ where }: any) =>
          uid.includes("point-event")
            ? (events.find((e) => e.idempotencyKey === where.idempotencyKey) ??
              null)
            : profile
        ),
        create: vi.fn(async ({ data }: any) => {
          events.push(data)

          return data
        }),
        update: profileUpdate,
        count: vi.fn(async () => 1),
      })),
    },
    log: { warn: vi.fn(), error: vi.fn() },
    plugin: () => ({
      service: () => ({ checkAndAward: vi.fn(async () => {}) }),
    }),
  }

  return { strapi, profile, profileUpdate, update }
}

describe("points.award: recognition counting", () => {
  it("defers badge checks until the enclosing moderation transaction commits", async () => {
    const { strapi } = fakeStrapi({ points: 4995, tier: "Scholar" })
    const callbacks: (() => void)[] = []
    strapi.db.transaction = vi.fn(async (work) =>
      work({
        trx: {},
        onCommit: (callback: () => void) => callbacks.push(callback),
      })
    )
    const checkAndAward = vi.fn().mockResolvedValue(undefined)
    strapi.plugin = () => ({ service: () => ({ checkAndAward }) })
    const svc = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    await svc.award("u1", "event_feed_accepted", 5, {}, "feed-1")
    expect(checkAndAward).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(1)
    callbacks[0]()
    expect(checkAndAward).toHaveBeenCalledWith("u1", { streak: 1 })
  })

  it.each([
    "correction_approved",
    "event_feed_accepted",
    "option_suggestion_accepted",
  ])(
    "%s counts one accepted contribution in the award's own statement",
    async (action) => {
      const { strapi, profile, update } = fakeStrapi({
        points: 100,
        tier: "Indexer",
      })
      const svc: any = createPoints({ strapi })
      svc.updateStreak = vi.fn(async () => 1)
      const before = new Date().toISOString()
      await svc.award("u1", action, 5, {}, "accepted-1")
      expect(update).toHaveBeenCalledOnce()
      expect(Object.keys(update.mock.calls[0]![0])).toEqual([
        "points",
        "points_this_month",
        "accepted_contributions",
        "last_contribution_at",
      ])
      expect(profile.accepted_contributions).toBe(1)
      expect(profile.last_contribution_at >= before).toBe(true)
    }
  )

  it.each(["manual_award", "manual_deduct", "daily_streak", "drive_finished"])(
    "%s never counts as a contribution",
    async (action) => {
      const { strapi, profile, update } = fakeStrapi({
        points: 5000,
        tier: "Scholar",
      })
      const svc: any = createPoints({ strapi })
      svc.updateStreak = vi.fn(async () => 1)
      await svc.award(
        "u1",
        action,
        action === "manual_deduct" ? -1 : 1,
        {},
        action
      )
      expect(update.mock.calls[0]![0]).not.toHaveProperty(
        "accepted_contributions"
      )
      expect(profile.accepted_contributions).toBeUndefined()
    }
  )

  it("a negative award for a qualifying action never counts", async () => {
    const { strapi, profile } = fakeStrapi({ points: 100, tier: "Indexer" })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    await svc.award("u1", "correction_approved", -5, {}, "reversal")
    expect(profile.accepted_contributions).toBeUndefined()
  })

  it("counts an idempotency key once", async () => {
    const { strapi, profile, update } = fakeStrapi({
      points: 5000,
      tier: "Scholar",
    })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    await svc.award("u1", "new_library_approved", 50, {}, "one-library")
    expect(
      await svc.award("u1", "new_library_approved", 50, {}, "one-library")
    ).toEqual({ awarded: false })
    expect(update).toHaveBeenCalledOnce()
    expect(profile.accepted_contributions).toBe(1)
    await svc.award("u1", "new_library_approved", 50, {}, "two-library")
    expect(profile.accepted_contributions).toBe(2)
  })

  it("uses the acceptance time for delayed delivery and never moves lastContributionAt backwards", async () => {
    const { strapi, profile } = fakeStrapi({ points: 5000, tier: "Scholar" })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    await svc.award(
      "u1",
      "discussion_reply_accepted",
      1,
      {},
      "reply-1",
      new Date("2026-01-01T12:00:00Z")
    )
    expect(profile.last_contribution_at).toBe("2026-01-01T12:00:00.000Z")
    await svc.award(
      "u1",
      "discussion_reply_accepted",
      1,
      {},
      "reply-2",
      new Date("2025-12-01T12:00:00Z")
    )
    expect(profile.last_contribution_at).toBe("2026-01-01T12:00:00.000Z")
    expect(profile.accepted_contributions).toBe(2)
  })
})
