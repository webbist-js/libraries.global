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

  // Poll for manual sync commands every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    let command: Record<string, unknown> | undefined
    try {
      command = (await db("ev_sync_commands")
        .whereNull("consumed_at")
        .orderBy("requested_at", "asc")
        .first()) as Record<string, unknown> | undefined
    } catch (err: any) {
      console.error("[cron:poll] DB query error:", err.message)

      return
    }

    if (!command) return

    try {
      // Mark as consumed immediately
      await db("ev_sync_commands")
        .where("id", command.id as number)
        .update({ consumed_at: new Date().toISOString() })
    } catch (err: any) {
      console.error(
        "[cron:poll] Failed to mark command as consumed:",
        err.message
      )

      return
    }

    console.log(`[cron:poll] Manual sync command found — triggering`)
    setSyncStatus("running")
    try {
      await runSync(
        "manual",
        (command.requested_by_user_id as number | undefined) ?? undefined
      )
    } catch (err: any) {
      console.error("[cron:poll] runSync error:", err.message)
    } finally {
      setSyncStatus("idle")
      setLastSync({
        runId: "manual",
        status: "done",
        at: new Date().toISOString(),
      })
    }
  })

  console.log(`[cron] Jobs registered. Sync cron: ${syncCron}`)
}
