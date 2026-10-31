import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { DiscussionFeed } from "@/components/discussions/DiscussionFeed"
import { DriveDates } from "@/components/drives/DriveDates"
import { DriveFocusChip } from "@/components/drives/DriveFocusChip"
import { DriveFollowButton } from "@/components/drives/DriveFollowButton"
import { DriveHelpers } from "@/components/drives/DriveHelpers"
import { DriveHowToHelp } from "@/components/drives/DriveHowToHelp"
import { DriveProgressSummary } from "@/components/drives/DriveProgressSummary"
import { DriveRules } from "@/components/drives/DriveRules"
import { DriveTaskArea } from "@/components/drives/DriveTaskArea"
import { gapPhraseOf } from "@/components/drives/focus-meta"
import { driveHeroTitle } from "@/components/drives/progress-summary"
import { Notice } from "@/components/ds"
import { BackLink } from "@/components/ds/BackLink"
import type { ContributionPlace } from "@/lib/contribution-place"
import { T } from "@/lib/design-tokens"
import { type DriveView, plainDriveTitle } from "@/lib/drives/drive-view"
import type { Drive, DriveLeaderboardEntry } from "@/lib/drives/types"
import { Link } from "@/lib/navigation"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

import type { CommunityTabCounts } from "./CommunityNavBar"
import { CommunitySectionHeader } from "./CommunitySectionHeader"

const fmt = (n: number) => n.toLocaleString("en-GB")

const CARD = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: "clamp(20px,2.6vw,28px)",
} as const

const CHIP = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"

type ChipLook = { label: string; icon: string; bg: string; fg: string }

const STATUS_LOOK: Record<"pinned" | Drive["status"], ChipLook> = {
  pinned: {
    label: "Pinned drive",
    icon: "mdi:pin-outline",
    bg: T.accent.primary,
    fg: T.bg.deep,
  },
  open: {
    label: "Open drive",
    icon: "mdi:progress-check",
    bg: T.accent.chip,
    fg: T.accent.primaryHover,
  },
  scheduled: {
    label: "Opens soon",
    icon: "mdi:calendar-clock-outline",
    bg: T.bg.muted,
    fg: T.ink.base,
  },
  draft: {
    label: "Opens soon",
    icon: "mdi:calendar-clock-outline",
    bg: T.bg.muted,
    fg: T.ink.base,
  },
  cancelled: {
    label: "Cancelled",
    icon: "mdi:cancel",
    bg: T.bg.muted,
    fg: T.ink.dim,
  },
  closed: {
    label: "Finished",
    icon: "mdi:check-circle-outline",
    bg: "var(--tint-public-bg)",
    fg: T.accent.ok,
  },
}

/** Where the drive is in its life, as a chip: icon plus text. */
function StatusChip({ drive }: { readonly drive: Drive }) {
  const look =
    STATUS_LOOK[
      drive.status === "open" && drive.pinned ? "pinned" : drive.status
    ]

  return (
    <span
      className={`${CHIP} font-bold`}
      style={{ background: look.bg, color: look.fg }}
    >
      <Icon aria-hidden="true" height={14} icon={look.icon} width={14} />
      {look.label}
    </span>
  )
}

/** "3 gaps", "1 helper". */
const count = (n: number, one: string, many: string) =>
  `${fmt(n)} ${n === 1 ? one : many}`

/** A finished drive's tally as a sentence. */
function finalSentence(final: NonNullable<Drive["final"]>): string {
  return `${count(final.closedGaps, "gap", "gaps")} filled by ${count(final.helpers, "helper", "helpers")}, from ${count(final.credits, "accepted task", "accepted tasks")}.`
}

/** The notice at the top of a drive that isn't open: finished, cancelled or scheduled. */
function DriveStateNotice({ drive }: { readonly drive: Drive }) {
  const tUi = useUiTranslations("ui")

  if (drive.status === "closed") {
    const final = drive.final

    return (
      <Notice
        icon="mdi:check-circle-outline"
        tone="ok"
        title={tUi("this_drive_has_finished_thank_you")}
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          {drive.closedReason === "goal"
            ? "It met its goal. "
            : "It reached its end date. "}
          {final ? finalSentence(final) : null}
        </p>
      </Notice>
    )
  }
  if (drive.status === "cancelled") {
    return (
      <Notice
        icon="mdi:cancel"
        tone="warn"
        title={tUi("this_drive_was_cancelled")}
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          Anything already sent for it is still reviewed on its own.
        </p>
      </Notice>
    )
  }
  if (drive.status === "scheduled") {
    return (
      <Notice
        icon="mdi:calendar-clock-outline"
        tone="info"
        title={tUi("this_drive_hasnt_opened_yet")}
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          Its tasks appear here when it opens. The counts above are today’s.
        </p>
      </Notice>
    )
  }

  return null
}

/**
 * A finished drive's link to its Journal story (spec §5.6): the article
 * `storySlug` names, when it exists. The href is built the way
 * `components/blog/JournalCards.tsx` builds every Journal link.
 */
