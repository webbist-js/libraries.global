import { beforeEach, describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/rewards/server/controllers/rewards"

const SECRET = "test-service-secret"

function makeCtx(over: Record<string, any> = {}) {
  const headers: Record<string, string> = {}
  const ctx: any = {
    query: {},
    request: { headers: {}, body: {} },
    state: {},
    set: vi.fn((k: string, v: string) => {
      headers[k.toLowerCase()] = v
    }),
    send: vi.fn((body: unknown) => {
      ctx.body = body

      return body
    }),
    badRequest: vi.fn((msg: string) => {
      ctx.status = 400
      ctx.body = { error: msg }

      return ctx.body
    }),
    notFound: vi.fn((msg: string) => {
      ctx.status = 404
      ctx.body = { error: msg }

      return ctx.body
    }),
    unauthorized: vi.fn((msg: string) => {
      ctx.status = 401
      ctx.body = { error: msg }

      return ctx.body
    }),
    ...over,
    responseHeaders: headers,
  }

  return ctx
}

function makeStrapi() {
  const getLeaderboard = vi.fn(async () => [])
  const award = vi.fn(async () => ({ awarded: true }))
  const findMany = vi.fn(async () => [])
  const count = vi.fn(async () => 0)
  const profileFindOne = vi.fn(async () => null)
  // Records every knex chain; each chain resolves to `rows`.
  const chains: { calls: [string, unknown[]][] }[] = []
  let rows: unknown[] = []
  const connection: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "raw") return (sql: string, b?: unknown[]) => ({ sql, b })
        if (prop === "then") return

        return (...args: unknown[]) => {
          const chain = { calls: [[prop, args]] as [string, unknown[]][] }
          chains.push(chain)
          const b: any = new Proxy(
            {},
            {
              get(_t2, p: string) {
                if (p === "then")
                  return (resolve: (v: unknown) => void) => resolve(rows)

                return (...a: unknown[]) => {
                  chain.calls.push([p, a])

                  return b
                }
              },
            }
          )

          return b
        }
      },
    }
  )
  const strapi: any = {
    db: {
      connection,
      dialect: { client: "postgres" },
      query: vi.fn((uid: string) =>
        uid === "api::user-profile.user-profile"
          ? { findOne: profileFindOne }
          : { findMany, count }
      ),
    },
    plugin: vi.fn(() => ({
      service: (name: string) =>
        name === "leaderboard" ? { getLeaderboard } : { award },
    })),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }

  return {
    strapi,
    getLeaderboard,
    award,
    findMany,
    count,
    profileFindOne,
    chains,
    setRows: (r: unknown[]) => {
      rows = r
    },
  }
}

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = SECRET
})

describe("rewards.leaderboard bounds", () => {
  it("clamps limit and page and never forwards region", async () => {
    const { strapi, getLeaderboard } = makeStrapi()
    const c: any = createController({ strapi })

    const cases: [Record<string, string>, { page: number; limit: number }][] = [
      [
        { limit: "abc", page: "x" },
        { page: 1, limit: 20 },
      ],
      [
        { limit: "-1", page: "0" },
        { page: 1, limit: 1 },
      ],
      [
        { limit: "1000000000", page: "5" },
        { page: 5, limit: 100 },
      ],
      [
        { limit: "50", region: "GB" },
        { page: 1, limit: 50 },
      ],
    ]
    for (const [query, want] of cases) {
      getLeaderboard.mockClear()
      await c.leaderboard(makeCtx({ query }))
      expect(getLeaderboard).toHaveBeenCalledTimes(1)
      const arg = (getLeaderboard.mock.calls[0] as any)[0]
      expect(arg).toMatchObject(want)
      expect("region" in arg).toBe(false)
    }
  })

  it("falls back to the month period for an unknown period", async () => {
    const { strapi, getLeaderboard } = makeStrapi()
    const c: any = createController({ strapi })
    await c.leaderboard(makeCtx({ query: { period: "forever" } }))
    expect((getLeaderboard.mock.calls[0] as any)[0].period).toBe("month")
  })

  it("sets a public 60s Cache-Control", async () => {
    const { strapi } = makeStrapi()
    const c: any = createController({ strapi })
    const ctx = makeCtx()
    await c.leaderboard(ctx)
    expect(ctx.responseHeaders["cache-control"]).toBe("public, max-age=60")
  })
})

describe("rewards.myHistory", () => {
  it("selects only the public columns and strips awardedBy from metadata", async () => {
    const { strapi, findMany } = makeStrapi()
    findMany.mockResolvedValueOnce([
      {
        action: "manual_award",
        points: 5,
        awardedAt: "2026-09-01T00:00:00.000Z",
        metadata: { reason: "thanks", awardedBy: "3" },
      },
      {
        action: "correction_approved",
        points: 2,
        awardedAt: "2026-09-02T00:00:00.000Z",
        metadata: null,
      },
    ] as never)
    const c: any = createController({ strapi })
    const ctx = makeCtx({
      query: { page: "0" },
      request: {
        headers: { "x-service-secret": SECRET, "x-ba-user-id": "u1" },
        body: {},
      },
    })
    await c.myHistory(ctx)

    const params = (findMany.mock.calls[0] as any)[0]
    expect(params.select).toEqual(["action", "points", "awardedAt", "metadata"])
    expect(params.offset).toBe(0)
    expect(params.limit).toBe(50)
    expect(ctx.body.data).toEqual([
      {
        action: "manual_award",
        points: 5,
        awardedAt: "2026-09-01T00:00:00.000Z",
        metadata: { reason: "thanks" },
      },
      {
        action: "correction_approved",
        points: 2,
        awardedAt: "2026-09-02T00:00:00.000Z",
        metadata: null,
      },
    ])
  })
})

