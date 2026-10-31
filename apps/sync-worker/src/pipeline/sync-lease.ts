import db from "../db"

const LOCK = 7_420_111

/** A dedicated pooled connection owns the lock for the whole run, without a
 * long idle transaction. Process/connection death releases the lease too.
 */
export async function withSyncLease(
  work: () => Promise<void>
): Promise<boolean> {
  const connection = await db.client.acquireConnection()
  let locked = false
  let destroyed = false
  try {
    const result = await connection.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK]
    )
    locked = result.rows[0]?.locked === true
    if (!locked) return false
    await work()

    return true
  } finally {
    if (locked) {
      try {
        await connection.query("SELECT pg_advisory_unlock($1)", [LOCK])
      } catch {
        destroyed = true
        await db.client.destroyConnection(connection)
      }
    }
    if (!destroyed) await db.client.releaseConnection(connection)
  }
}
