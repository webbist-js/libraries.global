import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import { ensureHotPathIndexes } from "../src/utils/ensure-hot-path-indexes"
import { ensureUniqueIndexes } from "../src/utils/ensure-unique-indexes"

const RW_INDEX = "rw_point_events_idempotency_key_uq"
const UPLOADS_INDEX = "cm_submission_uploads_file_id_uq"

function fakeStrapi({
  client,
  hasTable = true,
  existingIndexes = new Set<string>(),
}: {
  client: string | undefined
  hasTable?: boolean
  existingIndexes?: Set<string>
}) {
  const hasTableFn = vi.fn(async () => hasTable)
  const rawFn = vi.fn(async (sql: string, bindings?: unknown[]) => {
    if (sql.startsWith("select 1 from pg_indexes")) {
      const name = bindings?.[0] as string

      return { rows: existingIndexes.has(name) ? [{ "?column?": 1 }] : [] }
    }

    return {}
  })
  const transactionFn = vi.fn(
    async (cb: (trx: { raw: typeof rawFn }) => Promise<void>) => {
      await cb({ raw: rawFn })
    }
  )
  const strapi: any = {
    dirs: { app: { root: path.join(__dirname, "..") } },
    db: {
      dialect: { client },
      connection: {
        schema: { hasTable: hasTableFn },
        transaction: transactionFn,
      },
    },
    log: { error: vi.fn(), warn: vi.fn() },
  }

  return { strapi, hasTableFn, rawFn, transactionFn }
}

describe("ensureUniqueIndexes", () => {
  it("creates both indexes (and dedupes uploads) on Postgres when the tables exist and neither index does yet", async () => {
    const { strapi, hasTableFn, rawFn, transactionFn } = fakeStrapi({
      client: "postgres",
    })

    await ensureUniqueIndexes(strapi)

    expect(hasTableFn).toHaveBeenCalledWith("rw_point_events")
    expect(hasTableFn).toHaveBeenCalledWith("cm_submission_uploads")
    expect(transactionFn).toHaveBeenCalledTimes(1)

    // SET LOCAL lock_timeout, 2 pg_indexes checks, idempotency-key create,
    // dedupe delete, file_id create.
    const sqls = rawFn.mock.calls.map((c) => c[0] as string)
    expect(sqls[0]).toMatch(/SET LOCAL lock_timeout = '5s'/)
    expect(sqls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/select 1 from pg_indexes/),
        expect.stringMatching(
          /CREATE UNIQUE INDEX IF NOT EXISTS rw_point_events_idempotency_key_uq/
        ),
        expect.stringMatching(/DELETE FROM cm_submission_uploads/),
        expect.stringMatching(
          /CREATE UNIQUE INDEX IF NOT EXISTS cm_submission_uploads_file_id_uq/
        ),
      ])
    )
  })

  it("skips the CREATE and the dedupe for an index that already exists", async () => {
    const { rawFn, strapi } = fakeStrapi({
      client: "postgres",
      existingIndexes: new Set([RW_INDEX, UPLOADS_INDEX]),
    })

    await ensureUniqueIndexes(strapi)

    const sqls = rawFn.mock.calls.map((c) => c[0] as string)
    expect(sqls.some((s) => s.startsWith("CREATE UNIQUE INDEX"))).toBe(false)
    expect(sqls.some((s) => s.startsWith("DELETE FROM"))).toBe(false)
    // Existence is still checked for both.
    expect(
      sqls.filter((s) => s.startsWith("select 1 from pg_indexes"))
    ).toHaveLength(2)
  })

  it("creates only the missing index when the other already exists", async () => {
    const { rawFn, strapi } = fakeStrapi({
      client: "postgres",
      existingIndexes: new Set([RW_INDEX]),
    })

    await ensureUniqueIndexes(strapi)

    const sqls = rawFn.mock.calls.map((c) => c[0] as string)
    // The rw_point_events index already exists: no CREATE for it.
    expect(
      sqls.some(
        (s) =>
          s.startsWith("CREATE UNIQUE INDEX") && s.includes("rw_point_events")
      )
    ).toBe(false)
    // The uploads index doesn't exist yet: dedupe and CREATE both run.
    expect(sqls.some((s) => s.startsWith("DELETE FROM"))).toBe(true)
    expect(
      sqls.some(
        (s) =>
          s.startsWith("CREATE UNIQUE INDEX") &&
          s.includes("cm_submission_uploads")
      )
    ).toBe(true)
  })

  it("skips everything when the tables don't exist yet (fresh database)", async () => {
    const { strapi, hasTableFn, transactionFn } = fakeStrapi({
      client: "postgres",
      hasTable: false,
    })

    await ensureUniqueIndexes(strapi)

    expect(hasTableFn).toHaveBeenCalledTimes(2)
    expect(transactionFn).not.toHaveBeenCalled()
  })

  it("skips on a non-Postgres dialect (sqlite)", async () => {
    const { strapi, hasTableFn, transactionFn } = fakeStrapi({
      client: "sqlite",
    })

    await ensureUniqueIndexes(strapi)

    expect(hasTableFn).not.toHaveBeenCalled()
    expect(transactionFn).not.toHaveBeenCalled()
  })

  it("never throws when the dialect is missing entirely (and skips silently, no table to check)", async () => {
    const { strapi, transactionFn } = fakeStrapi({ client: undefined })

    await expect(ensureUniqueIndexes(strapi)).resolves.toBeUndefined()
    expect(transactionFn).not.toHaveBeenCalled()
  })

  it("logs and never throws when a raw statement fails", async () => {
    const { strapi, rawFn } = fakeStrapi({ client: "postgres" })
    rawFn.mockRejectedValueOnce(new Error("boom"))

    await expect(ensureUniqueIndexes(strapi)).resolves.toBeUndefined()
    expect(strapi.log.error).toHaveBeenCalledWith(
      "[bootstrap] ensureUniqueIndexes failed",
      expect.any(Error)
    )
  })
})

