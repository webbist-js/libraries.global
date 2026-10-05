import type { Metadata } from "next"
import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import {
  fetchLeaderboard,
  fetchStanding,
  LEADERBOARD_PERIODS,
  parsePeriod,
} from "@/lib/community/leaderboard-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"
import { LeaderboardPodium } from "./_components/LeaderboardPodium"
import { LeaderboardRows } from "./_components/LeaderboardRows"
import { LeaderboardSidebar } from "./_components/LeaderboardSidebar"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Leaderboard",
    description:
      "The contributors who keep the atlas accurate and growing, ranked by points for approved changes.",
    path: "community/leaderboard",
    locale,
  })
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period = parsePeriod(periodParam)

  const session = await getSessionSSR(await headers())

  const [entries, standing, profileUsername] = await Promise.all([
    fetchLeaderboard(period),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
    session?.user
      ? fetchOwnProfile(session.user).then((p) => p?.username ?? null)
      : Promise.resolve(null),
  ])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section="Leaderboard"
        title="The community, *in numbers.*"
        lead="Contributors who keep the atlas accurate and growing. Points are earned for every approved contribution."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8">
        <nav
          aria-label="Leaderboard period"
          className="mb-8 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderBottom: `1px solid ${T.border.line}` }}
        >
          {LEADERBOARD_PERIODS.map(({ key, label }) => {
            const active = period === key

            return (
              <a
                key={key}
                href={`/community/leaderboard?period=${key}`}
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
