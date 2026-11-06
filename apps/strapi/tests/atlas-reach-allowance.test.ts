import { createHash } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createController from "../src/api/atlas/controllers/atlas"
import {
  parseReachAllowance,
  requestAtlasReach,
  spendReachAllowance,
} from "../src/utils/atlas-analysis"

const USER = "a".repeat(64)
const ACCOUNT = "b".repeat(64)
const HOUR = 3_600_000
const sha = (value: string) => createHash("sha256").update(value).digest("hex")

type Row = { key: string; window_start: Date; used: number }

/** Just enough knex for `atlas_analysis_budgets` and a job table. */
function fakeTrx(rows: Row[] = [], jobs: Record<string, any>[] = []) {
  const trx: any = (table: string) => {
    const preds: ((r: any) => boolean)[] = []
    const source = () => (table === "atlas_analysis_budgets" ? rows : jobs)
    const b: any = {
      where(a: any, op?: string, v?: any) {
        if (typeof a === "object")
          preds.push((r) =>
            Object.entries(a).every(([k, x]) =>
              x instanceof Date ? +r[k] === +x : r[k] === x
            )
          )
        else
          preds.push((r) =>
            op === ">" ? +r[a] > +v : op === "<" ? +r[a] < +v : r[a] === v
          )

        return b
      },
      sum() {
        b.summing = true

        return b
      },
      count() {
        b.counting = true

        return b
      },
      async first() {
        const hits = source().filter((r) => preds.every((p) => p(r)))
        if (b.summing) return { n: hits.reduce((n, r) => n + r.used, 0) }
        if (b.counting) return { n: hits.length }

        return hits[0]
      },
      insert(row: any) {
        return {
          onConflict: () => ({
            merge: async () => {
              const hit = rows.find(
                (r) =>
                  r.key === row.key && +r.window_start === +row.window_start
              )
              if (hit) hit.used += 1
              else rows.push({ ...row })
            },
          }),
          returning: async () => {
            jobs.push({
              ...row,
              state: "pending",
              expires_at: new Date(Date.now() + 7 * 24 * HOUR),
            })

            return [jobs.at(-1)]
          },
        }
      },
      async delete() {
        const keep = source().filter((r) => !preds.every((p) => p(r)))
        source().splice(0, source().length, ...keep)
      },
      update: async () => {},
    }

    return b
  }
  trx.raw = vi.fn(async () => ({}))
  trx.transaction = async (work: any) => work(trx)

  return { trx, rows, jobs }
}

describe("parseReachAllowance", () => {
  it("accepts exactly the contributor and API shapes", () => {
    expect(parseReachAllowance({ kind: "contributor", weekly: 2 })).toEqual({
      kind: "contributor",
      weekly: 2,
    })
    expect(
      parseReachAllowance({
        kind: "api",
        hourly: 20,
        daily: 100,
        accountKey: ACCOUNT,
      })
    ).toMatchObject({ kind: "api", hourly: 20, daily: 100 })
  })
  it.each([
    null,
    "contributor",
    { kind: "contributor" },
    { kind: "contributor", weekly: 0 },
    { kind: "contributor", weekly: 11 },
    { kind: "contributor", weekly: 2, hourly: 20 },
    { kind: "api", hourly: 20, daily: 100 },
    { kind: "api", hourly: 20, daily: 100, accountKey: "not-hex" },
    { kind: "api", hourly: 101, daily: 100, accountKey: ACCOUNT },
    { kind: "api", hourly: 20, daily: 1001, accountKey: ACCOUNT },
    { kind: "team", hourly: 100, capacity: 2 },
  ])("rejects %j", (value) => {
    expect(parseReachAllowance(value)).toBeNull()
  })
  it("limits a route to the kinds it accepts", () => {
    expect(
      parseReachAllowance({ kind: "contributor", weekly: 2 }, ["api"])
    ).toBeNull()
  })
})

