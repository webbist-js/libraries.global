import { afterEach, describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/content-moderation/server/controllers/submission"
import contentApiRoutes from "../../src/plugins/content-moderation/server/routes/content-api"
import createHistory, {
  backfillLibraryHistory,
} from "../../src/plugins/content-moderation/server/services/history"
import { migrateReviewerPrefix } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const CHANGE = "api::library-change.library-change"
const ARTICLE_CHANGE = "api::article-change.article-change"
const PROFILE = "api::user-profile.user-profile"
const LIB = "lib00000000000000000001"

const camel = (s: string) =>
  s.replaceAll(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/**
 * A knex stand-in that evaluates the handful of shapes the history service
 * builds (where / groupBy / count / countDistinct / max / orderBy / limit /
 * offset, plus the month and contributor raw expressions) over the fake
 * store, so grouping, ordering and filtering are exercised for real.
 */
function knexOver(store: Record<string, any[]>) {
  const queries: { table: string; ops: [string, any[]][] }[] = []
  const monthOf = (r: any) => String(r.changedAt).slice(0, 7)
  const knex: any = (table: string) => {
    const entry = { table, ops: [] as [string, any[]][] }
    queries.push(entry)
    const run = () => {
      const ops = entry.ops
      const rows = (store[CHANGE] ?? []).filter((r) =>
        ops
          .filter(([m]) => m === "where")
          .every(([, a]) =>
            a.length === 3
              ? a[1] === ">="
                ? String(r[camel(a[0])]) >= String(a[2])
                : a[1] === "<>"
                  ? r[camel(a[0])] !== a[2]
                  : false
              : r[camel(a[0])] === a[1]
          )
      )
      const groupKeys = ops
        .filter(([m]) => m === "groupBy")
        .flatMap(([, a]) => a)
        .map((k: any) => (typeof k === "string" ? k : "month"))
      const keyOf = (r: any, k: string) =>
        k === "month" ? monthOf(r) : r[camel(k)]
      const groups = new Map<string, any[]>()
      if (groupKeys.length === 0) groups.set("all", rows)
      else
        for (const r of rows) {
          const key = JSON.stringify(groupKeys.map((k) => keyOf(r, k)))
          groups.set(key, [...(groups.get(key) ?? []), r])
        }
      let out = [...groups.values()].map((g) => {
        const o: Record<string, any> = {}
        for (const k of groupKeys) o[k] = keyOf(g[0], k)
        for (const [m, a] of ops) {
          const spec = a[0]
          if (m === "count")
            for (const alias of Object.keys(spec)) o[alias] = String(g.length)
          if (m === "countDistinct")
            for (const [alias, col] of Object.entries(spec))
              o[alias] = String(
                new Set(g.map((r) => r[camel(col as string)])).size
              )
          if (m === "max")
            for (const [alias, col] of Object.entries(spec))
              o[alias] = g
                .map((r) => r[camel(col as string)])
                .sort()
                .at(-1)
          if (m === "select")
            for (const s of a) {
              if (typeof s === "string") o[s] = g[0]?.[camel(s)]
              else if (s.sql.endsWith(" as month")) o.month = monthOf(g[0])
              else if (s.sql.endsWith(" as contributors"))
                o.contributors = String(
                  new Set(
                    g
                      .filter((r) => r.actorKind === "contributor")
                      .map((r) => r.actorId)
                  ).size
                )
            }
        }

        return o
      })
      for (const [, a] of ops.filter(([m]) => m === "orderBy").reverse()) {
        const specs = Array.isArray(a[0])
          ? a[0]
          : [{ column: a[0], order: a[1] ?? "asc" }]
        for (const { column, order } of [...specs].reverse())
          out = [...out].sort((x, y) => {
            const c =
              String(x[column]) < String(y[column])
                ? -1
                : String(x[column]) > String(y[column])
                  ? 1
                  : 0

            return order === "desc" ? -c : c
          })
      }
      const offset = ops.find(([m]) => m === "offset")?.[1][0] ?? 0
      const limit = ops.find(([m]) => m === "limit")?.[1][0]
      out = out.slice(offset, limit === undefined ? undefined : offset + limit)

      return ops.some(([m]) => m === "first") ? out[0] : out
    }
    const builder: any = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then")
            return (res: any, rej?: any) =>
              Promise.resolve().then(run).then(res, rej)

          return (...args: any[]) => {
            entry.ops.push([String(prop), args])

            return builder
          }
        },
      }
    )

    return builder
  }
  knex.raw = (sql: string) => ({ sql })

  return { knex, queries }
}

