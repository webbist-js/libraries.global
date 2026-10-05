import "server-only"

import type { LeaderboardEntry } from "@/lib/types/leaderboard"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

export type LeaderboardPeriod = "today" | "week" | "month" | "all"

export const LEADERBOARD_PERIODS: { key: LeaderboardPeriod; label: string }[] =
  [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "all", label: "All time" },
  ]

/** The period name as it reads in a sentence, e.g. "Top contributors {phrase}". */
export const PERIOD_PHRASE: Record<LeaderboardPeriod, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  all: "ever",
}

/** A `?period=` value, or the default: this month. */
export function parsePeriod(value: string | undefined): LeaderboardPeriod {
  return LEADERBOARD_PERIODS.some((p) => p.key === value)
    ? (value as LeaderboardPeriod)
    : "month"
}

export type Standing = {
  globalRank: number | null
  /** Rank for this calendar month, regardless of the period asked for. */
  monthRank: number | null
  /** Rank for the period asked for (same value as monthRank when period is "month"). */
  periodRank: number | null
  tier: {
    level: number
    name: string
    nextName: string | null
    nextThreshold: number | null
    progressPercent: number
  }
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

/** The top contributors for a period; empty when Strapi can't answer. */
export async function fetchLeaderboard(
  period: LeaderboardPeriod,
  limit = 50
): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard?period=${period}&limit=${limit}`,
      {
        next: { revalidate: 3600 },
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LeaderboardEntry[] }

    return json.data ?? []
  } catch {
    return []
  }
}

/** The signed-in user's tier, streak and rank for `period`, through the bridge. */
export async function fetchStanding(
  baUserId: string,
  period: LeaderboardPeriod = "month"
): Promise<Standing | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/my-standing?period=${period}`,
      {
        cache: "no-store",
        headers: {
          "X-Service-Secret": secret,
          "X-Ba-User-Id": baUserId,
        },
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Standing }

    return json.data ?? null
  } catch {
    return null
  }
}
