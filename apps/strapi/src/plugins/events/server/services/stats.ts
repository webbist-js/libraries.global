// apps/strapi/src/plugins/events/server/services/stats.ts
import type { EventsStats } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

export async function computeEventStats(
  strapi: Core.Strapi
): Promise<EventsStats> {
  try {
    const db = strapi.db.connection
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [totalRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
    const [weekRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", weekLater)
    const [freeRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("is_free", true)
    const [monthRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", monthLater)

    const peakRows = await db("ev_events")
      .select(
        db.raw("strftime('%w', start_time) as dow"),
        db.raw("strftime('%H', start_time) as hour"),
        db.raw("count(*) as cnt")
      )
      .where("start_time", ">=", now)
      .groupByRaw("dow, hour")
      .orderBy("cnt", "desc")
      .limit(1)

    const peak = peakRows[0] as
      | { dow: string; hour: string; cnt: string }
      | undefined
    const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const peakLabel = peak
      ? `${DOW_LABELS[Number(peak.dow)] ?? ""} ${String(peak.hour).padStart(2, "0")}:00`
      : null

    const total = Number((totalRow as { count: unknown }).count)
    const totalThisWeek = Number((weekRow as { count: unknown }).count)
    const freeCount = Number((freeRow as { count: unknown }).count)
    const totalThisMonth = Number((monthRow as { count: unknown }).count)

    return {
      totalEvents: total,
      totalThisWeek,
      totalThisMonth,
      percentFree: total > 0 ? Math.round((freeCount / total) * 100) : 0,
      peakSlot: peakLabel,
      peakCount: peak ? Number(peak.cnt) : 0,
    }
  } catch {
    return {
      totalEvents: 0,
      totalThisWeek: 0,
      totalThisMonth: 0,
      percentFree: 0,
      peakSlot: null,
      peakCount: 0,
    }
  }
}
