import { describe, expect, it, vi } from "vitest"

import createSnapshot, {
  getISOWeek,
  previousWeekWindow,
} from "../../src/plugins/rewards/server/services/snapshot"

function fakeStrapi(opts: { existing?: boolean; createError?: unknown } = {}) {
  const whereCalls: unknown[][] = []
  const builder: any = {
    select: () => builder,
    sum: () => builder,
    from: () => builder,
    groupBy: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    where: (...args: unknown[]) => {
      whereCalls.push(args)

      return builder
    },
    // eslint-disable-next-line unicorn/no-thenable -- fakes a knex query builder
    then: (resolve: (v: unknown) => void) =>
      resolve([{ ba_user_id: "u1", periodPoints: "5" }]),
  }
  const create = vi.fn(async ({ data }: any) => {
    if (opts.createError) throw opts.createError

    return data
  })
  const strapi: any = {
    db: {
      connection: builder,
      query: vi.fn((uid: string) =>
        uid.endsWith("leaderboard-snapshot")
          ? {
              findOne: vi.fn(async () => (opts.existing ? { id: 1 } : null)),
              create,
            }
          : { findMany: vi.fn(async () => [{ baUserId: "u1", username: "a" }]) }
      ),
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  return { strapi, whereCalls, create }
}

describe("previousWeekWindow", () => {
  it("is the previous Monday 00:00 to this Monday 00:00 (UTC)", () => {
    const monday = new Date("2026-10-05T00:05:00.000Z")
    expect(previousWeekWindow(monday)).toEqual({
      start: new Date("2026-09-28T00:00:00.000Z"),
      end: new Date("2026-10-05T00:00:00.000Z"),
    })
    // Mid-week (a manual admin trigger) still means last week's full window.
    const wednesday = new Date("2026-10-07T15:30:00.000Z")
    expect(previousWeekWindow(wednesday)).toEqual(previousWeekWindow(monday))
    // Sunday belongs to the week that started the previous Monday.
    const sunday = new Date("2026-10-04T23:59:00.000Z")
    expect(previousWeekWindow(sunday)).toEqual({
      start: new Date("2026-09-21T00:00:00.000Z"),
      end: new Date("2026-09-28T00:00:00.000Z"),
    })
  })
})

describe("takeWeeklySnapshot", () => {
  it("on Monday 00:05 snapshots the prior seven days under last week's key", async () => {
    const { strapi, whereCalls, create } = fakeStrapi()
    await createSnapshot({ strapi }).takeWeeklySnapshot(
      new Date("2026-10-05T00:05:00.000Z")
    )
    expect(whereCalls).toEqual([
      ["awarded_at", ">=", "2026-09-28T00:00:00.000Z"],
      ["awarded_at", "<", "2026-10-05T00:00:00.000Z"],
    ])
    expect(create).toHaveBeenCalledTimes(1)
    const data = create.mock.calls[0][0].data
    expect(data.period).toBe(getISOWeek(new Date("2026-09-28T00:00:00.000Z")))
    expect(data.period).toBe("2026-W40")
    expect(data.periodType).toBe("weekly")
    expect(data.entries).toEqual([
      { baUserId: "u1", username: "a", rank: 1, periodPoints: 5 },
    ])
  })

  it("skips when the period already has a snapshot", async () => {
    const { strapi, create } = fakeStrapi({ existing: true })
    await createSnapshot({ strapi }).takeWeeklySnapshot(
      new Date("2026-10-05T00:05:00.000Z")
    )
    expect(create).not.toHaveBeenCalled()
  })

  it("treats a unique violation on insert as already taken", async () => {
    const err = Object.assign(new Error("duplicate key"), { code: "23505" })
    const { strapi } = fakeStrapi({ createError: err })
    await expect(
      createSnapshot({ strapi }).takeWeeklySnapshot(
        new Date("2026-10-05T00:05:00.000Z")
      )
    ).resolves.toBeUndefined()
    expect(strapi.log.error).not.toHaveBeenCalled()
  })

  it("still throws other insert errors", async () => {
    const { strapi } = fakeStrapi({ createError: new Error("disk full") })
    await expect(
      createSnapshot({ strapi }).takeWeeklySnapshot(
        new Date("2026-10-05T00:05:00.000Z")
      )
    ).rejects.toThrow("disk full")
  })
})