const row = (over: Record<string, any>) => ({
  libraryDocumentId: LIB,
  versionStatus: "published",
  action: "update",
  source: "submission",
  actorKind: "contributor",
  actorId: "ba:u1",
  previous: "old",
  next: "new",
  ...over,
})

function setup(
  changes: Record<string, any>[],
  extra: Record<string, any[]> = {},
  client = "postgres"
) {
  let n = 0
  const seeded = changes.map((c) => ({
    id: ++n,
    documentId: `c${String(n).padStart(23, "0")}`,
    ...c,
  }))
  const f = makeFakeStrapi({ [CHANGE]: seeded, ...extra })
  const { knex, queries } = knexOver(f.store)
  f.strapi.db.connection = knex
  f.strapi.db.dialect = { client }
  const history = createHistory({ strapi: f.strapi })
  f.services["content-moderation.history"] = history

  return { ...f, history, queries }
}

const PROFILES = [
  {
    documentId: "p1",
    baUserId: "u1",
    username: "alice",
    profileVisibility: "public",
  },
  {
    documentId: "p2",
    baUserId: "u2",
    username: "bob",
    profileVisibility: "private",
  },
  {
    documentId: "p3",
    baUserId: "u3",
    username: "carol",
    publicPrefs: { showActivity: false },
  },
]

describe("libraryHistory", () => {
  const seed = () => [
    row({
      batchId: "b1",
      field: "name",
      changedAt: "2026-01-05T10:00:00.000Z",
    }),
    row({
      batchId: "b1",
      field: "city",
      changedAt: "2026-01-05T10:00:00.000Z",
    }),
    row({
      batchId: "b2",
      field: "phone",
      actorId: "ba:u2",
      changedAt: "2026-02-01T10:00:00.000Z",
    }),
    row({
      batchId: "b3",
      field: "email",
      actorKind: "admin",
      actorId: "admin:1",
      source: "admin",
      changedAt: "2026-03-01T10:00:00.000Z",
      submissionDocumentId: null,
    }),
    row({
      batchId: "b4",
      field: "name",
      versionStatus: "draft",
      changedAt: "2026-04-01T10:00:00.000Z",
    }),
    row({
      batchId: "b5",
      field: "name",
      libraryDocumentId: "other0000000000000000001",
      changedAt: "2026-05-01T10:00:00.000Z",
    }),
    row({
      batchId: "b6",
      field: "summary",
      actorId: "ba:u3",
      submissionDocumentId: "s0000000000000000000009",
      changedAt: "2026-01-20T10:00:00.000Z",
    }),
  ]

  it("groups published rows into batches, newest first, and skips drafts and other libraries", async () => {
    const { history } = setup(seed(), { [PROFILE]: PROFILES })
    const out = await history.libraryHistory(LIB, {
      page: 1,
      pageSize: 20,
      values: false,
    })
    expect(out.meta).toEqual({ page: 1, pageSize: 20, total: 4 })
    expect(out.data.map((b: any) => b.batchId)).toEqual([
      "b3",
      "b2",
      "b6",
      "b1",
    ])
    const b1 = out.data.at(-1)
    expect(b1.fields.map((f: any) => f.field).sort()).toEqual(["city", "name"])
    expect(b1).toMatchObject({
      changedAt: "2026-01-05T10:00:00.000Z",
      action: "update",
      source: "submission",
    })
  })

  it("strips values unless asked for them", async () => {
    const { history } = setup(seed(), { [PROFILE]: PROFILES })
    const bare = await history.libraryHistory(LIB, {
      page: 1,
      pageSize: 20,
      values: false,
    })
    for (const b of bare.data)
      for (const f of b.fields) {
        expect(f).not.toHaveProperty("previous")
        expect(f).not.toHaveProperty("next")
      }
    const full = await history.libraryHistory(LIB, {
      page: 1,
      pageSize: 20,
      values: true,
    })
    expect(full.data[0].fields[0]).toEqual({
      field: "email",
      previous: "old",
      next: "new",
    })
  })

  it("names only contributors whose activity is public", async () => {
    const { history } = setup(seed(), { [PROFILE]: PROFILES })
    const out = await history.libraryHistory(LIB, {
      page: 1,
      pageSize: 20,
      values: false,
    })
    const by = Object.fromEntries(out.data.map((b: any) => [b.batchId, b]))
    expect(by.b1.actor).toEqual({ kind: "contributor", username: "alice" })
    expect(by.b2.actor).toEqual({ kind: "contributor", username: null })
    expect(by.b6.actor).toEqual({ kind: "contributor", username: null })
    expect(by.b3.actor).toEqual({ kind: "admin", username: null })
    expect(by.b6.submissionDocumentId).toBe("s0000000000000000000009")
    expect(by.b3.submissionDocumentId).toBeNull()
  })

  it("pages batches", async () => {
    const { history } = setup(seed(), { [PROFILE]: PROFILES })
    const out = await history.libraryHistory(LIB, {
      page: 2,
      pageSize: 3,
      values: false,
    })
    expect(out.meta).toEqual({ page: 2, pageSize: 3, total: 4 })
    expect(out.data.map((b: any) => b.batchId)).toEqual(["b1"])
  })
})

