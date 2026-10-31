import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { TopThisMonthCard } from "@/components/community/TopThisMonthCard"
import { VoteOnAdditionsCard } from "@/components/community/VoteOnAdditionsCard"
import { DiscussionFeed } from "@/components/discussions/DiscussionFeed"
import { FinishedDrives } from "@/components/drives/FinishedDrives"
import { isFocusFilterKey } from "@/components/drives/focus-meta"
import { hasCapability } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchDriveGaps } from "@/lib/community/drive-gaps-server"
import { fetchLeaderboard } from "@/lib/community/leaderboard-server"
import { isVotable } from "@/lib/community/suggestions"
import { fetchPublicSuggestions } from "@/lib/community/suggestions-server"
import { T } from "@/lib/design-tokens"
import { followedRegionSlugs } from "@/lib/drives/drive-view"
import {
  drivesInPlaces,
  howDrivesWorkHref,
  loadDriveViews,
} from "@/lib/drives/drive-view-server"
import { fetchDrives } from "@/lib/drives/drives-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "./_components/CommunitySectionHeader"
import { GapsWorthADrive } from "./_components/GapsWorthADrive"
import { NoDrivesCard } from "./_components/NoDrivesCard"
import { NoticeboardDrives } from "./_components/NoticeboardDrives"
import { NoticeboardHeroActions } from "./_components/NoticeboardHeroActions"
import { ProposeBand } from "./_components/ProposeBand"

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

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ focus?: string | string[] }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, { focus: focusParam }] = await Promise.all([
    params,
    searchParams,
  ])
  const focus = isFocusFilterKey(focusParam) ? focusParam : null
  const session = await getSessionSSR(await headers())
  const user = session?.user ?? null

  const [profile, top, suggestions, gaps, openDrives, closedDrives, howHref] =
    await Promise.all([
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
  const board = hasCapability(user, "drives.manage")
  const signedIn = Boolean(user)
  const followed = user
    ? [
        ...(await drivesInPlaces(
          openDrives,
          followedRegionSlugs(profile?.followedLibraries),
          locale
        )),
      ]
    : null
  // Summed per drive: someone helping two drives counts in both.
  const helping = open.reduce((n, v) => n + (v.helpers ?? 0), 0)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        title="Our *community.*"
        lead="Community drives to fill gaps in the index. Pick one, work through small tasks, and see the whole effort move forward."
        counts={{ noticeboard: open.length, suggestions: votableCount }}
      >
        <NoticeboardHeroActions
          board={board}
          signedIn={signedIn}
          openCount={open.length}
          helping={helping}
        />
      </CommunitySectionHeader>

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
              followed={followed}
            />
          ) : (
            <>
              <NoDrivesCard hasGaps={gaps.length > 0} />
              <GapsWorthADrive gaps={gaps} />
              <FinishedDrives views={finished} />
            </>
          )}
          <ProposeBand board={board} signedIn={signedIn} howHref={howHref} />
        </div>

        <aside
          aria-label={tUi("sidebar")}
          className="flex min-w-0 flex-col gap-3.5 min-[760px]:max-w-[440px]"
          style={{ flex: "1 1 290px" }}
        >
          <DiscussionFeed contextType="drives" activeOnly compact />
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