// ── E1: hot-path indexes (fresh-DB fallback) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hotPath = require("../database/migrations/shared/hot-path-index-sql") as {
  HOT_PATH_INDEXES: {
    name: string
    table: string
    unique?: boolean
    before?: string[]
    sql: string
  }[]
  CONTRIBUTOR_NUMBER_SEQUENCE: { name: string; table: string; sql: string[] }
}

function fakeHotPathStrapi({
  client,
  missingTables = new Set<string>(),
  existingIndexes = new Set<string>(),
  existingSequences = new Set<string>(),
}: {
  client: string | undefined
  missingTables?: Set<string>
  existingIndexes?: Set<string>
  existingSequences?: Set<string>
}) {
  const hasTableFn = vi.fn(async (t: string) => !missingTables.has(t))
  const rawFn = vi.fn(async (sql: string, bindings?: unknown[]) => {
    if (sql.startsWith("select 1 from pg_indexes")) {
      const name = bindings?.[0] as string

      return { rows: existingIndexes.has(name) ? [{ "?column?": 1 }] : [] }
    }
    if (sql.startsWith("select 1 from pg_class")) {
      const name = bindings?.[0] as string

      return { rows: existingSequences.has(name) ? [{ "?column?": 1 }] : [] }
    }

    return {}
  })
  const transactionFn = vi.fn(
    async (cb: (trx: { raw: typeof rawFn }) => Promise<void>) => {
      await cb({ raw: rawFn })
    }
  )
  const strapi: any = {
    dirs: { app: { root: path.join(__dirname, "..") } },
    db: {
      dialect: { client },
      connection: {
        schema: { hasTable: hasTableFn },
        transaction: transactionFn,
      },
    },
    log: { error: vi.fn(), warn: vi.fn() },
  }

  return { strapi, hasTableFn, rawFn, transactionFn }
}

