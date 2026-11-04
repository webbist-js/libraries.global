import "server-only"
import type { Pool } from "pg"

/** Application-owned mobile challenges and limits; no auth tables are managed here. */
export async function migrateApplicationState(pool: Pool) {
  const client = await pool.connect()
  let damaged = false
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout = '30s'")
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["application-auth-state-v1"]
    )
    await client.query(`CREATE TABLE IF NOT EXISTS app_auth_state (
      id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`)
    await client.query(
      'CREATE INDEX IF NOT EXISTS app_auth_state_expiry ON app_auth_state ("expiresAt")'
    )
    await client.query("COMMIT")
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      damaged = true
    }
    throw error
  } finally {
    client.release(damaged)
  }
}