describe("spendReachAllowance", () => {
  const now = new Date("2026-11-06T12:30:00Z")
  const window = new Date(Math.floor(now.getTime() / HOUR) * HOUR)

  it("gives a Contributor two new calculations per rolling seven days", async () => {
    const { trx, rows } = fakeTrx([
      // Eight days ago: outside the window, and pruned on admission.
      {
        key: sha(`reach-week:${USER}`),
        window_start: new Date(now.getTime() - 8 * 24 * HOUR - HOUR),
        used: 5,
      },
    ])
    const allowance = { kind: "contributor" as const, weekly: 2 }
    expect(await spendReachAllowance(trx, USER, allowance, now)).toBeNull()
    expect(await spendReachAllowance(trx, USER, allowance, now)).toBeNull()
    expect(await spendReachAllowance(trx, USER, allowance, now)).toEqual({
      status: 429,
      error: "Weekly Reach allowance reached.",
      code: "REACH_WEEKLY_LIMIT",
    })
    expect(rows).toEqual([
      { key: sha(`reach-week:${USER}`), window_start: window, used: 2 },
    ])
    // Six days later the first two are still inside the window.
    const later = new Date(now.getTime() + 6 * 24 * HOUR)
    expect((await spendReachAllowance(trx, USER, allowance, later))?.code).toBe(
      "REACH_WEEKLY_LIMIT"
    )
    // Seven days later they have rolled out.
    const week = new Date(now.getTime() + 7 * 24 * HOUR + HOUR)
    expect(await spendReachAllowance(trx, USER, allowance, week)).toBeNull()
  })

  it("applies an API organiser's hourly allowance and the account's pooled daily allowance", async () => {
    const { trx, rows } = fakeTrx()
    const api = (user: string) =>
      spendReachAllowance(
        trx,
        user,
        { kind: "api", hourly: 2, daily: 3, accountKey: ACCOUNT },
        now
      )
    expect(await api(USER)).toBeNull()
    expect(await api(USER)).toBeNull()
    expect((await api(USER))?.code).toBe("REACH_HOURLY_LIMIT")
    // A second organiser of the same account shares the daily pool.
    const other = "c".repeat(64)
    expect(await api(other)).toBeNull()
    expect(await api(other)).toEqual({
      status: 429,
      error: "Daily Reach allowance for this API account reached.",
      code: "REACH_DAILY_LIMIT",
    })
    const day = rows.find((r) => r.key === sha(`reach-day:${ACCOUNT}`))
    expect(day?.used).toBe(3)
    // The weekly Contributor counter is separate from API usage.
    expect(rows.some((r) => r.key === sha(`reach-week:${USER}`))).toBe(false)
  })
})

describe("requestAtlasReach admission", () => {
  beforeEach(() => {
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.test")
    vi.stubEnv("ANALYSIS_SERVICE_TOKEN", "test-token")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          { id: "uk-v1", countries: ["GB-ENG"], originBounds: [-9, 49, 3, 61] },
        ])
      )
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const strapiWith = (database: any) => ({
    documents: () => ({
      findOne: async () => ({
        libraryType: { name: "Public" },
        operationalStatus: "open",
        country: { iso2: "GB-ENG" },
        location: { lat: 51.5, lng: -0.1 },
      }),
    }),
    db: { connection: database },
  })
  const request = { schemaVersion: 1, libraryId: "one", mode: "walking" }
  const allowance = { kind: "contributor" as const, weekly: 1 }

  it("spends the allowance on a new job, keeps cached repeats free, then refuses a second new library", async () => {
    const { trx, rows } = fakeTrx()
    const strapi: any = strapiWith(trx)
    const first = await requestAtlasReach(strapi, request, USER, allowance)
    expect(first.status).toBe(202)
    expect(rows).toHaveLength(1)
    // The same library again: a known job, no budget spent.
    const again = await requestAtlasReach(strapi, request, USER, allowance)
    expect(again.status).toBe(202)
    expect(rows[0]!.used).toBe(1)
    const other = await requestAtlasReach(
      strapi,
      { ...request, libraryId: "two" },
      USER,
      allowance
    )
    expect(other).toEqual({
      status: 429,
      body: {
        error: "Weekly Reach allowance reached.",
        code: "REACH_WEEKLY_LIMIT",
      },
    })
  })
})

describe("Atlas bridge Reach bodies", () => {
  beforeEach(() => {
    vi.stubEnv("ATLAS_ENABLED", "true")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-test")
    vi.stubEnv("ATLAS_SERVICE_TOKEN", "token-test")
  })
  afterEach(() => vi.unstubAllEnvs())
  const context = (body: object) => {
    const ctx: any = {
      request: {
        headers: {
          "x-service-secret": "bridge-test",
          "x-atlas-token": "token-test",
        },
        body,
      },
      query: {},
      status: 200,
      body: undefined,
    }
    ctx.badRequest = (message: string) => {
      ctx.status = 400
      ctx.body = { error: message }
    }

    return ctx
  }
  const reach = { schemaVersion: 1, libraryId: "one", mode: "walking" }

  it.each([
    // The retired hourly-only and Team capacity shapes.
    { request: reach, userKey: USER, hourlyLimit: 20 },
    {
      request: reach,
      userKey: USER,
      allowance: { kind: "contributor", weekly: 2 },
      capacity: 2,
    },
    {
      request: reach,
      userKey: "short",
      allowance: { kind: "contributor", weekly: 2 },
    },
    {
      request: reach,
      userKey: USER,
      allowance: { kind: "contributor", weekly: 50 },
    },
  ])("rejects a malformed library Reach body", async (body) => {
    const strapi = { documents: vi.fn() }
    const ctx = context(body)
    await createController({ strapi } as any).reach(ctx)
    expect(ctx.status).toBe(400)
    expect(strapi.documents).not.toHaveBeenCalled()
  })

  it("accepts only an API allowance for service Reach", async () => {
    const strapi = { documents: vi.fn() }
    const ctx = context({
      request: { networkId: "one" },
      userKey: USER,
      allowance: { kind: "contributor", weekly: 2 },
    })
    await createController({ strapi } as any).networkReach(ctx)
    expect(ctx.status).toBe(400)
    expect(strapi.documents).not.toHaveBeenCalled()
  })
})
