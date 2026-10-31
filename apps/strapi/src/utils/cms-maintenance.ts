import type { Core } from "@strapi/strapi"

import { purgeErasedMedia } from "./erased-media"
import { withLeaderLock } from "./leader-lock"

const LOCK = 7_420_112
const DAY = 86_400_000

export type MaintenanceJob = {
  id: string
  interval: number
  external?: boolean
  run: () => Promise<unknown>
}
type Receipt = { lastAttempt?: string; lastSuccess?: string; failed?: boolean }
const healthStore = (strapi: Core.Strapi, id: string) =>
  strapi.store({
    type: "core",
    name: "cms-maintenance",
    key: `health-v1-${id}`,
  })

export async function recordMaintenanceSuccess(
  strapi: Core.Strapi,
  id: string,
  now = new Date()
) {
  await healthStore(strapi, id).set({
    value: {
      lastAttempt: now.toISOString(),
      lastSuccess: now.toISOString(),
      failed: false,
    },
  })
}
export async function observeMaintenance(
  strapi: Core.Strapi,
  id: string,
  work: () => Promise<unknown>
) {
  try {
    await work()
    await recordMaintenanceSuccess(strapi, id)
  } catch (error) {
    const store = healthStore(strapi, id)
    const previous = ((await store.get()) ?? {}) as Receipt
    await store.set({
      value: {
        ...previous,
        lastAttempt: new Date().toISOString(),
        failed: true,
      },
    })
    throw error
  }
}

function jobs(strapi: Core.Strapi, now: Date): MaintenanceJob[] {
  return [
    {
      id: "mobile-live-stop",
      interval: 300_000,
      external: true,
      run: async () => {},
    },
    {
      id: "mobile-live-retention",
      interval: DAY,
      external: true,
      run: async () => {},
    },
    {
      id: "notification-retention",
      interval: DAY,
      run: () => strapi.service("api::notification.notification").purge(now),
    },
    {
      id: "erased-media",
      interval: 300_000,
      run: async () => {
        const result = await purgeErasedMedia(strapi)
        if (result.failed) throw new Error("media_cleanup_pending")

        return result
      },
    },
    {
      id: "internal-retention",
      interval: DAY,
      run: () =>
        strapi.db
          .query("api::internal-notification.internal-notification")
          .deleteMany({
            where: {
              eventAt: {
                $lt: new Date(now.getTime() - 90 * DAY).toISOString(),
              },
            },
          }),
    },
    {
      id: "event-search",
      interval: 60_000,
      run: async () =>
        (await import("./event-search-refresh")).refreshEventSearch(strapi),
    },
    {
      id: "opening-schedules",
      interval: 60_000,
      run: async () =>
        (await import("./opening-schedule-refresh")).refreshDueOpeningSchedules(
          strapi,
          now
        ),
    },
    {
      id: "drive-lifecycle",
      interval: 3_600_000,
      run: () => strapi.service("api::drive.drive").runLifecycle(now),
    },
    {
      id: "review-rounds",
      interval: 60_000,
      run: async () =>
        (
          await import("../plugins/content-moderation/server/utils/suggestion-rounds")
        ).reviewRoundView(strapi, false),
    },
    {
      id: "feed-housekeeping",
      interval: 900_000,
      run: async () => {
        const job = await import("../plugins/events/server/cron")
        await job.handleAutoPaused(strapi)

        return job.purgeOAuthDrafts(strapi)
      },
    },
    {
      id: "expired-roles",
      interval: DAY,
      run: async () =>
        (await import("./role-grants")).resyncExpiredRoleGrants(strapi),
    },
  ]
}

export async function cmsMaintenanceStatus(
  strapi: Core.Strapi,
  now = new Date(),
  selected = jobs(strapi, now)
) {
  const stale: string[] = []
  for (const job of selected) {
    const receipt = ((await healthStore(strapi, job.id).get()) ?? {}) as Receipt
    const last = Date.parse(receipt.lastSuccess ?? "")
    if (
      !Number.isFinite(last) ||
      last > now.getTime() + 30_000 ||
      now.getTime() - last > job.interval * 2 + 300_000 ||
      receipt.failed
    )
      stale.push(job.id)
  }

  return { ok: stale.length === 0, stale }
}

/** Independent of configured CMS cron. Every phase is bounded/idempotent and
 * success is recorded only after the actual work; one failed phase cannot
 * starve the remaining retention or lifecycle phases.
 */
export async function runCmsMaintenance(
  strapi: Core.Strapi,
  now = new Date(),
  selected = jobs(strapi, now)
) {
  const outcome = await withLeaderLock(strapi, LOCK, async () => {
    const report = { ok: true, ran: [] as string[], failed: [] as string[] }
    for (const job of selected) {
      if (job.external) continue
      const store = healthStore(strapi, job.id)
      const saved = ((await store.get()) ?? {}) as Receipt
      const previous = Date.parse(saved.lastSuccess ?? "")
      if (
        Number.isFinite(previous) &&
        previous <= now.getTime() &&
        now.getTime() - previous < job.interval
      )
        continue
      const receipt: Receipt = { ...saved, lastAttempt: now.toISOString() }
      try {
        await job.run()
        receipt.lastSuccess = now.toISOString()
        receipt.failed = false
        report.ran.push(job.id)
      } catch {
        receipt.failed = true
        report.ok = false
        report.failed.push(job.id)
      }
      await store.set({ value: receipt })
    }

    return report
  })

  return outcome.ran ? outcome.result : { ok: true, skipped: true }
}
