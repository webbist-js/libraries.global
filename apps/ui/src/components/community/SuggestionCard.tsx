"use client"

import { Icon } from "@iconify/react"
import { useFormatter, useTranslations } from "next-intl"
import { useState, type CSSProperties } from "react"

import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import GlobalLink from "@/components/global/GlobalLink"
import { LibraryFeatureDetails } from "@/components/library/LibraryFeatureDetails"
import {
  isVotable,
  LIST_TINTS,
  type PublicSuggestion,
  type OptionCatalogue,
  STATUS_META,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

import { SuggestionConversation } from "./SuggestionConversation"

export const votesText = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`

const BOX =
  "flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2.5 tabular-nums transition-colors"

function boxStyle(voted: boolean, locked: boolean): CSSProperties {
  if (voted)
    return {
      border: `2px solid ${T.accent.primary}`,
      background: T.action.primary,
      color: "white",
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

function BoxContent({
  votes,
  voted,
}: {
  readonly votes: number
  readonly voted: boolean
}) {
  const t = useTranslations("optionSuggestions")

  return (
    <>
      <Icon aria-hidden="true" height={18} icon="mdi:chevron-up" width={18} />
      <span className="font-sans text-[28px] leading-tight">{votes}</span>{" "}
      <span className="text-xs font-bold uppercase">
        {t(voted ? "voteBoxVoted" : "voteBoxVote")}
      </span>
    </>
  )
}

function voteLabel(s: PublicSuggestion, locked: boolean): string {
  if (locked) return `Voting closed for ${s.name}, ${votesText(s.votes)}`

  return `${s.voted ? "Remove your vote for" : "Vote for"} ${s.name}, ${votesText(s.votes)}`
}

function Summary({ s }: { readonly s: PublicSuggestion }) {
  const t = useTranslations("optionSuggestions")
  let text: string | null = s.description
  if (!text && s.libraryCount > 0)
    text = t("requestedLibraries", { count: s.libraryCount })
  if (!text) return null

  return (
    <p className="m-0 text-base leading-[1.55]" style={{ color: T.ink.dim }}>
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
  shortlistRank,
  frozen,
  optionCatalogue,
  initiallyExpanded = false,
}: {
  readonly suggestion: PublicSuggestion
  readonly signedIn: boolean
  /** True while this suggestion's vote is saving. */
  readonly busy: boolean
  readonly onVote: (s: PublicSuggestion) => void
  readonly signInHref: string
  /** "Now" for the relative age, so the server and client render alike. */
  readonly shortlistRank?: number
  readonly frozen?: boolean
  readonly optionCatalogue?: OptionCatalogue
  readonly now: Date
  readonly initiallyExpanded?: boolean
}) {
  const t = useTranslations("optionSuggestions")
  const formatter = useFormatter()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [mounted, setMounted] = useState(initiallyExpanded)
  const toggleConversation = () => {
    setMounted(true)
    setExpanded((value) => !value)
  }
  const panelId = `suggestion-conversation-${s.documentId}`
  const similar = s.comparison
    ? optionCatalogue?.[s.optionKey].find(
        (o) => o.documentId === s.comparison?.documentId
      )
    : undefined
  const status = STATUS_META[s.status]
  const locked = Boolean(frozen) || !isVotable(s)
  const voted = Boolean(s.voted)

  return (
    <article
      id={`suggestion-${s.documentId}`}
      className="overflow-hidden"
      style={{
        background: T.bg.deep,
        border: `1px solid ${shortlistRank || expanded ? "var(--t-palette-violet-bg)" : T.border.line}`,
        borderRadius: 22,
      }}
    >
      <div className="flex items-start gap-4 p-5 sm:p-6">
        {signedIn || locked ? (
          <button
            type="button"
            aria-pressed={voted}
            aria-label={`${s.votes} ${t(voted ? "voteBoxVoted" : "voteBoxVote")}: ${voteLabel(s, locked)}`}
            disabled={locked || busy}
            onClick={() => onVote(s)}
            className={`${BOX} ${locked ? "" : "cursor-pointer hover:border-(--t-accent-primary) disabled:cursor-wait disabled:opacity-60"}`}
            style={boxStyle(voted, locked)}
          >
            <BoxContent votes={s.votes} voted={voted} />
          </button>
        ) : (
          <GlobalLink
            href={signInHref}
            aria-label={`${s.votes} ${t("voteBoxVote")}: Sign in to vote for ${s.name}, ${votesText(s.votes)}`}
            className={`${BOX} no-underline hover:border-(--t-accent-primary)`}
            style={boxStyle(false, false)}
          >
            <BoxContent votes={s.votes} voted={false} />
          </GlobalLink>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="type-card-title m-0"
              style={{
                color: T.ink.base,
              }}
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={toggleConversation}
                className="cursor-pointer text-left hover:underline"
              >
                {s.name}
              </button>
            </h3>
            {status ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full text-sm font-bold"
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
                {t(`statuses.${s.status}`)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className="rounded-full px-2 py-1"
              style={{
                background: LIST_TINTS[s.optionKey].bg,
                color: LIST_TINTS[s.optionKey].fg,
              }}
            >
              {t(`lists.${s.optionKey}`)}
            </span>
            {shortlistRank && (
              <span className="rounded-full bg-(--t-bg-inverse) px-2 py-1 text-(--t-ink-inverse)">
                {t(frozen ? "savedRank" : "provisionalRank", {
                  rank: shortlistRank,
                })}
              </span>
            )}
            {now.getTime() - Date.parse(s.createdAt) < 7 * 86400000 && (
              <span className="rounded-full bg-(--t-palette-amber-soft) px-2 py-1">
                {t("newWeek")}
              </span>
            )}
          </div>
          <Summary s={s} />

          {s.decisionNote ? (
            <p
              className="m-0 text-base leading-normal"
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

          <div
            className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm"
            style={{ color: T.ink.dim }}
          >
            <p className="m-0 inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {t("suggestedBy")}{" "}
              {s.suggestedByProfile ? (
                <GlobalLink
                  href={`/profile/${encodeURIComponent(s.suggestedByProfile)}`}
                  className="font-semibold text-(--t-ink-base) hover:underline"
                >
                  {s.suggestedByName}
                </GlobalLink>
              ) : (
                <strong className="text-(--t-ink-base)">
                  {s.suggestedByName ?? t("communityMember")}
                </strong>
              )}
              <AuthorBadges badges={s.suggestedByBadges} />
              {" · "}
              {formatter.relativeTime(new Date(s.createdAt), now)}
            </p>
            {s.comparison && (
              <details className="text-sm">
                <summary className="cursor-pointer">
                  {t("notSameAs")}{" "}
                  <strong className="text-(--t-ink-base)">
                    {similar?.name ?? s.comparison.name}
                  </strong>
                </summary>
                <p className="text-(--t-ink-dim)">{s.comparison.explanation}</p>
                {similar && (
                  <LibraryFeatureDetails
                    name={similar.name}
                    summary={similar.summary}
                    description={similar.description}
                    detailCategory={similar.category}
                  />
                )}
              </details>
            )}
          </div>
        </div>
      </div>
      <SuggestionConversation
        suggestion={s}
        expanded={expanded}
        mounted={mounted}
        panelId={panelId}
        onToggle={toggleConversation}
      />
    </article>
  )
}
