"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  isVotable,
  LIST_LABELS,
  type PublicSuggestion,
  sortSuggestions,
  STATUS_META,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

import { useSuggestions } from "./useSuggestions"

const SHOWN = 3

const votesText = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`

const BOX =
  "flex h-11 w-12 shrink-0 items-center justify-center gap-0.5 rounded-xl text-[15px] font-bold tabular-nums"

function boxStyle(voted: boolean) {
  return voted
    ? {
        border: `2px solid ${T.accent.primary}`,
        background: T.accent.chip,
        color: T.accent.primaryHover,
      }
    : {
        border: `1px solid ${T.border.hi}`,
        background: T.bg.deep,
        color: T.ink.base,
      }
}

function Chevron() {
  return (
    <Icon aria-hidden="true" height={16} icon="mdi:chevron-up" width={16} />
  )
}

/**
 * The three most-voted Option Suggestions still open to votes, for the
 * Noticeboard rail and the Contribute hub. Signed-in viewers vote in place;
 * signed out, each vote box links to sign in.
 */
export function VoteOnAdditionsCard({
  initial,
  signInReturnTo,
}: {
  /** Server-rendered suggestions; refetched with the viewer's votes. */
  readonly initial: PublicSuggestion[]
  /** Where a signed-out voter comes back to after signing in. */
  readonly signInReturnTo: string
}) {
  const { items, vote, busyId, error, signedIn, ready } =
    useSuggestions(initial)
  const [announcement, setAnnouncement] = useState("")
  const top = sortSuggestions(items.filter(isVotable), "top").slice(0, SHOWN)
  const signIn = `/auth/signin?callbackUrl=${encodeURIComponent(signInReturnTo)}`

  const onVote = async (s: PublicSuggestion) => {
    const result = await vote(s)
    if (result)
      setAnnouncement(
        `${result.voted ? "Vote added for" : "Vote removed from"} ${s.name}. ${votesText(result.votes)}.`
      )
  }

  return (
    <section
      aria-labelledby="vote-on-additions"
      className="flex flex-col gap-1.5"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="vote-on-additions"
          className="m-0 text-[17px] font-bold"
          style={{ color: T.ink.base }}
        >
          Vote on additions
        </h2>
        <GlobalLink
          href="/community/suggestions"
          className="text-[15px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          All suggestions
        </GlobalLink>
      </div>

      {error ? (
        <p
          role="alert"
          className="m-0 mt-1 text-[14px] font-semibold"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}

      {top.length === 0 ? (
        <p
          className="m-0 mt-1 text-[15px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          Nothing to vote on yet.{" "}
          <GlobalLink
            href="/community/suggestions#suggest-option"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Suggest an option the lists are missing.
          </GlobalLink>
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {top.map((s) => {
            const voted = Boolean(s.voted)
            const label = `${voted ? "Remove your vote for" : "Vote for"} ${s.name}, ${votesText(s.votes)}`

            return (
              <li
                key={s.documentId}
                className="flex items-center gap-3"
                style={{
                  borderTop: `1px solid ${T.border.divider}`,
                  padding: "9px 0",
                }}
              >
                {!ready ? (
                  <span className={BOX} style={boxStyle(false)}>
                    <Chevron />
                    {s.votes}
                    <span className="sr-only">
                      {s.votes === 1 ? " vote" : " votes"}
                    </span>
                  </span>
                ) : signedIn ? (
                  <button
                    type="button"
                    aria-pressed={voted}
                    aria-label={label}
                    disabled={busyId === s.documentId}
                    onClick={() => void onVote(s)}
                    className={`${BOX} cursor-pointer transition-colors hover:border-(--t-accent-primary) disabled:cursor-wait disabled:opacity-60`}
                    style={boxStyle(voted)}
                  >
                    <Chevron />
                    {s.votes}
                  </button>
                ) : (
                  <GlobalLink
                    href={signIn}
                    aria-label={`Sign in to vote for ${s.name}, ${votesText(s.votes)}`}
                    className={`${BOX} no-underline transition-colors hover:border-(--t-accent-primary)`}
                    style={boxStyle(false)}
                  >
                    <Chevron />
                    {s.votes}
                  </GlobalLink>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {s.name}
                  </span>
                  <span className="text-[13px]" style={{ color: T.ink.dim }}>
                    {LIST_LABELS[s.optionKey] ?? s.optionKey} ·{" "}
                    {STATUS_META[s.status]?.label ?? s.status}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  )
}
