import { describe, expect, it, vi } from "vitest"

import createPoints from "../../src/plugins/rewards/server/services/points"

type Raw = { sql: string; bindings: number[] }

// Same fake shape as award.test.ts's fakeStrapi, extended with a seedable
// starting `tier` (the "previous tier" the award() call reads via `fresh`)
// and an exposed `profileUpdate` mock so tests can inspect the exact `data`
// payload sent to the final tier/streak/earnedProUntil update.
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
        const coalesce = /^COALESCE\(\w+, 0\) \+ \?$/.test(v.sql)
        const cur = profile[col]
        profile[col] =
          cur == null && !coalesce ? null : (cur ?? 0) + v.bindings[0]
      } else profile[col] = v
    }
  })
  const knex: any = vi.fn(() => ({ where: () => ({ update }) }))
  knex.raw = (sql: string, bindings: number[]): Raw => ({ sql, bindings })

  const profileUpdate = vi.fn(async ({ data }: any) =>
    Object.assign(profile, data)
  )

  const strapi: any = {
    db: {
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

  return { strapi, profile, profileUpdate }
}

describe("points.award: earned-Pro hold (D-P4)", () => {
  it("sets earnedProUntil ~90 days out when dropping below Archivist", async () => {
    const { strapi, profileUpdate } = fakeStrapi({
      points: 1500,
      tier: "Archivist",
    })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)

    const before = Date.now()
    // Admin manual_deduct is the real path that can lower a profile's
    // points (rewards.ts calls award with a negative pts for it).
    await svc.award("u1", "manual_deduct", -600, {}, "deduct-1")
    const after = Date.now()

    expect(profileUpdate).toHaveBeenCalledTimes(1)
    const data = profileUpdate.mock.calls[0][0].data
    expect(data.tier).toBe("Cartographer")
    expect(data.earnedProUntil).toBeDefined()
    expect(data.earnedProUntil).not.toBeNull()
    const until = Date.parse(data.earnedProUntil)
    expect(until).toBeGreaterThanOrEqual(before + 89 * 86_400_000)
    expect(until).toBeLessThanOrEqual(after + 90 * 86_400_000)
  })

  it("clears earnedProUntil to null when reaching Archivist", async () => {
    const { strapi, profileUpdate } = fakeStrapi({
      points: 400,
      tier: "Cartographer",
    })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)

    await svc.award("u1", "manual_award", 1200, {}, "award-1")

    expect(profileUpdate).toHaveBeenCalledTimes(1)
    const data = profileUpdate.mock.calls[0][0].data
    expect(data.tier).toBe("Archivist")
    expect(data.earnedProUntil).toBeNull()
  })

  it("leaves earnedProUntil out of the update when staying below Archivist", async () => {
    const { strapi, profileUpdate } = fakeStrapi({
      points: 50,
      tier: "Reader",
    })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)

    await svc.award("u1", "correction_approved", 10, {}, "small-1")

    expect(profileUpdate).toHaveBeenCalledTimes(1)
    const data = profileUpdate.mock.calls[0][0].data
    expect(data.tier).toBe("Reader")
    expect("earnedProUntil" in data).toBe(false)
  })

  it("leaves earnedProUntil out of the update when staying at or above Archivist", async () => {
    // Previous tier is already earned (Archivist); this award crosses into
    // Scholar, still earned. There's no downward-to-upward crossing here,
    // so the hold column is already correct (null) and must not be
    // rewritten on every award while a contributor climbs the top tiers.
    const { strapi, profileUpdate } = fakeStrapi({
      points: 3000,
      tier: "Archivist",
    })
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)

    await svc.award("u1", "manual_award", 2000, {}, "award-2")

    expect(profileUpdate).toHaveBeenCalledTimes(1)
    const data = profileUpdate.mock.calls[0][0].data
    expect(data.tier).toBe("Scholar")
    expect("earnedProUntil" in data).toBe(false)
  })
})
