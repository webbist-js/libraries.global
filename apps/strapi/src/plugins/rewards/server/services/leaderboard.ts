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
  contributorRole: string | null
  periodPoints: number
  totalPoints: number
  tier: string
}

export type Standing = {
  globalRank: number | null
  countryRank: number | null
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
      contributorRole: string | null
      points: number
      tier: string
      profileVisibility?: string
      publicPrefs?: { showLocation?: boolean; showActivity?: boolean } | null
    }[]

    const profileMap = new Map(profiles.map((p) => [p.baUserId, p]))

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

      return {
        rank: currentRank,
        rankChange,
        username: isPrivate ? null : (profile?.username ?? null),
        firstName: isPrivate ? "Private" : (profile?.firstName ?? null),
        lastName: isPrivate ? "contributor" : (profile?.lastName ?? null),
        avatarUrl: isPrivate ? null : (profile?.avatarUrl ?? null),
        country: isPrivate || !showLocation ? null : (profile?.country ?? null),
        contributorRole: isPrivate ? null : (profile?.contributorRole ?? null),
        periodPoints: Number(row.periodPoints),
        totalPoints: profile?.points ?? 0,
        tier: profile?.tier ?? "Reader",
      }
    })
  },

  async getStanding(baUserId: string): Promise<Standing> {
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

    return {
      globalRank,
      countryRank,
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
