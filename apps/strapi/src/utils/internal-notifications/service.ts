import { createHash, randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"

import type { Core } from "@strapi/strapi"

import { collectAuthEvents, collectContentEvents } from "./events"
import {
  notificationConfig,
  postToSlack,
  SlackDeliveryError,
  slackMessage,
  type InternalEvent,
} from "./slack"
import { withLeaderLock } from "../leader-lock"

const TABLE = "internal_notifications"
const UID = "api::internal-notification.internal-notification"
const DAY = 86400000

export async function ensureInternalNotificationIndexes(strapi: Core.Strapi) {
  const db = strapi.db.connection
  if (!(await db.schema.hasTable(TABLE))) return
  await db.transaction(async (trx) => {
    if (["pg", "postgres", "postgresql"].includes(strapi.db.dialect.client))
      await trx.raw("SET LOCAL lock_timeout = '5s'")
    await trx.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS internal_notifications_event_unique ON ${TABLE} (event_key)`
    )
    await trx.raw(
      `CREATE INDEX IF NOT EXISTS internal_notifications_delivery_idx ON ${TABLE} (state, next_attempt_at, id)`
    )
  })
}

type DeliveryRow = InternalEvent & { id: number; attempts: number }

async function recordFailure(
  strapi: Core.Strapi,
  row: DeliveryRow,
  error: unknown
) {
  const failure =
    error instanceof SlackDeliveryError
      ? error
      : new SlackDeliveryError("internal_delivery_failed")
  const attempts = (row.attempts ?? 0) + 1
  const terminal = failure.permanent || attempts >= 8
  await strapi.db.query(UID).update({
    where: { id: row.id },
    data: {
      state: terminal ? "failed" : "pending",
      attempts,
      lastError: failure.code,
      nextAttemptAt: new Date(
        Date.now() +
          1000 * (failure.retryAfter ?? Math.min(3600, 30 * 2 ** attempts))
      ).toISOString(),
    },
  })
  await strapi
    .store({ type: "core", name: "internal-notifications", key: "cooldown" })
    .set({
      value: {
        until: failure.permanent
          ? Number.MAX_SAFE_INTEGER
          : Date.now() +
            1000 * (failure.retryAfter ?? Math.min(3600, 30 * 2 ** attempts)),
      },
    })

  return { terminal }
}

export function internalNotifications(strapi: Core.Strapi) {
  const query = () => strapi.db.query(UID)
  const actorName = async (id?: string) => {
    if (!id) return null
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({
        where: { baUserId: id },
        select: ["username", "contributorNumber"],
      })

    return profile?.username
      ? `@${profile.username}`
      : profile?.contributorNumber
        ? `Contributor #${profile.contributorNumber}`
        : `Account ${id.slice(0, 8)}`
  }
  const enqueue = async (event: InternalEvent) => {
    const config = notificationConfig()
    if (!config || Date.parse(event.eventAt) < Date.parse(config.since)) return
    const now = new Date().toISOString()
    // Conflict handling is in PostgreSQL, including concurrent presence writes.
    await strapi.db
      .connection(TABLE)
      .insert({
        document_id: randomUUID().replaceAll("-", ""),
        event_key: event.eventKey,
        kind: event.kind,
        title: event.title.slice(0, 200),
        detail: event.detail.slice(0, 1500),
        href: event.href || null,
        actor_id: event.actorId || null,
        event_at: event.eventAt,
        state: "pending",
        attempts: 0,
        next_attempt_at: now,
        created_at: now,
        updated_at: now,
      })
      .onConflict("event_key")
      .ignore()
  }

  const summary = async (now: Date) => {
    // A daily count remains useful as activity grows; timestamps use UTC.
    if (now.getUTCHours() < 17) return
    const counts = await strapi.db
      .connection(TABLE)
      .select("kind")
      .count({ total: "id" })
      .where("event_at", ">=", new Date(now.getTime() - DAY).toISOString())
      .whereNot("kind", "daily_summary")
      .groupBy("kind")
    await enqueue({
      eventKey: `summary:${now.toISOString().slice(0, 10)}`,
      kind: "daily_summary",
      title: "Beta activity in the last 24 hours",
      detail: counts.length
        ? counts
            .map(
              (r: { kind: string; total: string }) =>
                `${r.kind.replaceAll("_", " ")}: ${r.total}`
            )
            .join(" · ")
        : "No recorded activity in the last 24 hours.",
      eventAt: now.toISOString(),
    })
  }

  const sourceHealth = async (count: number, now: Date) => {
    if (!count) return
    await enqueue({
      eventKey: `source-health:${now.toISOString().slice(0, 10)}`,
      kind: "service_alert",
      title: "Beta activity monitoring needs attention",
      detail: `${count} source checks failed. Other activity notifications continue. Check the internal notification job logs; missed records will be reconciled after recovery.`,
      eventAt: now.toISOString(),
    })
  }

  const deliver = async (
    row: DeliveryRow,
    config: NonNullable<ReturnType<typeof notificationConfig>>
  ) => {
    const who = await actorName(row.actorId)
    const event = {
      ...row,
      detail: `${who ? `${who} · ` : ""}${row.detail}`,
    }
    await postToSlack(config.webhook, slackMessage(event, config.environment))
    await query().update({
      where: { id: row.id },
      data: {
        state: "sent",
        sentAt: new Date().toISOString(),
        lastError: null,
      },
    })
  }

  return {
    enqueue,
    async active(baUserId: string) {
      if (!notificationConfig()) return
      const now = new Date()
      await enqueue({
        eventKey: `active:${createHash("sha256").update(baUserId).digest("hex")}:${now.toISOString().slice(0, 10)}`,
        kind: "active_beta",
        title: "Active in beta",
        detail:
          "Authenticated use of the platform (one activity alert per person per UTC day).",
        actorId: baUserId,
        eventAt: now.toISOString(),
      })
    },
    async status() {
      const counts: Record<string, number> = {}
      for (const state of ["pending", "sent", "failed", "expired"])
        counts[state] = await query().count({ where: { state } })

      return {
        enabled: process.env.INTERNAL_NOTIFICATIONS_ENABLED === "true",
        dryRun: process.env.INTERNAL_NOTIFICATIONS_DRY_RUN === "true",
        counts,
      }
    },
    async retry() {
      await strapi
        .store({
          type: "core",
          name: "internal-notifications",
          key: "cooldown",
        })
        .set({ value: { until: 0 } })

      return query().updateMany({
        where: { state: "failed" },
        data: {
          state: "pending",
          attempts: 0,
          lastError: null,
          nextAttemptAt: new Date().toISOString(),
        },
      })
    },
    async run(now = new Date()) {
      const config = notificationConfig()
      if (!config) return { enabled: false }
      const locked = await withLeaderLock(strapi, 7_420_110, async () => {
        const queuedSourcesFailed = await collectContentEvents(
          strapi,
          config.since,
          enqueue
        )
        const report = {
          queuedSourcesFailed,
          sent: 0,
          failed: 0,
          deferred: 0,
          dryRun: config.dryRun,
        }
        try {
          await collectAuthEvents(strapi, enqueue)
        } catch {
          report.queuedSourcesFailed++
          strapi.log.warn(
            "[internal-notifications] Account/session reconciliation unavailable"
          )
        }
        await sourceHealth(report.queuedSourcesFailed, now)
        await summary(now)
        // Keep deduplication keys, but remove personal payloads after 30 days.
        await query().updateMany({
          where: {
            eventAt: { $lt: new Date(now.getTime() - 30 * DAY).toISOString() },
            state: { $ne: "expired" },
          },
          data: {
            title: null,
            detail: null,
            href: null,
            actorId: null,
            state: "expired",
            lastError: null,
          },
        })
        if (config.dryRun) return report
        const cooldown = strapi.store({
          type: "core",
          name: "internal-notifications",
          key: "cooldown",
        })
        if (
          ((await cooldown.get()) as { until?: number })?.until > now.getTime()
        )
          return report
        const rows = await query().findMany({
          where: {
            state: "pending",
            nextAttemptAt: { $lte: now.toISOString() },
          },
          orderBy: { id: "asc" },
          limit: 20,
        })
        const deadline = Date.now() + 35000
        for (const row of rows) {
          if (Date.now() > deadline) break
          try {
            await deliver(row, config)
            report.sent++
            await setTimeout(1100)
          } catch (error) {
            const { terminal } = await recordFailure(strapi, row, error)
            report.failed += terminal ? 1 : 0
            report.deferred += terminal ? 0 : 1
            break
          }
        }

        return report
      })

      return locked.ran ? locked.result : { locked: true }
    },
  }
}
