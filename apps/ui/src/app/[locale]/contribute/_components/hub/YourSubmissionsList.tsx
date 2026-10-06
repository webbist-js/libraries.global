import { Icon } from "@iconify/react"
import type React from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { DriveChip } from "@/components/moderation/DriveChip"
import { T } from "@/lib/design-tokens"

export type HubSubmission = {
  documentId: string
  submissionType: string
  status: string
  targetName: string | null
  createdAt: string
  drive: { documentId: string; slug: string; title: string } | null
}

const ACTION_LABEL: Record<string, string> = {
  new_library: "Added a library",
  correction: "Suggested a correction",
  library_edit: "Edited a record",
  library_claim: "Staff verification",
  wiki_edit: "Knowledge article",
  blog_submission: "Journal article",
  topic_suggestion: "Suggested a topic",
  drive_proposal: "Proposed a drive",
}

const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  approved: {
    label: "✓ Accepted",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
  },
  pending: {
    label: "In review",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
  },
  needs_info: { label: "Needs changes", bg: "#F5EEDC", fg: "#6B5420" },
  rejected: {
    label: "Not accepted",
    bg: "var(--tint-special-bg)",
    fg: "var(--tint-special-fg)",
  },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** The white card both halves of the hub's "you" row sit in. */
export const HUB_CARD =
  "flex h-full flex-col rounded-[20px] border border-(--t-border-line) bg-white"

export function CardHeading({
  id,
  children,
}: {
  readonly id: string
  readonly children: React.ReactNode
}) {
  return (
    <h2
      id={id}
      className="m-0"
      style={{
        fontFamily: T.font.serif,
        fontSize: "24px",
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        color: T.ink.base,
      }}
    >
      {children}
    </h2>
  )
}

export function YourSubmissionsList({
  submissions,
  username,
}: {
  readonly submissions: HubSubmission[]
  readonly username?: string | null
}) {
  const inReview = submissions.filter(
    (s) => s.status === "pending" || s.status === "needs_info"
  ).length

  return (
    <section aria-labelledby="your-submissions" className={HUB_CARD}>
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-6 py-5"
        style={{ borderColor: T.border.divider }}
      >
        <div>
          <CardHeading id="your-submissions">Your submissions</CardHeading>
          <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
            {submissions.length === 0
              ? "Your changes and their review status"
              : inReview > 0
                ? `Your latest changes · ${inReview} in review`
                : "Your latest changes"}
          </p>
        </div>
        <GlobalLink
          href={username ? `/profile/${username}` : "/contribute/submissions"}
          className="text-[14px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          {username ? "View on your profile" : "See all submissions"}
        </GlobalLink>
      </div>

      {submissions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: T.bg.muted, color: T.ink.dim }}
          >
            <Icon height={20} icon="mdi:tray-arrow-up" width={20} />
          </span>
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            Nothing submitted yet. Your first change will appear here.
          </p>
          <GlobalLink
            href="#start"
            className="text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Choose something to do
          </GlobalLink>
        </div>
      ) : (
        <ul className="m-0 flex-1 list-none p-0">
          {submissions.map((submission, index) => {
            const chip = STATUS_CHIP[submission.status] ?? STATUS_CHIP.pending!

            return (
              <li
                key={submission.documentId}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-4 sm:grid-cols-[118px_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-6"
                style={
                  index > 0
                    ? { borderTop: `1px solid ${T.border.divider}` }
                    : undefined
                }
              >
                <span
                  className="justify-self-start rounded-full px-3 py-1 text-center text-[13px] font-semibold sm:w-[118px]"
                  style={{ background: chip.bg, color: chip.fg }}
                >
                  {chip.label}
                </span>
                <span className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                  <span
                    className="block text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {ACTION_LABEL[submission.submissionType] ?? "Made a change"}
                  </span>
                  {submission.targetName ? (
                    <span
                      className="block truncate text-[14px]"
                      style={{ color: T.ink.dim }}
                    >
                      {submission.targetName}
                    </span>
                  ) : null}
                  {submission.drive ? (
                    <span className="mt-1 block">
                      <DriveChip drive={submission.drive} />
                    </span>
                  ) : null}
                </span>
                <span
                  className="order-2 text-right text-[14px] sm:order-none"
                  style={{ color: T.ink.low }}
                >
                  {formatDate(submission.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {submissions.length > 0 ? (
        <div
          className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-6 py-4"
          style={{ borderColor: T.border.divider }}
        >
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            {summaryLine(submissions)}
          </p>
          <GlobalLink
            href="/contribute/submissions"
            className="text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Track them in My submissions
          </GlobalLink>
        </div>
      ) : null}
    </section>
  )
}

/** "2 accepted · 1 in review · 1 needs changes", for the card's footer. */
function summaryLine(submissions: HubSubmission[]): string {
  const count = (statuses: string[]) =>
    submissions.filter((s) => statuses.includes(s.status)).length
  const parts = [
    [count(["approved"]), "accepted"],
    [count(["pending"]), "in review"],
    [count(["needs_info"]), "needs changes"],
    [count(["rejected"]), "not accepted"],
  ] as const

  return (
    parts
      .filter(([n]) => n > 0)
      .map(([n, label]) =>
        label === "needs changes" && n > 1
          ? `${n} need changes`
          : `${n} ${label}`
      )
      .join(" · ") || "Your latest changes"
  )
}

export function SignInPromptCard() {
  return (
    <section
      aria-labelledby="hub-sign-in"
      className={`${HUB_CARD} justify-center gap-5 px-8 py-8`}
    >
      <div>
        <CardHeading id="hub-sign-in">
          Every change starts with an account
        </CardHeading>
        <p
          className="mt-2 mb-0 max-w-[56ch] text-[15px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          Create a free account to suggest corrections, add libraries and share
          photos. Every accepted change is credited to you, and you can vote on
          what gets added next.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <GlobalLink
          href="/auth/register"
          className="rounded-full px-6 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
          style={{ background: T.accent.primary }}
        >
          Create a free account
        </GlobalLink>
        <GlobalLink
          href="/auth/signin"
          className="text-[14px] underline underline-offset-[3px]"
          style={{ color: T.ink.dim }}
        >
          Already have an account? Sign in
        </GlobalLink>
      </div>
    </section>
  )
}
