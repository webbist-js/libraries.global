import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import { ensureUniqueIndexes } from "../src/utils/ensure-unique-indexes"

function fakeStrapi({
  client,
  hasTable = true,
}: {
  client: string | undefined
  hasTable?: boolean
}) {
  const hasTableFn = vi.fn(async () => hasTable)
  const rawFn = vi.fn(async () => {})
  const strapi: any = {
    dirs: { app: { root: path.join(__dirname, "..") } },
    db: {
      dialect: { client },
      connection: {
        schema: { hasTable: hasTableFn },
        raw: rawFn,
      },
    },
    log: { error: vi.fn(), warn: vi.fn() },
  }

  return { strapi, hasTableFn, rawFn }
}

describe("ensureUniqueIndexes", () => {
  it("creates both indexes (and dedupes uploads) on Postgres when the tables exist", async () => {
    const { strapi, hasTableFn, rawFn } = fakeStrapi({ client: "postgres" })

    await ensureUniqueIndexes(strapi)

    expect(hasTableFn).toHaveBeenCalledWith("rw_point_events")
    expect(hasTableFn).toHaveBeenCalledWith("cm_submission_uploads")

    // idempotency-key unique index, dedupe delete, file_id unique index
    expect(rawFn).toHaveBeenCalledTimes(3)
    expect(rawFn.mock.calls[0][0]).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS rw_point_events_idempotency_key_uq/
    )
    expect(rawFn.mock.calls[1][0]).toMatch(/DELETE FROM cm_submission_uploads/)
    expect(rawFn.mock.calls[2][0]).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS cm_submission_uploads_file_id_uq/
    )
  })

  it("skips everything when the tables don't exist yet (fresh database)", async () => {
    const { strapi, hasTableFn, rawFn } = fakeStrapi({
      client: "postgres",
      hasTable: false,
    })

    await ensureUniqueIndexes(strapi)

    expect(hasTableFn).toHaveBeenCalledTimes(2)
    expect(rawFn).not.toHaveBeenCalled()
  })

  it("skips on a non-Postgres dialect (sqlite)", async () => {
    const { strapi, hasTableFn, rawFn } = fakeStrapi({ client: "sqlite" })

    await ensureUniqueIndexes(strapi)

    expect(hasTableFn).not.toHaveBeenCalled()
    expect(rawFn).not.toHaveBeenCalled()
  })

  it("never throws, and logs, when the dialect is missing entirely", async () => {
    const { strapi, rawFn } = fakeStrapi({ client: undefined })

    await expect(ensureUniqueIndexes(strapi)).resolves.toBeUndefined()
    expect(rawFn).not.toHaveBeenCalled()
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
