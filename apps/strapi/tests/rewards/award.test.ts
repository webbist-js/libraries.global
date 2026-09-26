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
})
