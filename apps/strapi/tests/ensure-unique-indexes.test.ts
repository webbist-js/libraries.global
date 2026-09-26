import path from "node:path"

import { describe, expect, it, vi } from "vitest"

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