describe("hot-path index list", () => {
  const { HOT_PATH_INDEXES, CONTRIBUTOR_NUMBER_SEQUENCE } = hotPath

  it("names every index uniquely and every statement is IF NOT EXISTS", () => {
    const names = HOT_PATH_INDEXES.map((i) => i.name)
    expect(new Set(names).size).toBe(names.length)
    for (const entry of HOT_PATH_INDEXES) {
      expect(entry.name.length).toBeLessThanOrEqual(63)
      expect(entry.sql).toMatch(
        entry.unique
          ? /^CREATE UNIQUE INDEX IF NOT EXISTS /
          : /^CREATE INDEX IF NOT EXISTS /
      )
      expect(entry.sql).toContain(` ${entry.name} ON ${entry.table} (`)
    }
    expect(CONTRIBUTOR_NUMBER_SEQUENCE.sql[0]).toMatch(
      /^CREATE SEQUENCE IF NOT EXISTS user_profiles_contributor_number_seq/
    )
    expect(CONTRIBUTOR_NUMBER_SEQUENCE.sql[1]).toMatch(
      /setval\('user_profiles_contributor_number_seq'/
    )
  })

  it("covers the reviewed hot paths", () => {
    const bySql = HOT_PATH_INDEXES.map((i) => i.sql)
    for (const expected of [
      "ON libraries (slug, locale, published_at)",
      "ON regions (slug, locale, published_at)",
      "ON countries (slug, locale, published_at)",
      "ON continents (slug, locale, published_at)",
      "ON areas (slug, locale, published_at)",
      "ON wiki_articles (slug, locale, published_at)",
      "ON blog_articles (slug, locale, published_at)",
      "ON libraries (entity_ref)",
      "ON libraries (library_type)",
      "ON user_profiles (ba_user_id)",
      "ON user_profiles (points DESC)",
      "ON user_profiles (country, points DESC)",
      "ON cm_submissions (submitted_by_user_id, status, created_at)",
      "ON cm_submissions (target_document_id, status)",
      "ON cm_submissions (submission_type, status)",
      "ON cm_option_votes (suggestion_document_id, ba_user_id)",
      "ON cm_option_votes (suggestion_document_id)",
      "ON rw_point_events (ba_user_id, awarded_at)",
      "ON rw_point_events (awarded_at)",
      "ON rw_badge_awards (ba_user_id, badge_id)",
      "ON rw_leaderboard_snapshots (period, period_type)",
      "ON role_grants (ba_user_id)",
    ]) {
      expect(bySql.some((s) => s.includes(expected))).toBe(true)
    }
  })

  it("dedupes before every unique index", () => {
    for (const entry of HOT_PATH_INDEXES.filter((i) => i.unique)) {
      expect(entry.before?.length).toBeGreaterThan(0)
      for (const s of entry.before!) expect(s).toMatch(/^DELETE FROM /)
    }
  })
})

describe("ensureHotPathIndexes", () => {
  const { HOT_PATH_INDEXES, CONTRIBUTOR_NUMBER_SEQUENCE } = hotPath

  it("applies every index (dedupe first for unique ones) and creates the sequence on Postgres", async () => {
    const { strapi, rawFn, transactionFn } = fakeHotPathStrapi({
      client: "postgres",
    })

    await ensureHotPathIndexes(strapi)

    expect(transactionFn).toHaveBeenCalledTimes(1)
    const sqls = rawFn.mock.calls.map((c) => c[0] as string)
    expect(sqls[0]).toMatch(/SET LOCAL lock_timeout/)
    for (const entry of HOT_PATH_INDEXES) {
      expect(sqls).toContain(entry.sql)
      for (const before of entry.before ?? []) {
        expect(sqls.indexOf(before)).toBeLessThan(sqls.indexOf(entry.sql))
      }
    }
    for (const s of CONTRIBUTOR_NUMBER_SEQUENCE.sql) expect(sqls).toContain(s)
  })

  it("skips the CREATE and the dedupe for indexes that already exist, and never re-seeds an existing sequence", async () => {
    const existing = new Set(HOT_PATH_INDEXES.map((i) => i.name))
    const { strapi, rawFn } = fakeHotPathStrapi({
      client: "postgres",
      existingIndexes: existing,
      existingSequences: new Set([CONTRIBUTOR_NUMBER_SEQUENCE.name]),
    })

    await ensureHotPathIndexes(strapi)

    const sqls = rawFn.mock.calls.map((c) => c[0] as string)
    expect(sqls.some((s) => s.startsWith("CREATE"))).toBe(false)
    expect(sqls.some((s) => s.startsWith("DELETE"))).toBe(false)
    expect(sqls.some((s) => /setval/.test(s))).toBe(false)
  })

  it("creates only the missing indexes and skips tables that don't exist yet", async () => {
    const [first, ...rest] = HOT_PATH_INDEXES
    const { strapi, rawFn } = fakeHotPathStrapi({
      client: "postgres",
      existingIndexes: new Set(rest.map((i) => i.name)),
      missingTables: new Set(["rw_leaderboard_snapshots"]),
    })

    await ensureHotPathIndexes(strapi)

    const sqls = rawFn.mock.calls.map((c) => c[0] as string)
    const creates = sqls.filter(
      (s) => s.startsWith("CREATE") && / INDEX /.test(s)
    )
    expect(creates).toEqual([first.sql])
    expect(sqls.some((s) => s.includes("ON rw_leaderboard_snapshots"))).toBe(
      false
    )
    expect(strapi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("rw_leaderboard_snapshots")
    )
  })

  it("skips everything when no table exists yet (fresh database) and on sqlite", async () => {
    const fresh = fakeHotPathStrapi({
      client: "postgres",
      missingTables: new Set([
        ...HOT_PATH_INDEXES.map((i) => i.table),
        CONTRIBUTOR_NUMBER_SEQUENCE.table,
      ]),
    })
    await ensureHotPathIndexes(fresh.strapi)
    expect(fresh.transactionFn).not.toHaveBeenCalled()

    const sqlite = fakeHotPathStrapi({ client: "sqlite" })
    await ensureHotPathIndexes(sqlite.strapi)
    expect(sqlite.hasTableFn).not.toHaveBeenCalled()
  })

  it("logs and never throws when a statement fails", async () => {
    const { strapi, rawFn } = fakeHotPathStrapi({ client: "postgres" })
    rawFn.mockRejectedValueOnce(new Error("boom"))

    await expect(ensureHotPathIndexes(strapi)).resolves.toBeUndefined()
    expect(strapi.log.error).toHaveBeenCalledWith(
      "[bootstrap] ensureHotPathIndexes failed",
      expect.any(Error)
    )
  })
})

describe("role-grants index migration", () => {
  const MIGRATION =
    "../database/migrations/2026.09.30T00.00.03.role-grants-index"
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const migration = require(MIGRATION) as {
    up: (knex: any) => Promise<void>
    down: (knex: any) => Promise<void>
  }
  const knexFor = (client: string, hasTable = true) => {
    const raw = vi.fn(async () => ({}))

    return {
      raw,
      knex: {
        client: { config: { client } },
        schema: { hasTable: vi.fn(async () => hasTable) },
        raw,
      },
    }
  }

  it("creates only the role_grants.ba_user_id index on Postgres", async () => {
    const { knex, raw } = knexFor("postgres")
    await migration.up(knex)

    expect(raw.mock.calls).toEqual([
      [
        "CREATE INDEX IF NOT EXISTS role_grants_ba_user_id_idx ON role_grants (ba_user_id)",
      ],
    ])
  })

  it("skips a missing table and non-Postgres clients", async () => {
    const missing = knexFor("postgres", false)
    await migration.up(missing.knex)
    expect(missing.raw).not.toHaveBeenCalled()

    const sqlite = knexFor("sqlite")
    await migration.up(sqlite.knex)
    expect(sqlite.raw).not.toHaveBeenCalled()
  })
})