function JournalStoryCard({
  story,
}: {
  readonly story: Pick<BlogArticleSummary, "title" | "slug" | "section">
}) {
  const href = `/journal/${story.section?.slug ?? "general"}/${story.slug}`

  return (
    <section aria-labelledby="drive-story-heading" style={CARD}>
      <h2 id="drive-story-heading" className="type-h2 sr-only">
        Journal story
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-2 text-base font-semibold no-underline"
        style={{ color: T.accent.primary }}
      >
        <Icon
          aria-hidden="true"
          icon="mdi:newspaper-variant-outline"
          width={19}
        />
        Read the story: {story.title}
      </Link>
    </section>
  )
}

/**
 * The shared hero carries metadata and progress. Library tasks lead the body,
 * beside help and the reader's private counts; helpers, rules and connected
 * discussions follow. Finished drives retain their final tally and story,
 * public helpers and the original discussion feed, without accepting tasks.
 */
export function DriveDetailPage({
  drive,
  view,
  week,
  all,
  counts,
  boardActions,
  story,
  initialPlace,
}: {
  readonly drive: Drive
  readonly initialPlace?: ContributionPlace
  readonly view: DriveView | null
  readonly week: readonly DriveLeaderboardEntry[]
  readonly all: readonly DriveLeaderboardEntry[]
  readonly counts?: CommunityTabCounts
  /** The editorial board's controls, at the top of the rail. */
  readonly boardActions?: ReactNode
  /** The Journal article `drive.storySlug` names, when it exists. */
  readonly story?: Pick<BlogArticleSummary, "title" | "slug" | "section"> | null
}) {
  const tUi = useUiTranslations("ui")

  const credited = drive.status === "open" || drive.status === "closed"
  const title = plainDriveTitle(drive.title)
  const progress = view?.progress ?? null
  const helpers = view?.helpers ?? null
  const finished = drive.status === "closed" || drive.status === "cancelled"

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        crumbs={[
          { label: tUi("drives"), href: "/community#drives" },
          { label: title },
        ]}
        title={driveHeroTitle(drive.title)}
        displayTitle
        emphasisTone="ink"
        showEyebrow={false}
        lead={drive.summary}
        counts={counts}
        prelude={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip drive={drive} />
            <DriveFocusChip focus={drive.focus} compact />
            {view?.place ? (
              <span
                className={`${CHIP} font-semibold`}
                style={{ background: T.bg.deep, color: T.ink.base }}
              >
                <Icon aria-hidden icon="mdi:map-marker-outline" width={13} />
                {view.place}
              </span>
            ) : null}
            <DriveDates drive={drive} detail />
          </div>
        }
        footer={
          <section
            aria-labelledby="drive-progress-heading"
            className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) px-6 py-5 sm:px-8"
          >
            <h2 id="drive-progress-heading" className="type-h2 sr-only">
              {finished ? "Final numbers" : tUi("progress")}
            </h2>
            {progress ? (
              <DriveProgressSummary
                progress={progress}
                unit={drive.unit}
                gapPhrase={gapPhraseOf(drive.focus)}
                log={drive.progressLog}
                goalPercent={drive.goalPercent}
                helpers={helpers}
                finished={finished}
              />
            ) : (
              <p className="m-0 text-sm text-(--t-ink-dim)">
                Progress shows once the drive is counted, within the hour.
              </p>
            )}
          </section>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {drive.status !== "draft" ? (
            <DriveFollowButton
              driveDocumentId={drive.documentId}
              driveSlug={drive.slug}
              driveTitle={title}
            />
          ) : null}
        </div>
      </CommunitySectionHeader>

      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-6 pb-20 sm:px-8 sm:pt-8">
        {drive.status !== "open" && (
          <div className="text-sm">
            <BackLink href="/community#drives">{tUi("all_drives")}</BackLink>
          </div>
        )}
        {boardActions}
        <DriveStateNotice drive={drive} />
        {drive.status === "closed" && story ? (
          <JournalStoryCard story={story} />
        ) : null}
        {drive.status === "open" ? (
          <DriveTaskArea
            key={JSON.stringify(initialPlace ?? {})}
            drive={drive}
            initialPlace={initialPlace}
          />
        ) : !finished ? (
          <DriveHowToHelp drive={drive} />
        ) : null}
        <div className="grid items-start gap-5 md:grid-cols-2">
          {credited ? (
            <DriveHelpers
              week={week}
              all={all}
              publicOnly={drive.status === "closed"}
            />
          ) : null}
          <DriveRules
            drive={drive}
            source={view?.source ?? null}
            total={progress?.total ?? null}
          />
        </div>
        <DiscussionFeed
          target={{
            uid: "api::drive.drive",
            documentId: drive.documentId,
            locale: drive.locale,
          }}
          subjectSlug="drives"
          contextType="drives"
        />
      </div>
    </div>
  )
}
