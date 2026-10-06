import type { Metadata } from "next"
import { headers } from "next/headers"

import { StandingCard } from "@/components/community/StandingCard"
import { TopThisMonthCard } from "@/components/community/TopThisMonthCard"
import { VoteOnAdditionsCard } from "@/components/community/VoteOnAdditionsCard"
import { FinishedDrives } from "@/components/drives/FinishedDrives"
import { isFocusFilterKey } from "@/components/drives/focus-meta"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchDriveGaps } from "@/lib/community/drive-gaps-server"
import {
  fetchLeaderboard,
  fetchStanding,
} from "@/lib/community/leaderboard-server"
import { isVotable } from "@/lib/community/suggestions"
import { fetchPublicSuggestions } from "@/lib/community/suggestions-server"
import { T } from "@/lib/design-tokens"
import {
  howDrivesWorkHref,
  loadDriveViews,
} from "@/lib/drives/drive-view-server"
import { fetchDrives } from "@/lib/drives/drives-server"
import { fetchOwnProfile, type OwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"
import { getInitials } from "@/lib/types/leaderboard"

import { CommunitySectionHeader } from "./_components/CommunitySectionHeader"
import { GapsWorthADrive } from "./_components/GapsWorthADrive"
import { NoDrivesCard } from "./_components/NoDrivesCard"
import { NoticeboardDrives } from "./_components/NoticeboardDrives"

/** "Recently finished" lists this many closed drives. */
const FINISHED_SHOWN = 5

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Community",
    description:
      "Community drives to fill gaps in the index, the contributors behind it, and the additions people are voting for.",
    path: "community",
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

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ focus?: string | string[] }>
}) {
  const [{ locale }, { focus: focusParam }] = await Promise.all([
    params,
    searchParams,
  ])
  const focus = isFocusFilterKey(focusParam) ? focusParam : null
  const session = await getSessionSSR(await headers())
  const user = session?.user ?? null

  const [
    standing,
    profile,
    top,
    suggestions,
    gaps,
    openDrives,
    closedDrives,
    howHref,
  ] = await Promise.all([
    user ? fetchStanding(user.id, "month") : Promise.resolve(null),
    user ? fetchOwnProfile(user) : Promise.resolve(null),
    fetchLeaderboard("month", 3),
    fetchPublicSuggestions(),
    fetchDriveGaps(locale),
    fetchDrives("open", locale),
    fetchDrives("closed", locale, FINISHED_SHOWN),
    howDrivesWorkHref(locale),
  ])
  const votableCount = suggestions.filter(isVotable).length
  const views = await loadDriveViews([...openDrives, ...closedDrives], locale)
  const open = views.slice(0, openDrives.length)
  const finished = views.slice(openDrives.length)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        title="The *noticeboard.*"
        lead="Community drives to fill gaps in the index. Pick one, work through small tasks, and see the whole effort move forward."
        counts={{ noticeboard: open.length, suggestions: votableCount }}
      />

      <div
        className="mx-auto flex w-full max-w-[1360px] flex-wrap items-start"
        style={{
          padding:
            "clamp(28px,3.4vw,44px) clamp(16px,3vw,32px) clamp(56px,7vw,88px)",
          gap: "clamp(16px,2.4vw,28px)",
        }}
      >
        <div
          className="flex min-w-0 flex-col"
          style={{ flex: "2 1 440px", gap: "clamp(24px,3vw,36px)" }}
        >
          {open.length > 0 ? (
            <NoticeboardDrives
              open={open}
              finished={finished}
              focus={focus}
              howHref={howHref}
            />
          ) : (
            <>
              <NoDrivesCard hasGaps={gaps.length > 0} />
              <GapsWorthADrive gaps={gaps} />
              <FinishedDrives views={finished} />
            </>
          )}
        </div>

        <aside
          aria-label="Sidebar"
          className="flex min-w-0 flex-col gap-3.5 min-[760px]:sticky min-[760px]:top-24 min-[760px]:max-w-[440px]"
          style={{ flex: "1 1 290px" }}
        >
          <StandingCard
            standing={standing}
            signedIn={Boolean(user)}
            initials={user ? viewerInitials(profile, user) : ""}
            signInReturnTo="/community"
          />
          <TopThisMonthCard entries={top} />
          <VoteOnAdditionsCard
            initial={suggestions}
            signInReturnTo="/community#vote-on-additions"
          />
        </aside>
      </div>
    </div>
  )
}
