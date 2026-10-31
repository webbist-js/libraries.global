import type { Pool } from "pg"
import { describe, expect, it, vi } from "vitest"

import { migrateAuthSchema } from "./auth-migrations"

function fixture() {
  const client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() }
  const connect = vi.fn().mockResolvedValue(client)
  const pool = { connect } as unknown as Pool

  return { client, connect, pool }
}

describe("authentication schema startup", () => {
  it("shares an in-flight migration and waits for the database lock before inspecting schema", async () => {
    const { client, connect, pool } = fixture()
    let releaseLock!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_advisory_xact_lock")) await gate
    })
    const runMigrations = vi.fn().mockResolvedValue(undefined)
    const context = vi.fn().mockResolvedValue({ runMigrations })
    const first = migrateAuthSchema(pool, context)
    const second = migrateAuthSchema(pool, context)
    expect(first).toBe(second)
    await vi.waitFor(() => expect(client.query).toHaveBeenCalledTimes(3))
    expect(context).not.toHaveBeenCalled()
    releaseLock()
    await first
    expect(connect).toHaveBeenCalledOnce()
    expect(runMigrations).toHaveBeenCalledOnce()
    expect(client.query).toHaveBeenLastCalledWith("commit")
    expect(client.release).toHaveBeenCalledWith(false)
    await migrateAuthSchema(pool, context)
    expect(connect).toHaveBeenCalledOnce()
  })

  it("propagates migration failure, releases the transaction and permits a retry", async () => {
    const { client, pool } = fixture()
    const runMigrations = vi
      .fn()
      .mockRejectedValueOnce(new Error("schema failed"))
      .mockResolvedValueOnce(undefined)
    const context = vi.fn().mockResolvedValue({ runMigrations })
    await expect(migrateAuthSchema(pool, context)).rejects.toThrow(
      "schema failed"
    )
    expect(client.query).toHaveBeenLastCalledWith("rollback")
    expect(client.release).toHaveBeenCalledWith(false)
    await migrateAuthSchema(pool, context)
    expect(runMigrations).toHaveBeenCalledTimes(2)
  })

  it("discards a connection when rollback fails so a held lock cannot enter the pool", async () => {
    const { client, pool } = fixture()
    client.query.mockImplementation(async (sql: string) => {
      if (sql === "rollback") throw new Error("connection lost")
    })
    const context = vi.fn().mockRejectedValue(new Error("schema failed"))
    await expect(migrateAuthSchema(pool, context)).rejects.toThrow(
      "schema failed"
    )
    expect(client.release).toHaveBeenCalledWith(true)
  })
})
