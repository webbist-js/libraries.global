import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import type { LeaderboardEntry } from "@/lib/types/leaderboard"

import { ContributeNavBar } from "../_components/ContributeNavBar"
import { ContributeSubpageHero } from "../_components/ContributeSubpageHero"
import { LeaderboardPodium } from "./_components/LeaderboardPodium"
import { LeaderboardRows } from "./_components/LeaderboardRows"
import { LeaderboardSidebar } from "./_components/LeaderboardSidebar"

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
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
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
      <ContributeSubpageHero
        section="Community"
        heading="The community,"
        headingItalic="in numbers."
        accentColor={T.ink.dim}
        body="Contributors who keep the atlas accurate and growing. Points are earned for every approved contribution."
        minHeight="340px"
      />

      <ContributeNavBar />

      <div className="mx-auto w-full max-w-[1296px] px-6 pt-10 pb-20 md:px-10">
        {/* Period tabs */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "32px",
            borderBottom: `1px solid ${T.border.line}`,
          }}
        >
          {PERIODS.map(({ key, label }) => (
            <a
              key={key}
              href={`/contribute/community?period=${key}`}
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: period === key ? T.accent.aurora : T.ink.faint,
                textDecoration: "none",
                padding: "10px 16px",
                borderBottom:
                  period === key
                    ? `2px solid ${T.accent.aurora}`
                    : "2px solid transparent",
                marginBottom: "-1px",
                transition: "color 150ms",
              }}
            >
              {label}
            </a>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: "32px",
            alignItems: "start",
          }}
        >
          {/* Left: podium + ranked list */}
          <div>
            {entries.length === 0 ? (
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: T.ink.faint,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                No contributions recorded for this period yet.
              </p>
            ) : (
              <>
                <LeaderboardPodium entries={podium} />
                <LeaderboardRows entries={rest} />
              </>
            )}
          </div>

          {/* Right sidebar */}
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
