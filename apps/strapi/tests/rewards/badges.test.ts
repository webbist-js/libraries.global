import { describe, expect, it, vi } from "vitest"

import createBadges, {
  BADGE_DEFINITIONS,
} from "../../src/plugins/rewards/server/services/badges"

function fakeStrapi(opts: {
  counts?: { action: string; count: number }[]
  total?: number
  existing?: string[]
  profileStreak?: number
  createError?: (badgeId: string) => unknown
}) {
  // Chains resolve in order: action counts, then the points sum.
  const results: unknown[][] = [opts.counts ?? [], [{ total: opts.total ?? 0 }]]
  const connection: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return

        return () => {
          const rows = results.shift() ?? []
          const b: any = new Proxy(
            {},
            {
              get(_t2, p: string) {
                if (p === "then")
                  return (resolve: (v: unknown) => void) => resolve(rows)

                return () => b
              },
            }
          )

          return b
        }
      },
    }
  )
  const created: string[] = []
  const create = vi.fn(async ({ data }: any) => {
    const err = opts.createError?.(data.badgeId)
    if (err) throw err
    created.push(data.badgeId)

    return data
  })
  const profileFindOne = vi.fn(async () => ({
    streak: opts.profileStreak ?? 0,
  }))
  const strapi: any = {
    db: {
      connection,
      query: vi.fn((uid: string) =>
        uid.endsWith("badge-award")
          ? {
              findMany: vi.fn(async () =>
                (opts.existing ?? []).map((badgeId) => ({ badgeId }))
              ),
            }
          : { findOne: profileFindOne }
      ),
    },
    documents: vi.fn(() => ({ create })),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  return { strapi, created, create, profileFindOne }
}

describe("badges.checkAndAward", () => {
  it("awards streak badges from the profile's current streak", async () => {
    const { strapi, created } = fakeStrapi({})
    await createBadges({ strapi }).checkAndAward("u1", { streak: 7 })
    expect(created).toEqual(["dawn_shift"])
  })

  it("reads the streak from the profile when not given one", async () => {
    const { strapi, created, profileFindOne } = fakeStrapi({
      profileStreak: 30,
    })
    await createBadges({ strapi }).checkAndAward("u1")
    expect(profileFindOne).toHaveBeenCalledTimes(1)
    expect(created).toEqual(["dawn_shift", "streaker"])
  })

  it("does not award a streak badge below the threshold", async () => {
    const { strapi, created } = fakeStrapi({})
    await createBadges({ strapi }).checkAndAward("u1", { streak: 6 })
    expect(created).toEqual([])
  })

  it("treats a unique violation as already awarded and carries on", async () => {
    const { strapi, created, create } = fakeStrapi({
      total: 600,
      createError: (badgeId) =>
        badgeId === "first_light"
          ? Object.assign(new Error("duplicate key"), { code: "23505" })
          : null,
    })
    await expect(
      createBadges({ strapi }).checkAndAward("u1", { streak: 0 })
    ).resolves.toBeUndefined()
    expect(create).toHaveBeenCalledTimes(2)
    expect(created).toEqual(["overdue_fine"])
  })

  it("still throws other insert errors", async () => {
    const { strapi } = fakeStrapi({
      total: 60,
      createError: () => new Error("disk full"),
    })
    await expect(
      createBadges({ strapi }).checkAndAward("u1", { streak: 0 })
    ).rejects.toThrow("disk full")
  })

  it("no badge definition depends on counting daily_streak events", () => {
    const counts = { daily_streak: 1000, __total_points: 0, __streak: 0 }
    for (const def of BADGE_DEFINITIONS) {
      expect(def.check(counts), def.id).toBe(false)
    }
  })
})