describe("libraryHistoryStats", () => {
  afterEach(() => vi.useRealTimers())

  it("counts batches, fields and contributors per month over published rows", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-15T00:00:00.000Z"))
    const { history, queries } = setup([
      row({
        batchId: "b1",
        field: "name",
        changedAt: "2026-01-05T10:00:00.000Z",
      }),
      row({
        batchId: "b1",
        field: "city",
        changedAt: "2026-01-05T10:00:00.000Z",
      }),
      row({
        batchId: "b2",
        field: "lastVerifiedAt",
        actorId: "ba:u2",
        changedAt: "2026-01-09T10:00:00.000Z",
      }),
      row({
        batchId: "b3",
        field: "name",
        actorKind: "admin",
        actorId: "admin:1",
        action: "publish",
        changedAt: "2026-03-01T10:00:00.000Z",
      }),
      row({
        batchId: "b4",
        field: "name",
        versionStatus: "draft",
        changedAt: "2026-03-02T10:00:00.000Z",
      }),
      row({
        batchId: "b0",
        field: "name",
        changedAt: "2025-01-01T10:00:00.000Z",
      }),
      row({
        batchId: "initial-import",
        field: "*",
        action: "create",
        source: "import",
        changedAt: "2026-01-01T10:00:00.000Z",
      }),
    ])
    const out = await history.libraryHistoryStats(LIB, 3)
    expect(out.months).toEqual([
      { month: "2026-01", batches: 2, fields: 3, contributors: 2 },
      { month: "2026-02", batches: 0, fields: 0, contributors: 0 },
      { month: "2026-03", batches: 1, fields: 1, contributors: 0 },
    ])
    expect(out.byField).toEqual([
      { field: "name", count: 2 },
      { field: "city", count: 1 },
      { field: "lastVerifiedAt", count: 1 },
    ])
    expect(out.byAction).toEqual([
      { action: "update", count: 2 },
      { action: "publish", count: 1 },
    ])
    expect(out.verificationEvents).toEqual(["2026-01"])
    const raw = JSON.stringify(queries.map((q) => q.ops))
    expect(raw).toContain("date_trunc('month'")
    expect(raw).not.toContain("strftime")
  })

  it("uses strftime on SQLite", async () => {
    const { history, queries } = setup([], {}, "sqlite")
    await history.libraryHistoryStats(LIB, 24)
    const raw = JSON.stringify(queries.map((q) => q.ops))
    expect(raw).toContain("strftime('%Y-%m', changed_at)")
    expect(raw).not.toContain("date_trunc")
    // The window filter and the month expression read changed_at the same
    // way (ISO text): no epoch-millisecond branch in one but not the other.
    expect(raw).not.toContain("unixepoch")
  })
})

