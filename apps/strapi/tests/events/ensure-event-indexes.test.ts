import { describe, expect, it, vi } from "vitest"

import {
  EV_CREDENTIAL_EVENTS_INDEX_NAME,
  EV_CREDENTIALS_STATUS_INDEX_NAME,
  EV_EVENTS_CREDENTIAL_START_INDEX_NAME,
  EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME,
  EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME,
  ensureEventIndexes,
} from "../../src/plugins/events/server/utils/ensure-event-indexes"

function fakeStrapi({
  client,
  hasTable = true,
  hasColumn = true,
  existingIndexes = new Set<string>(),
  legacyIdentity = false,
}: {
  client: string | undefined
  hasTable?: boolean
  hasColumn?: boolean
  legacyIdentity?: boolean
  existingIndexes?: Set<string>
}) {
  const hasTableFn = vi.fn(async () => hasTable)
  const hasColumnFn = vi.fn(async () => hasColumn)
  const rawFn = vi.fn(async (sql: string, bindings?: unknown[]) => {
    if (sql.startsWith("select indexdef from pg_indexes")) {
      return {
        rows: existingIndexes.has(bindings?.[0] as string)
          ? [
              {
                indexdef: legacyIdentity
                  ? "CREATE UNIQUE INDEX ON ev_events (source_provider, external_id)"
                  : "CREATE UNIQUE INDEX ON ev_events (credential_id, source_provider, external_id)",
              },
            ]
          : [],
      }
    }
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
    db: {
      dialect: { client },
      connection: {
        schema: { hasTable: hasTableFn, hasColumn: hasColumnFn },
        transaction: transactionFn,
      },
    },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  }

  return { strapi, hasTableFn, hasColumnFn, rawFn, transactionFn }
}

const sqlCalls = (rawFn: ReturnType<typeof vi.fn>) =>
  rawFn.mock.calls.map((c) => c[0] as string)

describe("ensureEventIndexes", () => {
  it("creates installation-scoped identity, the entity-ref index and backfills the ref on Postgres", async () => {
    const { strapi, rawFn, transactionFn } = fakeStrapi({ client: "postgres" })

    await ensureEventIndexes(strapi)

    expect(transactionFn).toHaveBeenCalledTimes(1)
    const sql = sqlCalls(rawFn)
    expect(sql.some((s) => s.includes("SET LOCAL lock_timeout"))).toBe(true)
    // Serialize the identity change; never delete events or their references.
    const dedupeIdx = sql.findIndex((s) => s.includes("LOCK TABLE ev_events"))
    const uniqueIdx = sql.findIndex((s) =>
      s.includes(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME} ON ev_events (credential_id, source_provider, external_id)`
      )
    )
    expect(dedupeIdx).toBeGreaterThanOrEqual(0)
    expect(uniqueIdx).toBeGreaterThan(dedupeIdx)
    expect(sql.some((s) => s.includes("DELETE FROM ev_events"))).toBe(false)
    expect(
      sql.some((s) =>
        s.includes(
          `CREATE INDEX IF NOT EXISTS ${EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME} ON ev_events (library_entity_ref)`
        )
      )
    ).toBe(true)
    expect(
      sql.some(
        (s) =>
          s.includes("UPDATE ev_events") &&
          s.includes("library_entity_ref") &&
          s.includes("ev_events_library_lnk")
      )
    ).toBe(true)
    expect(
      sql.some((s) =>
        s.includes(
          `CREATE INDEX IF NOT EXISTS ${EV_CREDENTIALS_STATUS_INDEX_NAME} ON ev_event_credentials (status)`
        )
      )
    ).toBe(true)
    expect(
      sql.some((s) =>
        s.includes(
          `CREATE INDEX IF NOT EXISTS ${EV_CREDENTIAL_EVENTS_INDEX_NAME} ON ev_credential_events (credential_document_id, created_at)`
        )
      )
    ).toBe(true)
    expect(
      sql.some((s) =>
        s.includes(
          `CREATE INDEX IF NOT EXISTS ${EV_EVENTS_CREDENTIAL_START_INDEX_NAME} ON ev_events (credential_id, start_time)`
        )
      )
    ).toBe(true)
  })

  it("skips an index that already exists and never re-runs the dedupe", async () => {
    const { strapi, rawFn } = fakeStrapi({
      client: "postgres",
      existingIndexes: new Set([
        EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME,
        EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME,
        EV_CREDENTIALS_STATUS_INDEX_NAME,
        EV_CREDENTIAL_EVENTS_INDEX_NAME,
        EV_EVENTS_CREDENTIAL_START_INDEX_NAME,
      ]),
    })

    await ensureEventIndexes(strapi)

    const sql = sqlCalls(rawFn)
    expect(sql.some((s) => s.includes("CREATE UNIQUE INDEX"))).toBe(false)
    expect(sql.some((s) => s.includes("CREATE INDEX"))).toBe(false)
    expect(sql.some((s) => s.includes("DELETE FROM ev_events"))).toBe(false)
  })

  it("is a no-op off Postgres", async () => {
    const { strapi, hasTableFn, transactionFn } = fakeStrapi({
      client: "sqlite",
    })
    await ensureEventIndexes(strapi)
    expect(hasTableFn).not.toHaveBeenCalled()
    expect(transactionFn).not.toHaveBeenCalled()
  })

  it("warns and skips when the table or the new column is missing", async () => {
    const noTable = fakeStrapi({ client: "postgres", hasTable: false })
    await ensureEventIndexes(noTable.strapi)
    expect(noTable.transactionFn).not.toHaveBeenCalled()

    const noColumn = fakeStrapi({ client: "postgres", hasColumn: false })
    await ensureEventIndexes(noColumn.strapi)
    expect(noColumn.transactionFn).not.toHaveBeenCalled()
    expect(noColumn.strapi.log.warn).toHaveBeenCalled()
  })

  it("refuses startup when the required identity migration fails", async () => {
    const { strapi, transactionFn } = fakeStrapi({ client: "postgres" })
    transactionFn.mockRejectedValueOnce(new Error("lock timeout"))
    await expect(ensureEventIndexes(strapi)).rejects.toThrow("lock timeout")
    expect(strapi.log.error).toHaveBeenCalled()
  })
})

it("repairs the legacy identity without deleting or re-keying any events", async () => {
  const { strapi, rawFn } = fakeStrapi({
    client: "pg",
    existingIndexes: new Set([EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME]),
    legacyIdentity: true,
  })
  await ensureEventIndexes(strapi)
  const sql = rawFn.mock.calls.map((call) => call[0]).join("\n")
  expect(sql).toContain("LOCK TABLE ev_events")
  expect(sql).toContain("DROP INDEX IF EXISTS ev_events_provider_external_uq")
  expect(sql).toContain("(credential_id, source_provider, external_id)")
  expect(sql).not.toMatch(
    /DELETE FROM ev_events|UPDATE ev_events SET (?:id|document_id|credential_id)/i
  )
})
