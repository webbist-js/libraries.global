import { describe, expect, it, vi } from "vitest"

import createPoints from "../../src/plugins/rewards/server/services/points"

type Raw = { sql: string; bindings: number[] }

function fakeStrapi(initialPoints: number | null = 0) {
  const events: any[] = []
  const profile: Record<string, any> = {
    baUserId: "u1",
    points: initialPoints,
    points_this_month: initialPoints,
    lastActivityDate: null,
  }
  // Models Postgres semantics for the two SQL shapes points.ts writes:
  // `COALESCE(col, 0) + ?` and a plain value. A bare `col + ?` on NULL
  // stays NULL, which is exactly the M1 bug.
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
        update: vi.fn(async ({ data }: any) => Object.assign(profile, data)),
        count: vi.fn(async () => 1),
      })),
    },
    log: { warn: vi.fn(), error: vi.fn() },
    plugin: () => ({
      service: () => ({ checkAndAward: vi.fn(async () => {}) }),
    }),
  }

  return { strapi, events, profile }
}

describe("points.award", () => {
  it("increments NULL counters from zero (M1)", async () => {
    const { strapi, profile } = fakeStrapi(null)
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    await svc.award("u1", "correction_approved", 2, {}, "k-null")
    expect(profile.points).toBe(2)
  })

  it("is idempotent per key", async () => {
    const { strapi, events, profile } = fakeStrapi()
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    expect(
      await svc.award(
        "u1",
        "correction_approved",
        2,
        {},
        "s1:correction_approved"
      )
    ).toEqual({ awarded: true })
    expect(
      await svc.award(
        "u1",
        "correction_approved",
        2,
        {},
        "s1:correction_approved"
      )
    ).toEqual({ awarded: false })
    expect(events).toHaveLength(1)
    expect(profile.points).toBe(2)
  })

  it("returns awarded:false on unique violation with concurrent race", async () => {
    const { strapi, profile } = fakeStrapi()
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)

    // Patch strapi.db.query to inject a unique violation error on create
    const originalQuery = strapi.db.query
    strapi.db.query = vi.fn((uid: string) => {
      if (uid.includes("point-event")) {
        return {
          findOne: vi.fn(async () => null), // Pre-check finds nothing (concurrent race)
          create: vi.fn(async () => {
            const err = new Error("duplicate key")
            ;(err as any).code = "23505"
            throw err
          }),
        }
      }

      return originalQuery(uid)
    })

    const result = await svc.award(
      "u1",
      "correction_approved",
      2,
      {},
      "dup-key-1"
    )
    expect(result).toEqual({ awarded: false })
    expect(profile.points).toBe(0) // Points not updated
  })

  it("throws non-unique errors even with idempotencyKey set", async () => {
    const { strapi, profile } = fakeStrapi()
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)

    // Patch strapi.db.query to inject a generic error on create
    const originalQuery = strapi.db.query
    strapi.db.query = vi.fn((uid: string) => {
      if (uid.includes("point-event")) {
        return {
          findOne: vi.fn(async () => null),
          create: vi.fn(async () => {
            throw new Error("connection reset")
          }),
        }
      }

      return originalQuery(uid)
    })

    await expect(
      svc.award("u1", "correction_approved", 2, {}, "some-key")
    ).rejects.toThrow("connection reset")
    expect(profile.points).toBe(0) // Points not updated
  })
})