describe("articleHistory", () => {
  it("lists published Article Changes for one article, newest first", async () => {
    const { history } = setup([], {
      [ARTICLE_CHANGE]: [
        {
          id: 1,
          documentId: "a1",
          articleKind: "wiki",
          articleDocumentId: "art1",
          contentLocale: "en",
          versionStatus: "published",
          kind: "created",
          actorKind: "contributor",
          actorId: "ba:u1",
          changedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          documentId: "a2",
          articleKind: "wiki",
          articleDocumentId: "art1",
          contentLocale: "cs",
          versionStatus: "published",
          kind: "translated",
          actorKind: "admin",
          actorId: "admin:1",
          editSummary: "Czech",
          changedAt: "2026-02-01T00:00:00.000Z",
        },
        {
          id: 3,
          documentId: "a3",
          articleKind: "wiki",
          articleDocumentId: "art1",
          versionStatus: "draft",
          kind: "edited",
          changedAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: 4,
          documentId: "a4",
          articleKind: "blog",
          articleDocumentId: "art1",
          versionStatus: "published",
          kind: "edited",
          changedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      [PROFILE]: PROFILES,
    })
    const out = await history.articleHistory("wiki", "art1", {
      page: 1,
      pageSize: 20,
    })
    expect(out.meta).toEqual({ page: 1, pageSize: 20, total: 2 })
    expect(out.data).toEqual([
      {
        changedAt: "2026-02-01T00:00:00.000Z",
        kind: "translated",
        locale: "cs",
        actor: { kind: "admin", username: null },
        editSummary: "Czech",
      },
      {
        changedAt: "2026-01-01T00:00:00.000Z",
        kind: "created",
        locale: "en",
        actor: { kind: "contributor", username: "alice" },
        editSummary: null,
      },
    ])
  })
})

describe("history routes and controller", () => {
  it("exposes the three history routes and drops /revisions", () => {
    const paths = contentApiRoutes.map((r: any) => `${r.method} ${r.path}`)
    expect(paths).toContain("GET /libraries/:documentId/history")
    expect(paths).toContain("GET /libraries/:documentId/history/stats")
    expect(paths).toContain("GET /articles/:kind/:documentId/history")
    expect(paths).not.toContain("GET /libraries/:documentId/revisions")
    for (const r of contentApiRoutes.filter((r: any) =>
      r.path.includes("/history")
    ))
      expect(r.config.auth).toBe(false)
  })

  const ctxFor = (over: Record<string, any>) => ({
    params: { documentId: LIB },
    query: {},
    request: { headers: {} },
    set: vi.fn(),
    badRequest: vi.fn(),
    ...over,
  })

  it("clamps page size and only honours values for a bridged user entitled to library.history", async () => {
    process.env.STRAPI_BRIDGE_SECRET = "sekrit"
    const { strapi, history } = setup([], {
      [PROFILE]: [
        { documentId: "pp", baUserId: "pro", tier: "Reader" },
        { documentId: "pa", baUserId: "archivist", tier: "Archivist" },
        { documentId: "pf", baUserId: "free", tier: "Reader" },
        {
          documentId: "pe",
          baUserId: "expired",
          tier: "Reader",
          earnedProUntil: "2020-01-01T00:00:00.000Z",
        },
      ],
      "api::entitlement-grant.entitlement-grant": [
        { documentId: "g1", baUserId: "pro", plan: "pro", expiresAt: null },
        {
          documentId: "g2",
          baUserId: "free",
          plan: "pro",
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      "api::pro-verification.pro-verification": [],
    })
    const spy = vi.spyOn(history, "libraryHistory")
    const c = createController({ strapi })
    await c.libraryHistory(ctxFor({ query: { pageSize: "500", values: "1" } }))
    expect(spy).toHaveBeenLastCalledWith(LIB, {
      page: 1,
      pageSize: 50,
      values: false,
    })
    const asUser = (headers: Record<string, string>) =>
      c.libraryHistory(
        ctxFor({
          query: { page: "2", values: "1" },
          request: { headers },
        })
      )
    const lastValues = () => (spy.mock.lastCall![1] as any).values

    // The secret alone is not enough: values are a Pro feature.
    await asUser({ "x-service-secret": "sekrit" })
    expect(lastValues()).toBe(false)
    // A user id without the secret is not trusted.
    await asUser({ "x-ba-user-id": "pro" })
    expect(lastValues()).toBe(false)
    for (const [user, allowed] of [
      ["pro", true], // a plan grant
      ["archivist", true], // earned Pro
      ["free", false], // an expired grant
      ["expired", false], // an earned-Pro hold that ended
      ["nobody", false], // no profile at all
    ] as const) {
      await asUser({ "x-service-secret": "sekrit", "x-ba-user-id": user })
      expect(lastValues()).toBe(allowed)
    }
    expect(spy).toHaveBeenLastCalledWith(LIB, {
      page: 2,
      pageSize: 20,
      values: false,
    })
    await c.libraryHistory(ctxFor({ query: { pageSize: "0" } }))
    expect(spy).toHaveBeenLastCalledWith(LIB, {
      page: 1,
      pageSize: 1,
      values: false,
    })
  })

  it("clamps months and validates the article kind", async () => {
    const { strapi, history } = setup([])
    const stats = vi.spyOn(history, "libraryHistoryStats")
    const articles = vi.spyOn(history, "articleHistory")
    const c = createController({ strapi })
    await c.libraryHistoryStats(ctxFor({ query: { months: "999" } }))
    expect(stats).toHaveBeenLastCalledWith(LIB, 60)
    await c.libraryHistoryStats(ctxFor({ query: {} }))
    expect(stats).toHaveBeenLastCalledWith(LIB, 24)
    const bad = ctxFor({ params: { kind: "page", documentId: LIB } })
    await c.articleHistory(bad)
    expect(bad.badRequest).toHaveBeenCalled()
    expect(articles).not.toHaveBeenCalled()
    await c.articleHistory(
      ctxFor({ params: { kind: "blog", documentId: LIB } })
    )
    expect(articles).toHaveBeenLastCalledWith("blog", LIB, {
      page: 1,
      pageSize: 20,
    })
  })
})

function withStore(strapi: any) {
  const kv = new Map<string, unknown>()
  strapi.store = vi.fn(() => ({
    get: async ({ key }: { key: string }) => kv.get(key),
    set: async ({ key, value }: { key: string; value: unknown }) => {
      kv.set(key, value)
    },
  }))

  return kv
}

describe("library-history-backfill-v1", () => {
  it("creates one batch per approved library submission and runs once", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        {
          id: 1,
          documentId: "s1",
          status: "approved",
          submissionType: "correction",
          targetEntityType: "library",
          targetDocumentId: LIB,
          submittedByUserId: "u1",
          contentLocale: "en",
          reviewedAt: "2026-01-02T00:00:00.000Z",
          fields: { kind: "record", previous: {}, name: "A", city: "B" },
        },
        {
          id: 2,
          documentId: "s2",
          status: "approved",
          submissionType: "library_edit",
          targetEntityType: "library",
          targetDocumentId: LIB,
          submittedByUserId: "u2",
          reviewedAt: "2026-01-03T00:00:00.000Z",
          fields: { phone: "1" },
        },
        {
          id: 3,
          documentId: "s3",
          status: "rejected",
          targetEntityType: "library",
          targetDocumentId: LIB,
          submittedByUserId: "u1",
          fields: { name: "x" },
        },
        {
          id: 4,
          documentId: "s4",
          status: "approved",
          targetEntityType: "wiki_article",
          targetDocumentId: "art1",
          submittedByUserId: "u1",
          fields: { title: "x" },
        },
        {
          id: 5,
          documentId: "s5",
          status: "approved",
          targetEntityType: "library",
          submittedByUserId: "u1",
          fields: { name: "no target" },
        },
      ],
    })
    withStore(f.strapi)
    await backfillLibraryHistory(f.strapi)
    const rows = f.store[CHANGE]
    expect(rows).toHaveLength(3)
    const s1 = rows.filter((r: any) => r.submissionDocumentId === "s1")
    expect(s1.map((r: any) => r.field).sort()).toEqual(["city", "name"])
    expect(new Set(s1.map((r: any) => r.batchId)).size).toBe(1)
    expect(s1[0]).toMatchObject({
      libraryDocumentId: LIB,
      previous: null,
      next: null,
      source: "submission",
      actorKind: "contributor",
      actorId: "ba:u1",
      versionStatus: "published",
      action: "update",
      changedAt: "2026-01-02T00:00:00.000Z",
      contentLocale: "en",
    })
    const s2 = rows.filter((r: any) => r.submissionDocumentId === "s2")
    expect(s2).toHaveLength(1)
    expect(s2[0].batchId).not.toBe(s1[0].batchId)

    await backfillLibraryHistory(f.strapi)
    expect(f.store[CHANGE]).toHaveLength(3)
  })
})

