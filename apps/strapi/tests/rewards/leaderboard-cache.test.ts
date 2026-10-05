import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createLeaderboard from "../../src/plugins/rewards/server/services/leaderboard"

function fakeStrapi(rows: { ba_user_id: string; periodPoints: string }[]) {
  const runs = vi.fn()
  let table = ""
  const builder: any = {
    select: () => builder,
    sum: () => builder,
    from: (t: string) => {
      table = t

      return builder
    },
    groupBy: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    where: () => builder,
    whereIn: () => builder,
    whereNot: () => builder,
    havingRaw: () => builder,
    raw: (sql: string, bindings?: unknown[]) => ({ sql, bindings }),
    count: () => builder,
    // eslint-disable-next-line unicorn/no-thenable -- fakes a knex query builder
    then: (resolve: (v: unknown) => void) => {
      // The submissions aggregate is a separate query added alongside the
      // points aggregate; `runs` keeps measuring recomputation of the
      // memoised leaderboard itself, not that extra query.
      if (table === "cm_submissions") return resolve([])
      runs()
      resolve(rows)
    },
  }
  const getPreviousWeekRankMap = vi.fn(async () => new Map([["u1", 3]]))
  const profileFindMany = vi.fn(async () => [
    {
      baUserId: "u1",
      username: "alice",
      profileVisibility: "public",
      points: 9,
    },
  ])
  const profileFindOne = vi.fn()
  const strapi: any = {
    db: {
      connection: builder,
      query: vi.fn(() => ({
        findMany: profileFindMany,
        findOne: profileFindOne,
      })),
    },
    plugin: vi.fn(() => ({ service: () => ({ getPreviousWeekRankMap }) })),
  }

  return { strapi, runs, getPreviousWeekRankMap, profileFindOne }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getLeaderboard memoisation", () => {
  it("serves the same (period, page, limit) from memory for 60s", async () => {
    const { strapi, runs } = fakeStrapi([
      { ba_user_id: "u1", periodPoints: "9" },
    ])
    const svc = createLeaderboard({ strapi })
    const a = await svc.getLeaderboard({ period: "month", page: 1, limit: 20 })
    const b = await svc.getLeaderboard({ period: "month", page: 1, limit: 20 })
    expect(runs).toHaveBeenCalledTimes(1)
    expect(b).toEqual(a)

    await svc.getLeaderboard({ period: "month", page: 2, limit: 20 })
    expect(runs).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(61_000)
    await svc.getLeaderboard({ period: "month", page: 1, limit: 20 })
    expect(runs).toHaveBeenCalledTimes(3)
  })

  it("keeps separate memory per strapi instance", async () => {
    const one = fakeStrapi([{ ba_user_id: "u1", periodPoints: "9" }])
    const two = fakeStrapi([{ ba_user_id: "u1", periodPoints: "1" }])
    const [a] = await createLeaderboard({ strapi: one.strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 5,
    })
    const [b] = await createLeaderboard({ strapi: two.strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 5,
    })
    expect(a.periodPoints).toBe(9)
    expect(b.periodPoints).toBe(1)
  })
})

describe("getLeaderboard rankChange", () => {
  it("compares against the weekly snapshot only for the week period", async () => {
    const { strapi, getPreviousWeekRankMap } = fakeStrapi([
      { ba_user_id: "u1", periodPoints: "9" },
    ])
    const svc = createLeaderboard({ strapi })
    const [week] = await svc.getLeaderboard({
      period: "week",
      page: 1,
      limit: 5,
    })
    expect(week.rankChange).toBe(2)
    const [month] = await svc.getLeaderboard({
      period: "month",
      page: 1,
      limit: 5,
    })
    expect(month.rankChange).toBeNull()
    expect(getPreviousWeekRankMap).toHaveBeenCalledTimes(1)
  })
})

describe("getCountryRank", () => {
  it("takes the points it already has instead of re-reading the profile", async () => {
    const { strapi, profileFindOne } = fakeStrapi([{ count: "4" }] as never)
    const svc = createLeaderboard({ strapi })
    await expect(svc.getCountryRank(120, "GB")).resolves.toBe(5)
    expect(profileFindOne).not.toHaveBeenCalled()
  })
})
