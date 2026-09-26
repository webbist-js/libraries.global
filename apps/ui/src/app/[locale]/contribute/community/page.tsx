import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"
import type { LeaderboardEntry } from "@/lib/types/leaderboard"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import { LeaderboardPodium } from "./_components/LeaderboardPodium"
import { LeaderboardRows } from "./_components/LeaderboardRows"
import { LeaderboardSidebar } from "./_components/LeaderboardSidebar"

export const metadata = privateMetadata("Community leaderboard")

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY
const SECRET = process.env.STRAPI_BRIDGE_SECRET

async function fetchProfileUsername(baUserId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=username`,
      {
        cache: "no-store",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { username?: string }[] }

    return json.data?.[0]?.username ?? null
  } catch {
    return null
  }
}

type Period = "today" | "week" | "month" | "all"

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
]

type Standing = {
  globalRank: number | null
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

async function fetchLeaderboard(period: Period): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard?period=${period}&limit=50`,
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

async function fetchStanding(baUserId: string): Promise<Standing | null> {
  if (!SECRET) return null
  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": baUserId,
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Standing }

    return json.data ?? null
  } catch {
    return null
  }
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period: Period = ["today", "week", "month", "all"].includes(
    periodParam ?? ""
  )
    ? (periodParam as Period)
    : "month"

  const session = await getSessionSSR(await headers())

  const [entries, standing, profileUsername] = await Promise.all([
    fetchLeaderboard(period),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
    session?.user
      ? fetchProfileUsername(session.user.id)
      : Promise.resolve(null),
  ])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <ContributeSectionHeader
        section="Community"
        title="The community, *in numbers.*"
        lead="Contributors who keep the atlas accurate and growing. Points are earned for every approved contribution."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8">
        <nav
          aria-label="Leaderboard period"
          className="mb-8 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderBottom: `1px solid ${T.border.line}` }}
        >
          {PERIODS.map(({ key, label }) => {
            const active = period === key

            return (
              <a
                key={key}
                href={`/contribute/community?period=${key}`}
                aria-current={active ? "page" : undefined}
                className="-mb-px whitespace-nowrap"
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "15px",
                  fontWeight: active ? 600 : 500,
                  color: active ? T.ink.base : T.ink.dim,
                  textDecoration: "none",
                  padding: "12px 14px 10px",
                  borderBottom: active
                    ? `3px solid ${T.accent.primary}`
                    : "3px solid transparent",
                  transition: "color 150ms",
                }}
              >
                {label}
              </a>
            )
          })}
        </nav>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="leaderboard-heading" className="min-w-0">
            <h2
              id="leaderboard-heading"
              className="m-0 mb-5"
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(26px,3vw,32px)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: T.ink.base,
              }}
            >
              Top contributors
            </h2>
            {entries.length === 0 ? (
              <div
                className="rounded-[20px] px-6 py-10 text-center"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
                  No contributions recorded for this period yet.
                </p>
              </div>
            ) : (
              <>
                <LeaderboardPodium entries={podium} />
                <LeaderboardRows entries={rest} />
              </>
            )}
          </section>

          <LeaderboardSidebar
            isSignedIn={!!session?.user}
            standing={standing}
            profileUsername={profileUsername}
          />
        </div>
      </div>
    </div>
  )
}