describe("library-history-backfill-v1: what counts as a record edit", () => {
  const approved = (id: number, over: Record<string, any>) => ({
    id,
    documentId: `s${id}`,
    status: "approved",
    targetEntityType: "library",
    targetDocumentId: LIB,
    submittedByUserId: "u1",
    reviewedAt: "2026-01-02T00:00:00.000Z",
    ...over,
  })

  it("backfills library_edit and record corrections only", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        approved(1, {
          submissionType: "library_claim",
          fields: { role: "librarian", department: "Rare books" },
        }),
        approved(2, {
          submissionType: "correction",
          fields: { kind: "facilities", answers: { wifi: "yes" } },
        }),
        approved(3, {
          submissionType: "correction",
          fields: { kind: "photo", photoId: 12, caption: "Front" },
        }),
        approved(4, {
          submissionType: "correction",
          fields: { kind: "record", previous: {}, name: "A" },
        }),
        approved(5, { submissionType: "library_edit", fields: { phone: "1" } }),
        approved(6, {
          submissionType: "correction",
          fields: { category: "hours", libraryName: "X" },
        }),
      ],
    })
    withStore(f.strapi)
    await backfillLibraryHistory(f.strapi)
    const bySub = (f.store[CHANGE] ?? []).map(
      (r: any) => `${r.submissionDocumentId}:${r.field}`
    )
    expect(bySub.sort()).toEqual(["s4:name", "s5:phone"])
  })

  it("records only allowlisted library fields, under their library names", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        approved(1, {
          submissionType: "library_edit",
          fields: {
            phone: "1",
            lat: "51.5",
            lng: "-0.1",
            regionDocumentId: "r0000000000000000000001",
            isAdmin: true,
            "<script>": "x",
          },
        }),
        approved(2, {
          submissionType: "correction",
          fields: { kind: "record", previous: {}, notAField: "x" },
        }),
      ],
    })
    withStore(f.strapi)
    await backfillLibraryHistory(f.strapi)
    const bySub = (f.store[CHANGE] ?? []).map(
      (r: any) => `${r.submissionDocumentId}:${r.field}`
    )
    expect(bySub.sort()).toEqual(["s1:location", "s1:phone", "s1:region"])
  })

  it("writes a batch atomically: a failed row leaves none of it", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        approved(1, {
          submissionType: "library_edit",
          fields: { name: "A", city: "B" },
        }),
      ],
    })
    withStore(f.strapi)
    const original = f.strapi.documents
    let creates = 0
    f.strapi.documents = vi.fn((uid: string) => {
      const api = original(uid)
      if (uid !== CHANGE) return api

      return {
        ...api,
        create: vi.fn(async (args: any) => {
          creates += 1
          if (creates === 2) throw new Error("db down")

          return api.create(args)
        }),
      }
    })
    await expect(backfillLibraryHistory(f.strapi)).rejects.toThrow("db down")
    expect(f.store[CHANGE] ?? []).toHaveLength(0)
  })

  it("attributes a submission without a submitter to system", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        approved(1, {
          submissionType: "library_edit",
          submittedByUserId: undefined,
          fields: { name: "A" },
        }),
      ],
    })
    withStore(f.strapi)
    await backfillLibraryHistory(f.strapi)
    expect(f.store[CHANGE]![0]).toMatchObject({
      actorKind: "system",
      actorId: "system",
    })
  })
})

