import "server-only"

import type { Pool } from "pg"

type Context = { runMigrations: () => Promise<void> }
const migrations = new WeakMap<Pool, Promise<void>>()

/** Serialize schema inspection and DDL across processes sharing this database. */
async function migrate(pool: Pool, context: () => Promise<Context>) {
  const client = await pool.connect()
  let damaged = false
  try {
    await client.query("begin")
    await client.query("set local lock_timeout = '30s'")
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["libraries-global:better-auth-schema"]
    )
    // Better Auth inspects the schema inside runMigrations. The lock must cover
    // that inspection too, otherwise concurrent processes plan the same DDL.
    await (await context()).runMigrations()
    await client.query("commit")
  } catch (error) {
    try {
      await client.query("rollback")
    } catch {
      damaged = true
    }
    throw error
  } finally {
    // Transaction end releases the lock. Discard a connection if rollback failed.
    client.release(damaged)
  }
}

export function migrateAuthSchema(pool: Pool, context: () => Promise<Context>) {
  const pending = migrations.get(pool)
  if (pending) return pending
  const migration = migrate(pool, context).catch((error) => {
    migrations.delete(pool)
    throw error
  })
  migrations.set(pool, migration)

  return migration
}
