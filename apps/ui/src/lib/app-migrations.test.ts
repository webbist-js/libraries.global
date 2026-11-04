import type { Pool } from "pg"
import { expect, it, vi } from "vitest"

import { migrateApplicationState } from "./app-migrations"

it("locks before preparing application state and never creates credential tables", async () => {
  const client = {
    query: vi.fn(async (_sql: string, _params?: unknown[]) => ({})),
    release: vi.fn(),
  }
  await migrateApplicationState({
    connect: async () => client,
  } as unknown as Pool)
  const statements = client.query.mock.calls.map(([sql]) => String(sql))
  expect(statements[1]).toContain("lock_timeout")
  expect(statements[2]).toContain("pg_advisory_xact_lock")
  expect(statements[3]).toContain("CREATE TABLE IF NOT EXISTS app_auth_state")
  expect(statements.at(-1)).toBe("COMMIT")
  expect(client.release).toHaveBeenCalledWith(false)
})

it("preserves the original failure and discards a connection when rollback fails", async () => {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("CREATE TABLE")) throw new Error("schema failed")
      if (sql === "ROLLBACK") throw new Error("connection lost")
    }),
    release: vi.fn(),
  }
  await expect(
    migrateApplicationState({ connect: async () => client } as unknown as Pool)
  ).rejects.toThrow("schema failed")
  expect(client.release).toHaveBeenCalledWith(true)
})