describe("history row cap", () => {
  it("warns when a page of batches hits the row cap", async () => {
    const many = Array.from({ length: 5000 }, (_, i) =>
      row({
        batchId: "b1",
        field: `f${i}`,
        changedAt: "2026-01-05T10:00:00.000Z",
      })
    )
    const { history, strapi } = setup(many)
    await history.libraryHistory(LIB, { page: 1, pageSize: 20, values: false })
    expect(strapi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("row cap")
    )
  })

  it("does not warn below the cap", async () => {
    const { history, strapi } = setup([
      row({
        batchId: "b1",
        field: "name",
        changedAt: "2026-01-05T10:00:00.000Z",
      }),
    ])
    await history.libraryHistory(LIB, { page: 1, pageSize: 20, values: false })
    expect(strapi.log.warn).not.toHaveBeenCalled()
  })
})

describe("reviewer-prefix-v1", () => {
  it("prefixes bare reviewer ids with admin: and is idempotent", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        { id: 1, documentId: "s1", reviewedByUserId: "7" },
        { id: 2, documentId: "s2", reviewedByUserId: "admin:3" },
        { id: 3, documentId: "s3", reviewedByUserId: "ba:u9" },
        { id: 4, documentId: "s4", reviewedByUserId: "" },
        { id: 5, documentId: "s5" },
      ],
    })
    const kv = withStore(f.strapi)
    await migrateReviewerPrefix(f.strapi)
    const ids = () => f.store[SUB].map((s: any) => s.reviewedByUserId)
    expect(ids()).toEqual(["admin:7", "admin:3", "ba:u9", "", undefined])
    // Run again, with and without the flag: nothing changes.
    await migrateReviewerPrefix(f.strapi)
    kv.clear()
    await migrateReviewerPrefix(f.strapi)
    expect(ids()).toEqual(["admin:7", "admin:3", "ba:u9", "", undefined])
  })
})
