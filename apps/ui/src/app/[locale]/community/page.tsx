import { Icon } from "@iconify/react"
import type { Metadata } from "next"

import { SuggestedAdditions } from "@/components/community/SuggestedAdditions"
import GlobalLink from "@/components/global/GlobalLink"
import { fetchLeaderboard } from "@/lib/community/leaderboard-server"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "./_components/CommunitySectionHeader"
import { LeaderboardRows } from "./leaderboard/_components/LeaderboardRows"

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

const CARD = "rounded-[20px] border bg-white"

export default async function CommunityPage() {
  const top = await fetchLeaderboard("month", 5)

  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        title="The *noticeboard.*"
        lead="Community drives to fill gaps in the index. Pick one, work through small tasks, and see the whole effort move forward."
      />

      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 pt-8 pb-16 sm:px-8">
        {/* Replaced by the drive lists when drives ship (D1). */}
        <section
          id="drives"
          aria-labelledby="drives-heading"
          className={`${CARD} flex flex-col gap-3 px-6 py-8 sm:px-8`}
          style={{ borderColor: T.border.line }}
        >
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full"
            style={{ background: T.accent.chip, color: T.accent.primary }}
          >
            <Icon icon="mdi:pin-outline" width={20} height={20} />
          </span>
          <h2
            id="drives-heading"
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(24px,2.6vw,30px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            No drives are open yet
          </h2>
          <p
            className="m-0 max-w-[640px] text-[16px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            A drive is a short, shared effort to fill one kind of gap, such as
            opening hours for a county&apos;s libraries or photos of a
            city&apos;s branches. Until the first one opens, you can improve any
            record from the Index editor.
          </p>
          <GlobalLink
            href="/contribute/index"
            className="mt-1 inline-flex h-10 items-center self-start rounded-full bg-(--t-accent-primary) px-4 text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
          >
            Improve a record
          </GlobalLink>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="top-contributors"
            className={`${CARD} flex flex-col`}
            style={{ borderColor: T.border.line }}
          >
            <div
              className="flex items-baseline justify-between gap-4 border-b px-5 py-5"
              style={{ borderColor: T.border.divider }}
            >
              <h2
                id="top-contributors"
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "24px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Top contributors this month
              </h2>
              <GlobalLink
                href="/community/leaderboard"
                className="text-[14px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Full leaderboard
              </GlobalLink>
            </div>
            {top.length === 0 ? (
              <p
                className="m-0 px-5 py-6 text-[15px]"
                style={{ color: T.ink.dim }}
              >
                No contributions recorded this month yet.
              </p>
            ) : (
              <div className="px-2 py-2">
                <LeaderboardRows entries={top} />
              </div>
            )}
          </section>

          <SuggestedAdditions signInReturnTo="/community#suggested-additions" />
        </div>
      </div>
    </div>
  )
}
