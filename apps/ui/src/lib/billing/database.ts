import "server-only"

import type { Pool, PoolClient } from "pg"

/** Connection-scoped locks span provider calls without an uncommitted external write. */
export async function withBillingLock<T>(
  pool: Pool,
  key: string,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  let locked = false
  try {
    const result = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked",
      [`billing:${key}`]
    )
    locked = result.rows[0]?.locked === true
    if (!locked) throw new Error("billing_busy")

    return await work(client)
  } finally {
    // Destroy the connection if unlock fails: never return a held lock to the pool.
    let damaged = false
    if (locked) {
      try {
        await client.query(
          "select pg_advisory_unlock(hashtextextended($1, 0))",
          [`billing:${key}`]
        )
      } catch {
        damaged = true
      }
    }
    client.release(damaged)
  }
}
