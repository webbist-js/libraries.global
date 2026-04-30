export default ({ strapi }: { strapi: any }) => ({
  // ── Content API ──────────────────────────────────────────────────────────

  async leaderboard(ctx: any) {
    const {
      period = "month",
      region,
      page = "1",
      limit = "20",
    } = ctx.query as Record<string, string>

    const entries = await strapi
      .plugin("rewards")
      .service("leaderboard")
      .getLeaderboard({
        period: period as "today" | "week" | "month" | "all",
        region: region ?? undefined,
        page: Number(page),
        limit: Math.min(Number(limit), 100),
      })

    return ctx.send({ data: entries })
  },

  async myStanding(ctx: any) {
    const baUserId = ctx.request.headers["x-ba-user-id"] as string | undefined

    if (!baUserId) {
      return ctx.unauthorized("Authentication required")
    }

    const standing = await strapi
      .plugin("rewards")
      .service("leaderboard")
      .getStanding(baUserId)

    return ctx.send({ data: standing })
  },

  async myHistory(ctx: any) {
    const baUserId = ctx.request.headers["x-ba-user-id"] as string | undefined

    if (!baUserId) {
      return ctx.unauthorized("Authentication required")
    }

    const { page = "1" } = ctx.query as Record<string, string>
    const limit = 50
    const offset = (Number(page) - 1) * limit

    const events = await strapi.db
      .query("plugin::rewards.point-event")
      .findMany({
        where: { baUserId },
        orderBy: { awardedAt: "desc" },
        limit,
        offset,
      })

    return ctx.send({ data: events })
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
            label: "Opening hours verified on-site",
            points: 5,
          },
          {
            action: "status_verified",
            label: "Operational status verified",
            points: 5,
          },
          {
            action: "wiki_translated",
            label: "Wiki page translation approved",
            points: 15,
          },
          {
            action: "daily_streak",
            label: "Daily contribution streak",
            points: 1,
          },
        ],
      },
    })
  },

  // ── Admin routes ─────────────────────────────────────────────────────────

  async adminEvents(ctx: any) {
    const {
      baUserId,
      action,
      from,
      to,
      page = "1",
    } = ctx.query as Record<string, string>
    const limit = 50
    const offset = (Number(page) - 1) * limit

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
      meta: { total, page: Number(page), limit },
    })
  },

  async adminAward(ctx: any) {
    const { baUserId, action, points, reason } = ctx.request.body as {
      baUserId: string
      action: "manual_award" | "manual_deduct"
      points: number
      reason: string
    }

    if (!baUserId || !action || points === undefined || !reason) {
      return ctx.badRequest(
        "baUserId, action, points, and reason are all required"
      )
    }
    if (!["manual_award", "manual_deduct"].includes(action)) {
      return ctx.badRequest('action must be "manual_award" or "manual_deduct"')
    }

    const adminUserId = ctx.state?.admin?.id ?? ctx.state?.user?.id ?? "unknown"

    await strapi
      .plugin("rewards")
      .service("points")
      .award(
        baUserId,
        action,
        action === "manual_deduct" ? -Math.abs(points) : Math.abs(points),
        {
          reason,
          awardedBy: String(adminUserId),
        }
      )

    return ctx.send({ ok: true })
  },

  async adminChartData(ctx: any) {
    const days = 30
    const now = new Date()

    // Build daily buckets for the last N days
    const dailyPoints: { date: string; points: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayStart = new Date(dateStr + "T00:00:00.000Z")
      const dayEnd = new Date(dateStr + "T23:59:59.999Z")

      const rows = (await strapi.db.connection
        .select(strapi.db.connection.raw("COALESCE(SUM(points), 0) as total"))
        .from("rw_point_events")
        .where("awarded_at", ">=", dayStart.toISOString())
        .where("awarded_at", "<=", dayEnd.toISOString())) as {
        total: string | number
      }[]

      dailyPoints.push({ date: dateStr, points: Number(rows[0]?.total ?? 0) })
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
