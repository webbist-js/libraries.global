// Leaderboard snapshot service — takes a weekly ranked snapshot of top contributors
// so that rankChange deltas can be computed on the live leaderboard.

export type SnapshotEntry = {
  baUserId: string
  username: string | null
  rank: number
  periodPoints: number
}

// Returns an ISO week string like "2026-W18" for the given date (UTC).
export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const dayOfWeek = d.getUTCDay() || 7 // treat Sunday as 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek) // shift to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  )

  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

// Returns the ISO week string for the week immediately before the given date.
export function getPreviousISOWeek(date: Date = new Date()): string {
  const prev = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000)

  return getISOWeek(prev)
}

export default ({ strapi }: { strapi: any }) => ({
  // Take a weekly snapshot of the top 1000 contributors for the current ISO week.
  // Idempotent — skips if a snapshot for this week already exists.
  async takeWeeklySnapshot(): Promise<void> {
    const period = getISOWeek()

    const existing = await strapi.db
      .query("plugin::rewards.leaderboard-snapshot")
      .findOne({ where: { period, periodType: "weekly" } })

    if (existing) return

    // Aggregate period points for the current ISO week
    const weekStart = new Date()
    const dayOfWeek = weekStart.getUTCDay() || 7
    weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek + 1) // Monday
    weekStart.setUTCHours(0, 0, 0, 0)

    const rows = (await strapi.db.connection
      .select("ba_user_id")
      .sum({ periodPoints: "points" })
      .from("rw_point_events")
      .where("awarded_at", ">=", weekStart.toISOString())
      .groupBy("ba_user_id")
      .orderBy("periodPoints", "desc")
      .limit(1000)) as { ba_user_id: string; periodPoints: string }[]

    if (rows.length === 0) return

    // Fetch usernames
    const userIds = rows.map((r) => r.ba_user_id)
    const profiles = (await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({ where: { baUserId: { $in: userIds } } })) as {
      baUserId: string
      username: string | null
    }[]

    const usernameMap = new Map(profiles.map((p) => [p.baUserId, p.username]))

    const entries: SnapshotEntry[] = rows.map((row, i) => ({
      baUserId: row.ba_user_id,
      username: usernameMap.get(row.ba_user_id) ?? null,
      rank: i + 1,
      periodPoints: Number(row.periodPoints),
    }))

    await strapi.db.query("plugin::rewards.leaderboard-snapshot").create({
      data: {
        period,
        periodType: "weekly",
        entries,
        takenAt: new Date().toISOString(),
      },
    })

    strapi.log.info(
      `[rewards] Weekly leaderboard snapshot taken for ${period} (${entries.length} entries)`
    )
  },

  // Load the ranked entries from the previous ISO week's snapshot.
  // Returns a Map of baUserId → rank, or an empty Map if no snapshot exists.
  async getPreviousWeekRankMap(): Promise<Map<string, number>> {
    const period = getPreviousISOWeek()

    const snapshot = await strapi.db
      .query("plugin::rewards.leaderboard-snapshot")
      .findOne({ where: { period, periodType: "weekly" } })

    if (!snapshot?.entries) return new Map()

    return new Map<string, number>(
      (snapshot.entries as SnapshotEntry[]).map((e) => [e.baUserId, e.rank])
    )
  },
})
