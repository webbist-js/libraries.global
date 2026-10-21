// apps/strapi/src/plugins/events/server/services/stats.ts
import type { EventsStats } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { PUBLIC_EVENT_STATUSES, dowHourSql } from "../utils/query"

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export async function computeEventStats(
  strapi: Core.Strapi
): Promise<EventsStats> {
  try {
    const db = strapi.db.connection
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // One pass over the upcoming public events for all four counts
    // (`FILTER` is supported by Postgres and sqlite >= 3.30).
    const [countRow] = await db("ev_events")
      .select(
        db.raw("count(*) as total"),
        db.raw("count(*) filter (where start_time <= ?) as week", [weekLater]),
        db.raw("count(*) filter (where start_time <= ?) as month", [
          monthLater,
        ]),
        db.raw("count(*) filter (where is_free = ?) as free", [true])
      )
      .where("start_time", ">=", now)
      .where("pending_review", false)
      .whereIn("status", [...PUBLIC_EVENT_STATUSES])

    const { dow, hour } = dowHourSql(strapi)
    const peakRows = await db("ev_events")
      .select(
        db.raw(`${dow} as dow`),
        db.raw(`${hour} as hour`),
        db.raw("count(*) as cnt")
      )
      .where("start_time", ">=", now)
      .where("pending_review", false)
      .whereIn("status", [...PUBLIC_EVENT_STATUSES])
      .groupByRaw("1, 2")
      .orderBy("cnt", "desc")
      .limit(1)

    const peak = peakRows[0] as
      | { dow: string | number; hour: string | number; cnt: string | number }
      | undefined
    const peakLabel = peak
      ? `${DOW_LABELS[Number(peak.dow)] ?? ""} ${String(peak.hour).padStart(2, "0")}:00`
      : null

    const counts = (countRow ?? {}) as Record<string, unknown>
    const total = Number(counts.total ?? 0)
    const totalThisWeek = Number(counts.week ?? 0)
    const totalThisMonth = Number(counts.month ?? 0)
    const freeCount = Number(counts.free ?? 0)

    return {
      totalEvents: total,
      totalThisWeek,
      totalThisMonth,
      percentFree: total > 0 ? Math.round((freeCount / total) * 100) : 0,
      peakSlot: peakLabel,
      peakCount: peak ? Number(peak.cnt) : 0,
    }
  } catch (err) {
    strapi.log.error("[events] computeEventStats failed", err)

    throw err
  }
}
