import { computeTier, type TierInfo } from "./points"
import { isActivityPublic } from "../../../../utils/activity-visibility"

export type Period = "today" | "week" | "month" | "all"

export type LeaderboardEntry = {
  rank: number
  rankChange: number | null
  username: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  country: string | null
  city: string | null
  contributorRole: string | null
  periodPoints: number
  totalPoints: number
  tier: string
  approvedCount: number
  acceptanceRate: number | null
}

export type Standing = {
  globalRank: number | null
  countryRank: number | null
  monthRank: number | null
  periodRank: number | null
  country: string | null
  tier: TierInfo
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

function periodStart(period: Period): Date | null {
  const now = new Date()
  if (period === "all") return null
  if (period === "today") {
    return new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z")
  }
  if (period === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  // month
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

// Role applications aren't index/knowledge/journal work, so they're left out
// of both the approved count and the acceptance rate.
const SUBMISSION_COUNT_EXCLUDED_TYPE = "role_application"

/** Sum of `rw_point_events.points` for one user since `start` (or all time). */
async function sumPointsSince(
  strapi: any,
  baUserId: string,
  start: Date | null
): Promise<number> {
  let q = strapi.db.connection
    .sum({ total: "points" })
    .from("rw_point_events")
    .where("ba_user_id", baUserId)

  if (start) q = q.where("awarded_at", ">=", start.toISOString())

  const rows = (await q) as { total: string | number | null }[]

  return Number(rows[0]?.total ?? 0)
}

/** Count of distinct users whose summed points since `start` exceed `points`. */
async function countUsersAbove(
  strapi: any,
  start: Date | null,
  points: number
): Promise<number> {
  let q = strapi.db.connection
    .select("ba_user_id")
    .sum({ total: "points" })
    .from("rw_point_events")
    .groupBy("ba_user_id")
    .havingRaw("SUM(points) > ?", [points])

  if (start) q = q.where("awarded_at", ">=", start.toISOString())

  const rows = (await q) as unknown[]

  return rows.length
}

/**
 * Rank among every user by points since the period start (`all` sums every
 * event). Null when the user has no points in the period — no second query
 * needed in that case.
 */
async function rankForPeriod(
  strapi: any,
  baUserId: string,
  period: Period
): Promise<number | null> {
  const start = periodStart(period)
  const points = await sumPointsSince(strapi, baUserId, start)
  if (points <= 0) return null

  const above = await countUsersAbove(strapi, start, points)

  return above + 1
}

// The public leaderboard is the same for everyone, so each (period, page,
// limit) is computed at most once a minute per process. Keyed by the strapi
// instance so tests with their own fakes don't share memory.
const LEADERBOARD_TTL_MS = 60_000
const leaderboardMemo = new WeakMap<
  object,
  Map<string, { expires: number; value: LeaderboardEntry[] }>
>()

export default ({ strapi }: { strapi: any }) => ({
  async getLeaderboard(opts: {
    period: Period
    page: number
    limit: number
  }): Promise<LeaderboardEntry[]> {
    const { period, page, limit } = opts
    const key = `${period}:${page}:${limit}`
    let memo = leaderboardMemo.get(strapi)
    if (!memo) {
      memo = new Map()
      leaderboardMemo.set(strapi, memo)
    }
    const hit = memo.get(key)
    if (hit && hit.expires > Date.now()) return hit.value

    const value = await (this as any).computeLeaderboard(opts)
    memo.set(key, { expires: Date.now() + LEADERBOARD_TTL_MS, value })

    return value
  },

  async computeLeaderboard(opts: {
    period: Period
    page: number
    limit: number
  }): Promise<LeaderboardEntry[]> {
    const { period, page, limit } = opts
    const start = periodStart(period)
    const offset = (page - 1) * limit

    // Step 1: aggregate points per user for the period
    let q = strapi.db.connection
      .select("ba_user_id")
      .sum({ periodPoints: "points" })
      .from("rw_point_events")
      .groupBy("ba_user_id")
      .orderBy("periodPoints", "desc")
      .limit(limit)
      .offset(offset)

    if (start) q = q.where("awarded_at", ">=", start.toISOString())

    const rows = (await q) as { ba_user_id: string; periodPoints: string }[]

    if (rows.length === 0) return []

    // Step 2: fetch profile data for each user
    const userIds = rows.map((r) => r.ba_user_id)
    const profiles = (await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({
        where: { baUserId: { $in: userIds } },
      })) as {
      baUserId: string
      username: string | null
      firstName: string | null
      lastName: string | null
      avatarUrl: string | null
      country: string | null
      city: string | null
      contributorRole: string | null
      points: number
      tier: string
      profileVisibility?: string
      publicPrefs?: { showLocation?: boolean; showActivity?: boolean } | null
    }[]

    const profileMap = new Map(profiles.map((p) => [p.baUserId, p]))

    // Step 3: approved count (in the period) and all-time acceptance rate,
    // in one grouped query over the submissions table. Role applications are
    // excluded from both.
    const approvedCountExpr: [string, unknown[]] = start
      ? [
          "SUM(CASE WHEN status = ? AND reviewed_at >= ? THEN 1 ELSE 0 END) as approved_count",
          ["approved", start.toISOString()],
        ]
      : [
          "SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved_count",
          ["approved"],
        ]

    const submissionRows = (await strapi.db.connection
      .select("submitted_by_user_id")
      .select(
        strapi.db.connection.raw(approvedCountExpr[0], approvedCountExpr[1])
      )
      .select(
        strapi.db.connection.raw(
          "SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved_all",
          ["approved"]
        )
      )
      .select(
        strapi.db.connection.raw(
          "SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected_all",
          ["rejected"]
        )
      )
      .from("cm_submissions")
      .whereIn("submitted_by_user_id", userIds)
      .whereNot("submission_type", SUBMISSION_COUNT_EXCLUDED_TYPE)
      .groupBy("submitted_by_user_id")) as {
      submitted_by_user_id: string
      approved_count: string | number
      approved_all: string | number
      rejected_all: string | number
    }[]

    const submissionMap = new Map(
      submissionRows.map((r) => [r.submitted_by_user_id, r])
    )

    // The snapshot is of a full ISO week, so only the week leaderboard
    // compares like with like; other periods carry no delta.
    const prevRankMap: Map<string, number> =
      period === "week"
        ? await strapi
            .plugin("rewards")
            .service("snapshot")
            .getPreviousWeekRankMap()
        : new Map()

    return rows.map((row, i) => {
      const profile = profileMap.get(row.ba_user_id)
      const currentRank = offset + i + 1
      const prevRank = prevRankMap.get(row.ba_user_id)
      const rankChange = prevRank != null ? prevRank - currentRank : null

      // A profile with publicPrefs.showActivity === false is anonymised the
      // same way a private profile is.
      const isPrivate = !!profile && !isActivityPublic(profile)
      const showLocation = profile?.publicPrefs?.showLocation !== false

      const submission = submissionMap.get(row.ba_user_id)
      const approvedCount = Number(submission?.approved_count ?? 0)
      const approvedAll = Number(submission?.approved_all ?? 0)
      const rejectedAll = Number(submission?.rejected_all ?? 0)
      const decided = approvedAll + rejectedAll
      const acceptanceRate =
        decided > 0 ? Math.round((approvedAll / decided) * 100) : null

      return {
        rank: currentRank,
        rankChange,
        username: isPrivate ? null : (profile?.username ?? null),
        firstName: isPrivate ? "Private" : (profile?.firstName ?? null),
        lastName: isPrivate ? "contributor" : (profile?.lastName ?? null),
        avatarUrl: isPrivate ? null : (profile?.avatarUrl ?? null),
        country: isPrivate || !showLocation ? null : (profile?.country ?? null),
        city: isPrivate || !showLocation ? null : (profile?.city ?? null),
        contributorRole: isPrivate ? null : (profile?.contributorRole ?? null),
        periodPoints: Number(row.periodPoints),
        totalPoints: profile?.points ?? 0,
        tier: profile?.tier ?? "Reader",
        approvedCount,
        acceptanceRate,
      }
    })
  },

  async getStanding(
    baUserId: string,
    period: Period = "month"
  ): Promise<Standing> {
    const profile = (await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })) as {
      points: number
      pointsThisMonth: number
      tier: string
      streak: number
      country: string | null
    } | null

    if (!profile) {
      return {
        globalRank: null,
        countryRank: null,
        monthRank: null,
        periodRank: null,
        country: null,
        tier: computeTier(0),
        streak: 0,
        totalPoints: 0,
        pointsThisMonth: 0,
        recentBadges: [],
        suggestedAction:
          "Make your first contribution to start earning points.",
      }
    }

    // Global rank: count users with more points
    const rankResult = (await strapi.db.connection
      .count({ count: "*" })
      .from("user_profiles")
      .where("points", ">", profile.points ?? 0)) as { count: string }[]

    const globalRank = Number(rankResult[0]?.count ?? 0) + 1

    // Recent badges (last 5)
    const recentBadges = (await strapi.db
      .query("plugin::rewards.badge-award")
      .findMany({
        where: { baUserId },
        orderBy: { awardedAt: "desc" },
        limit: 5,
      })) as { badgeId: string; awardedAt: Date }[]

    const tier = computeTier(profile.points ?? 0)

    const suggestedActions: Record<string, string> = {
      Reader:
        "Submit your first library to earn 50 points and reach Indexer tier.",
      Indexer:
        "Verify opening hours on 5 libraries to unlock the Verifier badge.",
      Cartographer: "Submit 3 more libraries to reach Archivist tier.",
      Archivist: "Contribute 10 edits to unlock the Archivist badge.",
      Scholar: "You're close to Curator — keep contributing daily!",
      Curator: "You've reached the top tier. Thank you for your dedication.",
    }

    const countryRank = profile.country
      ? await (this as any).getCountryRank(profile.points ?? 0, profile.country)
      : null

    // The month rank is always wanted (the standing card's default view);
    // a different requested period reuses it instead of a second pair of
    // queries when the period is also "month".
    const monthRank = await rankForPeriod(strapi, baUserId, "month")
    const periodRank =
      period === "month"
        ? monthRank
        : await rankForPeriod(strapi, baUserId, period)

    return {
      globalRank,
      countryRank,
      monthRank,
      periodRank,
      country: profile.country ?? null,
      tier,
      streak: profile.streak ?? 0,
      totalPoints: profile.points ?? 0,
      pointsThisMonth: profile.pointsThisMonth ?? 0,
      recentBadges: recentBadges.map((b) => ({
        badgeId: b.badgeId,
        awardedAt: new Date(b.awardedAt).toISOString(),
      })),
      suggestedAction: suggestedActions[tier.name] ?? "Keep contributing!",
    }
  },

  // Rank within a country for a profile with `points`: callers already hold
  // the profile, so it isn't read again here.
  async getCountryRank(
    points: number,
    country: string
  ): Promise<number | null> {
    if (!country) return null

    const result = (await strapi.db.connection
      .count({ count: "*" })
      .from("user_profiles")
      .where("country", country)
      .where("points", ">", points ?? 0)) as { count: string }[]

    return Number(result[0]?.count ?? 0) + 1
  },
})
