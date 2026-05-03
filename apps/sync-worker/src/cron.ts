// apps/sync-worker/src/cron.ts
import cron from "node-cron"

import db from "./db"
import { purgeExpiredEvents } from "./pipeline/purge"
import { runSync } from "./pipeline/sync"
import { setSyncStatus, setLastSync } from "./server"

export function registerCronJobs(): void {
  const syncCron = process.env.EVENTS_SYNC_CRON ?? "0 */6 * * *"

  // Main sync
  cron.schedule(syncCron, async () => {
    setSyncStatus("running")
    try {
      await runSync("cron")
    } finally {
      setSyncStatus("idle")
      setLastSync({
        runId: "cron",
        status: "done",
        at: new Date().toISOString(),
      })
    }
  })

  // Purge expired events nightly at 03:00 UTC
  cron.schedule("0 3 * * *", async () => {
    const count = await purgeExpiredEvents()
    console.log(`[cron:purge] Purged ${count} expired events`)
  })

  // Prune import run logs older than 90 days — Sunday 04:00 UTC
  cron.schedule("0 4 * * 0", async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const deleted = await db("ev_import_runs")
      .where("started_at", "<", cutoff)
      .delete()
    console.log(`[cron:prune-logs] Pruned ${deleted} old import run records`)
  })

  // Poll for manual sync commands every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    const command = await db("ev_sync_commands")
      .whereNull("consumed_at")
      .orderBy("requested_at", "asc")
      .first()

    if (!command) return

    // Mark as consumed immediately
    await db("ev_sync_commands")
      .where("id", (command as any).id)
      .update({ consumed_at: new Date().toISOString() })

    console.log(`[cron:poll] Manual sync command found — triggering`)
    setSyncStatus("running")
    try {
      await runSync(
        "manual",
        (command as any).requested_by_user_id ?? undefined
      )
    } finally {
      setSyncStatus("idle")
    }
  })

  console.log(`[cron] Jobs registered. Sync cron: ${syncCron}`)
}
