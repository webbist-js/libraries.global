import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { DriveDates } from "@/components/drives/DriveDates"
import { DriveFocusChip } from "@/components/drives/DriveFocusChip"
import { DriveHelpers } from "@/components/drives/DriveHelpers"
import { DriveProgress } from "@/components/drives/DriveProgress"
import { DriveRules } from "@/components/drives/DriveRules"
import { DriveShareButton } from "@/components/drives/DriveShareButton"
import { DriveTaskArea } from "@/components/drives/DriveTaskArea"
import { focusChipOf, gapPhraseOf } from "@/components/drives/focus-meta"
import { Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import {
  type DriveView,
  plainDriveTitle,
  progressMeta,
} from "@/lib/drives/drive-view"
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

const SECTION_HEADING = {
  fontFamily: T.font.serif,
  fontWeight: 500,
  fontSize: "clamp(26px,2.6vw,32px)",
  color: T.ink.base,
} as const

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[14px]"

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
  if (drive.status === "closed") {
    const final = drive.final

    return (
      <Notice
        icon="mdi:check-circle-outline"
        tone="ok"
        title="This drive has finished. Thank you"
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
      <Notice icon="mdi:cancel" tone="warn" title="This drive was cancelled">
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
        title="This drive hasn’t opened yet"
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          Its tasks appear here when it opens. The counts below are today’s.
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
      <h2 id="drive-story-heading" className="sr-only">
        Journal story
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-2 text-[16px] font-semibold no-underline"
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
 * A drive's own page (spec §5.6): the hero (chips, title, summary, dates,
 * share), then progress with its sparkline, "How to help", the task list
 * and panel with "Your part" while it's open, and the helpers and rules in
 * the rail. A finished drive shows its final numbers and only
 * the helpers whose activity is public, and no steps or tasks.
 */
export function DriveDetailPage({
  drive,
  view,
  week,
  all,
  counts,
  boardActions,
  story,
}: {
  readonly drive: Drive
  readonly view: DriveView | null
  readonly week: readonly DriveLeaderboardEntry[]
  readonly all: readonly DriveLeaderboardEntry[]
  readonly counts?: CommunityTabCounts
  /** The editorial board's controls, at the top of the rail. */
  readonly boardActions?: ReactNode
  /** The Journal article `drive.storySlug` names, when it exists. */
  readonly story?: Pick<BlogArticleSummary, "title" | "slug" | "section"> | null
}) {
  const credited = drive.status === "open" || drive.status === "closed"
  const title = plainDriveTitle(drive.title)
  const progress = view?.progress ?? null
  const helpers = view?.helpers ?? null
  const finished = drive.status === "closed" || drive.status === "cancelled"
  const steps = drive.steps?.filter((s) => s.text?.trim()) ?? []

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        crumbs={[
          { label: "Drives", href: "/community#drives" },
          { label: title },
        ]}
        title={drive.title}
        lead={drive.summary}
        counts={counts}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip drive={drive} />
            <DriveFocusChip focus={drive.focus} />
            {view?.place ? (
              <span
                className={`${CHIP} font-semibold`}
                style={{ background: T.bg.deep, color: T.ink.base }}
              >
                {view.place}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <DriveDates drive={drive} size="lg" />
            <DriveShareButton title={title} />
          </div>
        </div>
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
          style={{ flex: "2 1 440px", gap: "clamp(18px,2.4vw,28px)" }}
        >
          <DriveStateNotice drive={drive} />

          <section
            aria-labelledby="drive-progress-heading"
            className="flex flex-col gap-4"
            style={CARD}
          >
            <h2
              id="drive-progress-heading"
              className="m-0"
              style={SECTION_HEADING}
            >
              {finished ? "Final numbers" : "Progress"}
            </h2>
            {progress ? (
              <DriveProgress
                progress={progress}
                unit={drive.unit}
                gapPhrase={gapPhraseOf(drive.focus)}
                log={drive.progressLog}
                goalPercent={drive.goalPercent}
                meta={progressMeta(progress.percent, helpers, finished)}
                color={focusChipOf(drive.focus).tint.fg}
              />
            ) : (
              <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                Progress shows once the drive is counted, within the hour.
              </p>
            )}
          </section>

          {drive.status === "closed" && story ? (
            <JournalStoryCard story={story} />
          ) : null}

          {!finished && steps.length > 0 ? (
            <section
              aria-labelledby="drive-steps-heading"
              className="flex flex-col gap-3.5"
              style={CARD}
            >
              <h2
                id="drive-steps-heading"
                className="m-0"
                style={SECTION_HEADING}
              >
                How to help
              </h2>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {steps.map((step, i) => (
                  <li key={step.id ?? i} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
                      style={{
                        background: T.accent.chip,
                        color: T.accent.primaryHover,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="pt-0.5 text-[16px] leading-[1.5]"
                      style={{ color: T.ink.base }}
                    >
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {drive.status === "open" ? <DriveTaskArea drive={drive} /> : null}
        </div>

        <aside
          aria-label="About this drive"
          className="flex min-w-0 flex-col gap-3.5 min-[760px]:sticky min-[760px]:top-24 min-[760px]:max-w-[440px]"
          style={{ flex: "1 1 290px" }}
        >
          {boardActions}
          {credited ? (
            <DriveHelpers
              week={week}
              all={all}
              publicOnly={drive.status === "closed"}
            />
          ) : null}
          <DriveRules drive={drive} source={view?.source ?? null} />
        </aside>
      </div>
    </div>
  )
}