describe("rewards.adminEvents", () => {
  it("clamps the page", async () => {
    const { strapi, findMany } = makeStrapi()
    const c: any = createController({ strapi })
    await c.adminEvents(makeCtx({ query: { page: "-3" } }))
    const params = (findMany.mock.calls[0] as any)[0]
    expect(params.offset).toBe(0)
    expect(params.limit).toBe(50)
  })
})

describe("rewards.adminChartData", () => {
  it("runs one grouped query for the daily series and fills empty days", async () => {
    const { strapi, chains, setRows } = makeStrapi()
    const today = new Date().toISOString().slice(0, 10)
    setRows([{ day: new Date(today + "T00:00:00.000Z"), total: "12" }])
    const c: any = createController({ strapi })
    const ctx = makeCtx()
    await c.adminChartData(ctx)

    // One daily aggregate plus one action breakdown: two chains, not 31.
    expect(chains).toHaveLength(2)
    const daily = chains[0]
    expect(daily.calls.some(([m]) => m === "groupBy")).toBe(true)
    const rawSql = JSON.stringify(daily.calls)
    expect(rawSql).toContain("date_trunc('day', awarded_at)")

    const { dailyPoints } = ctx.body.data
    expect(dailyPoints).toHaveLength(30)
    expect(dailyPoints[29]).toEqual({ date: today, points: 12 })
    expect(dailyPoints[0].points).toBe(0)
  })
})

describe("rewards.adminAward", () => {
  const body = {
    baUserId: "u1",
    action: "manual_award",
    points: 10,
    reason: "helpful",
    clientRequestId: "5f1c9c4e-1111-4222-8333-444455556666",
  }
  const admin = { user: { id: 7 } }

  function ready() {
    const s = makeStrapi()
    s.profileFindOne.mockResolvedValue({ id: 1, baUserId: "u1" } as never)

    return s
  }

  it("awards with an idempotency key from the admin, user and request id", async () => {
    const { strapi, award } = ready()
    const c: any = createController({ strapi })
    const ctx = makeCtx({ request: { headers: {}, body }, state: admin })
    await c.adminAward(ctx)
    expect(award).toHaveBeenCalledWith(
      "u1",
      "manual_award",
      10,
      { reason: "helpful", awardedBy: "7" },
      "admin:7:u1:5f1c9c4e-1111-4222-8333-444455556666"
    )
    expect(ctx.body).toEqual({ ok: true, awarded: true })
  })

  it("negates points for a deduction", async () => {
    const { strapi, award } = ready()
    const c: any = createController({ strapi })
    await c.adminAward(
      makeCtx({
        request: { headers: {}, body: { ...body, action: "manual_deduct" } },
        state: admin,
      })
    )
    expect((award.mock.calls[0] as any)[2]).toBe(-10)
  })

  it("requires clientRequestId", async () => {
    const { strapi, award } = ready()
    const c: any = createController({ strapi })
    const { clientRequestId: _c, ...noId } = body
    const ctx = makeCtx({ request: { headers: {}, body: noId }, state: admin })
    await c.adminAward(ctx)
    expect(ctx.status).toBe(400)
    expect(award).not.toHaveBeenCalled()
  })

  it("rejects points outside [1, 500] and non-integers", async () => {
    const { strapi, award } = ready()
    const c: any = createController({ strapi })
    for (const points of [0, 501, 2.5, -10, "ten", Number.NaN]) {
      const ctx = makeCtx({
        request: { headers: {}, body: { ...body, points } },
        state: admin,
      })
      await c.adminAward(ctx)
      expect(ctx.status, String(points)).toBe(400)
    }
    expect(award).not.toHaveBeenCalled()
  })

  it("does not create a profile for an unknown baUserId", async () => {
    const { strapi, award, profileFindOne } = makeStrapi()
    profileFindOne.mockResolvedValue(null)
    const c: any = createController({ strapi })
    const ctx = makeCtx({ request: { headers: {}, body }, state: admin })
    await c.adminAward(ctx)
    expect(ctx.status).toBe(404)
    expect(award).not.toHaveBeenCalled()
  })

  it("refuses without an admin identity", async () => {
    const { strapi, award } = ready()
    const c: any = createController({ strapi })
    const ctx = makeCtx({ request: { headers: {}, body }, state: {} })
    await c.adminAward(ctx)
    expect(ctx.status).toBe(401)
    expect(award).not.toHaveBeenCalled()
  })
})
