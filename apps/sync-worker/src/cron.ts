// apps/sync-worker/src/cron.ts
import cron from "node-cron"

import db from "./db"
import { purgeExpiredEvents } from "./pipeline/purge"
import { runSync } from "./pipeline/sync"

export function registerCronJobs(): void {
  const syncCron = process.env.EVENTS_SYNC_CRON ?? "0 */6 * * *"

  // The central lease covers cron and manual runs across worker instances.
  cron.schedule(syncCron, async () => {
    try {
      await runSync("cron")
    } catch {
      console.error("[cron] Event sync failed")
    }
  })

  // Purge expired events nightly at 03:00 UTC
  cron.schedule("0 3 * * *", async () => {
    try {
      const count = await purgeExpiredEvents()
      console.log(`[cron:purge] Purged ${count} expired events`)
    } catch (err: any) {
      console.error("[cron:purge] Error:", err.message)
    }
  })

  // Prune import run logs older than 90 days — Sunday 04:00 UTC
  cron.schedule("0 4 * * 0", async () => {
    try {
      const cutoff = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000
      ).toISOString()
      const deleted = await db("ev_import_runs")
        .where("started_at", "<", cutoff)
        .delete()
      console.log(`[cron:prune-logs] Pruned ${deleted} old import run records`)
    } catch (err: any) {
      console.error("[cron:prune-logs] Error:", err.message)
    }
  })

  // Atomic claim: another worker cannot consume the same command. A busy
  // global lease returns it to the queue rather than silently losing it.
  cron.schedule("*/2 * * * *", async () => {
    try {
      const result = await db.raw(`UPDATE ev_sync_commands SET consumed_at=now()
        WHERE id=(SELECT id FROM ev_sync_commands WHERE consumed_at IS NULL
          ORDER BY requested_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id,requested_by_user_id,credential_document_id`)
      const command = result.rows[0]
      if (!command) return
      const ran = await runSync("manual", command.requested_by_user_id, {
        credentialDocumentId: command.credential_document_id ?? undefined,
      })
      if (!ran)
        await db("ev_sync_commands")
          .where("id", command.id)
          .update({ consumed_at: null })
    } catch {
      console.error("[cron:poll] Event command processing failed")
    }
  })

  console.log(`[cron] Jobs registered. Sync cron: ${syncCron}`)
}
