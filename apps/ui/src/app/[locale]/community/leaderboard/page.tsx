import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { PointsTableCard } from "@/components/community/PointsTableCard"
import { StandingCard } from "@/components/community/StandingCard"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
import {
  fetchLeaderboard,
  fetchStanding,
  parsePeriod,
  PERIOD_PHRASE,
} from "@/lib/community/leaderboard-server"
import { isVotable } from "@/lib/community/suggestions"
import { fetchPublicSuggestions } from "@/lib/community/suggestions-server"
import { T } from "@/lib/design-tokens"
import { openDriveCount } from "@/lib/drives/drive-view-server"
import { fetchOwnProfile, type OwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"
import { getInitials } from "@/lib/types/leaderboard"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"
import { LeaderboardPeriodNav } from "./_components/LeaderboardPeriodNav"
import { LeaderboardPodium } from "./_components/LeaderboardPodium"
import { LeaderboardRows } from "./_components/LeaderboardRows"
import { ViewerRankCard } from "./_components/ViewerRankCard"

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

/** The viewer's initials: from their profile, else their account name. */
function viewerInitials(
  profile: OwnProfile | null,
  user: { name?: string | null; email: string }
): string {
  if (profile) return getInitials(profile)
  const words = (user.name || user.email).trim().split(/\s+/)

  return getInitials({
    firstName: words[0] ?? null,
    lastName: words.length > 1 ? (words.at(-1) ?? null) : null,
    username: null,
  })
}

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, { period: periodParam }] = await Promise.all([
    params,
    searchParams,
  ])
  const period = parsePeriod(periodParam)
  const periodPhrase = PERIOD_PHRASE[period]

  const session = await getSessionSSR(await headers())
  const user = session?.user ?? null

  const [entries, standing, profile, suggestions, openDrives] =
    await Promise.all([
      fetchLeaderboard(period),
      user ? fetchStanding(user.id, period) : Promise.resolve(null),
      user ? fetchOwnProfile(user) : Promise.resolve(null),
      fetchPublicSuggestions(),
      openDriveCount(locale),
    ])
  const votableCount = suggestions.filter(isVotable).length
  const initials = user ? viewerInitials(profile, user) : ""

  const periodRank = standing?.periodRank ?? null
  // Signed in but not on the board: unranked, or ranked below the rows shown.
  const showViewerRank =
    standing != null && (periodRank == null || periodRank > entries.length)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section={tUi("leaderboard")}
        title="The community, *in numbers.*"
        lead="The people keeping the atlas accurate and growing. Points are earned only for approved contributions."
        counts={{ noticeboard: openDrives, suggestions: votableCount }}
      />

      <div
        className="mx-auto flex w-full max-w-[1360px] flex-wrap items-start"
        style={{
          padding:
            "clamp(28px,3.4vw,44px) clamp(16px,3vw,32px) clamp(56px,7vw,88px)",
          gap: "clamp(16px,2.4vw,28px)",
        }}
      >
        <section
          aria-labelledby="leaderboard-heading"
          className="flex min-w-0 flex-col"
          style={{ flex: "2 1 440px", gap: "clamp(24px,3vw,36px)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-[12px]">
            <h2
              id="leaderboard-heading"
              className="m-0"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                fontSize: "clamp(30px,3.2vw,42px)",
                lineHeight: 1.1,
                color: T.ink.base,
              }}
            >
              Top contributors
            </h2>
            <LeaderboardPeriodNav period={period} />
          </div>

          <LeaderboardPodium entries={entries} periodPhrase={periodPhrase} />
          <LeaderboardRows entries={entries.slice(3)} youRank={periodRank} />

          {showViewerRank ? (
            <ViewerRankCard
              initials={initials}
              rank={periodRank}
              periodPhrase={periodPhrase}
            />
          ) : null}

          <p
            className="m-0 text-[14px] leading-normal"
            style={{ marginTop: -12, color: T.ink.dim }}
          >
            Points only come from approved changes. Acceptance rate is shown so
            careful work counts as much as volume.
          </p>
        </section>

        <aside
          aria-label={tUi("sidebar")}
          className="flex min-w-0 flex-col gap-3.5 min-[760px]:sticky min-[760px]:top-(--sticky-content-top) min-[760px]:max-h-(--sticky-content-max-height) min-[760px]:max-w-[440px] min-[760px]:overflow-y-auto min-[760px]:overscroll-contain"
          style={{ flex: "1 1 290px" }}
        >
          <StandingCard
            standing={standing}
            signedIn={Boolean(user)}
            initials={initials}
            avatarUrl={avatarSrc(profile?.avatar)}
            background={profile?.profileBackground}
            signInReturnTo="/community/leaderboard"
          />
          <PointsTableCard />
        </aside>
      </div>
    </div>
  )
}
