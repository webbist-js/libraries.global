// apps/sync-worker/src/pipeline/purge.ts
import db from "../db"

/** Delete events whose end_time is more than 1 hour in the past. */
export async function purgeExpiredEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const result = await db("ev_events").where("end_time", "<", cutoff).delete()

  return result
}
