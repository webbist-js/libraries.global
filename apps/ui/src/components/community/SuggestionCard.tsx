"use client"

import { Icon } from "@iconify/react"
import type { CSSProperties } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  isVotable,
  LIST_LABELS,
  type PublicSuggestion,
  relativeAge,
  STATUS_META,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

export const votesText = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`

const BOX =
  "flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2.5 tabular-nums transition-colors"

function boxStyle(voted: boolean, locked: boolean): CSSProperties {
  if (voted)
    return {
      border: `2px solid ${T.accent.primary}`,
      background: T.accent.chip,
      color: T.accent.primaryHover,
    }
  if (locked)
    return {
      border: `1px solid ${T.border.hi}`,
      background: T.bg.muted,
      color: T.ink.dim,
      cursor: "not-allowed",
    }

  return {
    border: `1px solid ${T.border.hi}`,
    background: T.bg.deep,
    color: T.ink.base,
  }
}

function BoxContent({ votes }: { readonly votes: number }) {
  return (
    <>
      <Icon aria-hidden="true" height={18} icon="mdi:chevron-up" width={18} />
      <span className="text-[18px] leading-tight font-bold">{votes}</span>
      <span className="text-[12px] font-semibold">
        {votes === 1 ? "vote" : "votes"}
      </span>
    </>
  )
}

function voteLabel(s: PublicSuggestion, locked: boolean): string {
  if (locked) return `Voting closed for ${s.name}, ${votesText(s.votes)}`

  return `${s.voted ? "Remove your vote for" : "Vote for"} ${s.name}, ${votesText(s.votes)}`
}

function Summary({ s }: { readonly s: PublicSuggestion }) {
  let text: string | null = s.description
  if (!text && s.libraryCount > 0)
    text = `Asked for in corrections to ${s.libraryCount} ${s.libraryCount === 1 ? "library" : "libraries"}.`
  if (!text) return null

  return (
    <p className="m-0 text-[16px] leading-[1.55]" style={{ color: T.ink.base }}>
      {text}
    </p>
  )
}

/**
 * One Option Suggestion on the Suggestions board: the vote box, the name
 * with its status chip, the description (or how many corrections asked for
 * it), the editorial board's note, and who suggested it and when. Votes
 * lock once the board declines a suggestion; signed out, the vote box
 * links to sign in.
 */
export function SuggestionCard({
  suggestion: s,
  signedIn,
  busy,
  onVote,
  signInHref,
  now,
}: {
  readonly suggestion: PublicSuggestion
  readonly signedIn: boolean
  /** True while this suggestion's vote is saving. */
  readonly busy: boolean
  readonly onVote: (s: PublicSuggestion) => void
  readonly signInHref: string
  /** "Now" for the relative age, so the server and client render alike. */
  readonly now: Date
}) {
  const status = STATUS_META[s.status]
  const locked = !isVotable(s)
  const voted = Boolean(s.voted)
  const meta = [
    LIST_LABELS[s.optionKey] ?? s.optionKey,
    s.suggestedByName ? `Suggested by ${s.suggestedByName}` : null,
    relativeAge(s.createdAt, now),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <li
      className="flex items-start gap-4"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 22,
        padding: "16px 18px",
      }}
    >
      {signedIn || locked ? (
        <button
          type="button"
          aria-pressed={voted}
          aria-label={voteLabel(s, locked)}
          disabled={locked || busy}
          onClick={() => onVote(s)}
          className={`${BOX} ${locked ? "" : "cursor-pointer hover:border-(--t-accent-primary) disabled:cursor-wait disabled:opacity-60"}`}
          style={boxStyle(voted, locked)}
        >
          <BoxContent votes={s.votes} />
        </button>
      ) : (
        <GlobalLink
          href={signInHref}
          aria-label={`Sign in to vote for ${s.name}, ${votesText(s.votes)}`}
          className={`${BOX} no-underline hover:border-(--t-accent-primary)`}
          style={boxStyle(false, false)}
        >
          <BoxContent votes={s.votes} />
        </GlobalLink>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: 24,
              lineHeight: 1.15,
              color: T.ink.base,
            }}
          >
            {s.name}
          </h3>
          {status ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-bold"
              style={{
                background: status.bg,
                color: status.fg,
                padding: "3px 10px",
              }}
            >
              <Icon
                aria-hidden="true"
                height={13}
                icon={status.icon}
                width={13}
              />
              {status.label}
            </span>
          ) : null}
        </div>

        <Summary s={s} />

        {s.decisionNote ? (
          <p
            className="m-0 text-[15px] leading-normal"
            style={{
              color: T.ink.dim,
              background: T.bg.surface,
              border: `1px solid ${T.border.divider}`,
              borderRadius: 12,
              padding: "8px 12px",
            }}
          >
            <strong style={{ color: T.ink.base }}>Board note:</strong>{" "}
            {s.decisionNote}
          </p>
        ) : null}

        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          {meta}
        </p>
      </div>
    </li>
  )
}
