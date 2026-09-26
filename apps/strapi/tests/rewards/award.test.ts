import { describe, expect, it, vi } from "vitest"

import createPoints from "../../src/plugins/rewards/server/services/points"

function fakeStrapi() {
  const events: any[] = []
  const profile = {
    baUserId: "u1",
    points: 0,
    pointsThisMonth: 0,
    lastActivityDate: null,
  }
  const increment = vi.fn(async (col: string, by: number) => {
    ;(profile as any)[col] += by
  })
  const knex: any = vi.fn(() => ({
    where: () => ({ increment, update: vi.fn(async () => {}) }),
  }))
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
