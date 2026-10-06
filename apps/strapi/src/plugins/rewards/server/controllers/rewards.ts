import { clampInt } from "../utils/query"
import { isValidServiceSecret } from "../utils/service-secret"

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])
const PERIODS = new Set(["today", "week", "month", "all"])
const PAGE = { def: 1, min: 1, max: 10_000 }
const HISTORY_LIMIT = 50

function isPostgres(strapi: any): boolean {
  return PG_CLIENTS.has(String(strapi.db?.dialect?.client ?? "").toLowerCase())
}

function stripAwardedBy(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const { awardedBy: _awardedBy, ...rest } = metadata

  return rest
}

export default ({ strapi }: { strapi: any }) => ({
  // ── Content API ──────────────────────────────────────────────────────────

  async leaderboard(ctx: any) {
    const q = ctx.query as Record<string, unknown>
    const period = PERIODS.has(String(q.period)) ? String(q.period) : "month"

    const entries = await strapi
      .plugin("rewards")
      .service("leaderboard")
      .getLeaderboard({
        period: period as "today" | "week" | "month" | "all",
        page: clampInt(q.page, PAGE),
        limit: clampInt(q.limit, { def: 20, min: 1, max: 100 }),
      })

    ctx.set("Cache-Control", "public, max-age=60")

    return ctx.send({ data: entries })
  },

  async myStanding(ctx: any) {
    // X-Ba-User-Id is only trusted on server-to-server calls from Next.js.
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }
    const baUserId = ctx.request.headers["x-ba-user-id"] as string | undefined

    if (!baUserId) {
      return ctx.unauthorized("Authentication required")
    }

    const q = ctx.query as Record<string, unknown>
    const period = PERIODS.has(String(q.period)) ? String(q.period) : "month"

    const standing = await strapi
      .plugin("rewards")
      .service("leaderboard")
      .getStanding(baUserId, period as "today" | "week" | "month" | "all")

    return ctx.send({ data: standing })
  },

  async myHistory(ctx: any) {
    // X-Ba-User-Id is only trusted on server-to-server calls from Next.js.
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }
    const baUserId = ctx.request.headers["x-ba-user-id"] as string | undefined

    if (!baUserId) {
      return ctx.unauthorized("Authentication required")
    }

    const page = clampInt((ctx.query as Record<string, unknown>).page, PAGE)
    const limit = HISTORY_LIMIT
    const offset = (page - 1) * limit

    const events = (await strapi.db
      .query("plugin::rewards.point-event")
      .findMany({
        where: { baUserId },
        select: ["action", "points", "awardedAt", "metadata"],
        orderBy: { awardedAt: "desc" },
        limit,
        offset,
      })) as {
      action: string
      points: number
      awardedAt: string
      metadata: Record<string, unknown> | null
    }[]

    // Never the idempotency key, and never who awarded a manual grant.
    return ctx.send({
      data: events.map(({ action, points, awardedAt, metadata }) => ({
        action,
        points,
        awardedAt,
        metadata: metadata ? stripAwardedBy(metadata) : null,
      })),
    })
  },

  async howItWorks(ctx: any) {
    return ctx.send({
      data: {
        tiers: [
          { level: 1, name: "Reader", min: 0 },
          { level: 2, name: "Indexer", min: 100 },
          { level: 3, name: "Cartographer", min: 500 },
          { level: 4, name: "Archivist", min: 1500 },
          { level: 5, name: "Scholar", min: 4000 },
          { level: 6, name: "Curator", min: 9000 },
        ],
        actions: [
          {
            action: "new_library_approved",
            label: "New library approved",
            points: 50,
          },
          {
            action: "edit_accepted_minor",
            label: "Edit approved (1–3 fields)",
            points: 5,
          },
          {
            action: "edit_accepted_major",
            label: "Edit approved (4+ fields)",
            points: 15,
          },
          {
            action: "photo_licensed_cc",
            label: "CC-licensed photo accepted",
            points: 8,
          },
          {
            action: "hours_verified",
            label: "Opening hours checked and accepted",
            points: 5,
          },
          {
            action: "status_verified",
            label: "Open status checked and accepted",
            points: 5,
          },
          {
            action: "wiki_translated",
            label: "Wiki page translation approved",
            points: 15,
          },
          {
            action: "correction_approved",
            label: "Correction approved",
            points: 2,
          },
          {
            action: "source_added",
            label: "Source added to a record",
            points: 3,
          },
          {
            action: "claim_approved",
            label: "Library claim approved",
            points: 10,
          },
          {
            action: "knowledge_edit_accepted",
            label: "Knowledge page edit approved",
            points: 8,
          },
          {
            action: "knowledge_article_published",
            label: "New Knowledge article approved",
            points: 25,
          },
          {
            action: "journal_accepted",
            label: "Journal article accepted",
            points: 30,
          },
          {
            action: "journal_edit_accepted",
            label: "Journal article edit approved",
            points: 8,
          },
          {
            action: "journal_translated",
            label: "Journal article translation approved",
            points: 15,
          },
          {
            action: "daily_streak",
            label: "Daily contribution streak",
            points: 1,
          },
          {
            action: "drive_task_accepted",
            label: "Drive task accepted",
            points: 2,
          },
          {
            action: "drive_finished",
            label: "Helped finish a drive (5+ accepted tasks)",
            points: 25,
          },
          {
            action: "drive_proposal_accepted",
            label: "Drive proposal accepted",
            points: 10,
          },
        ],
      },
    })
  },

  // ── Admin routes ─────────────────────────────────────────────────────────

  async adminEvents(ctx: any) {
    const { baUserId, action, from, to } = ctx.query as Record<string, string>
    const page = clampInt((ctx.query as Record<string, unknown>).page, PAGE)
    const limit = HISTORY_LIMIT
    const offset = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (baUserId) where.baUserId = baUserId
    if (action) where.action = action
    if (from || to) {
      where.awardedAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }

    const events = await strapi.db
      .query("plugin::rewards.point-event")
      .findMany({
        where,
        orderBy: { awardedAt: "desc" },
        limit,
        offset,
      })

    const total = await strapi.db
      .query("plugin::rewards.point-event")
      .count({ where })

    return ctx.send({
      data: events,
      meta: { total, page, limit },
    })
  },

  async adminAward(ctx: any) {
    const { baUserId, action, points, reason, clientRequestId } = (ctx.request
      .body ?? {}) as {
      baUserId?: unknown
      action?: unknown
      points?: unknown
      reason?: unknown
      clientRequestId?: unknown
    }

    const adminUserId = ctx.state?.user?.id ?? ctx.state?.admin?.id
    if (adminUserId === undefined || adminUserId === null) {
      return ctx.unauthorized("Admin identity required")
    }

    if (
      typeof baUserId !== "string" ||
      !baUserId ||
      typeof reason !== "string" ||
      !reason.trim() ||
      typeof clientRequestId !== "string" ||
      !/^[\w.-]{8,64}$/.test(clientRequestId)
    ) {
      return ctx.badRequest(
        "baUserId, action, points, reason and clientRequestId are all required"
      )
    }
    if (action !== "manual_award" && action !== "manual_deduct") {
      return ctx.badRequest('action must be "manual_award" or "manual_deduct"')
    }
    // A manual grant is a whole number of points, 1 to 500 per request.
    const n =
      typeof points === "number"
        ? points
        : typeof points === "string" && points.trim() !== ""
          ? Number(points)
          : Number.NaN
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      return ctx.badRequest("points must be an integer between 1 and 500")
    }

    // Never auto-create a profile from the admin panel: the id must be real.
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, select: ["id"] })
    if (!profile) return ctx.notFound("No profile for that baUserId")

    // One award per admin click: the admin UI sends a fresh uuid per click,
    // so a retried or double-submitted request cannot award twice.
    const idempotencyKey = `admin:${adminUserId}:${baUserId}:${clientRequestId}`
    const { awarded } = await strapi
      .plugin("rewards")
      .service("points")
      .award(
        baUserId,
        action,
        action === "manual_deduct" ? -n : n,
        { reason: reason.trim(), awardedBy: String(adminUserId) },
        idempotencyKey
      )

    return ctx.send({ ok: true, awarded })
  },

  async adminChartData(ctx: any) {
    const days = 30
    const now = new Date()
    const knex = strapi.db.connection

    // One grouped query for the whole window, then fill the empty days.
    const first = new Date(now)
    first.setUTCDate(first.getUTCDate() - (days - 1))
    const windowStart = new Date(
      first.toISOString().slice(0, 10) + "T00:00:00.000Z"
    )
    const dayExpr = isPostgres(strapi)
      ? "date_trunc('day', awarded_at)"
      : "date(awarded_at)"
    const dailyRows = (await knex
      .select(knex.raw(`${dayExpr} as day`))
      .sum({ total: "points" })
      .from("rw_point_events")
      .where("awarded_at", ">=", windowStart.toISOString())
      .groupBy(knex.raw(dayExpr))) as {
      day: Date | string
      total: string | number | null
    }[]
    const byDay = new Map<string, number>()
    for (const row of dailyRows) {
      const key =
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10)
      byDay.set(key, Number(row.total ?? 0))
    }

    const dailyPoints: { date: string; points: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      dailyPoints.push({ date: dateStr, points: byDay.get(dateStr) ?? 0 })
    }

    // Action breakdown (all time)
    const actionRows = (await strapi.db.connection
      .select("action")
      .count("* as count")
      .sum("points as total_points")
      .from("rw_point_events")
      .groupBy("action")
      .orderBy("count", "desc")) as {
      action: string
      count: string | number
      total_points: string | number
    }[]

    return ctx.send({
      data: {
        dailyPoints,
        actionBreakdown: actionRows.map((r) => ({
          action: r.action,
          count: Number(r.count),
          totalPoints: Number(r.total_points),
        })),
      },
    })
  },

  async adminTakeSnapshot(ctx: any) {
    await strapi.plugin("rewards").service("snapshot").takeWeeklySnapshot()

    return ctx.send({ ok: true })
  },

  async adminStats(ctx: any) {
    const now = new Date()
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )

    const totalContributors = (await strapi.db.connection
      .countDistinct({ count: "ba_user_id" })
      .from("rw_point_events")) as { count: string }[]

    const pointsThisMonth = (await strapi.db.connection
      .sum({ total: "points" })
      .from("rw_point_events")
      .where("awarded_at", ">=", monthStart.toISOString())) as {
      total: string | null
    }[]

    return ctx.send({
      data: {
        totalContributors: Number(totalContributors[0]?.count ?? 0),
        pointsThisMonth: Number(pointsThisMonth[0]?.total ?? 0),
      },
    })
  },
})
