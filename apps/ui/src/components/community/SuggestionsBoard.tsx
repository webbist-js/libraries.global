"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import {
  LIST_LABELS,
  LIST_ORDER,
  type PublicSuggestion,
  sortSuggestions,
  type SuggestionList,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

import { AlreadyInLists } from "./AlreadyInLists"
import { SuggestionCard, votesText } from "./SuggestionCard"

export type BoardFilter = SuggestionList | "all"
type SortMode = "top" | "new"

const FILTERS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...LIST_ORDER.map((id) => ({ id, label: LIST_LABELS[id] })),
]

const SIGN_IN_HREF = `/auth/signin?callbackUrl=${encodeURIComponent("/community/suggestions")}`

/** The suggestions the board lists under a filter: every status but accepted. */
export function boardSuggestions(
  items: readonly PublicSuggestion[],
  filter: BoardFilter
): PublicSuggestion[] {
  return items.filter(
    (s) =>
      s.status !== "accepted" && (filter === "all" || s.optionKey === filter)
  )
}

const suggestionsText = (n: number) =>
  `${n} ${n === 1 ? "suggestion" : "suggestions"}`

function EmptyBoard({ filter }: { readonly filter: BoardFilter }) {
  return (
    <div
      className="flex flex-col gap-3"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 28,
        padding: "clamp(22px,3vw,32px)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-[52px] items-center justify-center rounded-full"
        style={{ background: T.accent.chip, color: T.accent.primary }}
      >
        <Icon height={24} icon="mdi:thumb-up-outline" width={24} />
      </span>
      <h3
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: "clamp(28px,3vw,38px)",
          lineHeight: 1.1,
          color: T.ink.base,
        }}
      >
        {filter === "all"
          ? "Nothing to vote on yet"
          : `No ${LIST_LABELS[filter].toLowerCase()} suggestions yet`}
      </h3>
      <p
        className="m-0 max-w-[60ch] text-[17px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Is there a feature or service you’ve looked for and couldn’t tick?
        Suggest it with the form. Once others vote, it shows here.
      </p>
    </div>
  )
}

/**
 * The Suggestions board's main column: filter by list, sort by votes or
 * age, the suggestion cards (accepted ones live under "Recently added"),
 * and the options already in the lists. The list and the filter belong to
 * `SuggestionsWorkspace`, so the form can add to them.
 */
export function SuggestionsBoard({
  items,
  filter,
  onFilterChange,
  onVote,
  busyId,
  error,
  signedIn,
  optionNames,
  now,
}: {
  readonly items: readonly PublicSuggestion[]
  readonly filter: BoardFilter
  readonly onFilterChange: (filter: BoardFilter) => void
  readonly onVote: (
    s: PublicSuggestion
  ) => Promise<{ voted: boolean; votes: number } | null>
  readonly busyId: string | null
  readonly error: string | null
  readonly signedIn: boolean
  readonly optionNames: Record<SuggestionList, string[]>
  readonly now: Date
}) {
  const [sort, setSort] = useState<SortMode>("top")
  const [announcement, setAnnouncement] = useState("")
  const shown = sortSuggestions(boardSuggestions(items, filter), sort)

  const pickFilter = (next: BoardFilter) => {
    onFilterChange(next)
    setAnnouncement(`${suggestionsText(boardSuggestions(items, next).length)}.`)
  }

  const handleVote = async (s: PublicSuggestion) => {
    const result = await onVote(s)
    if (result)
      setAnnouncement(
        `${result.voted ? "Vote added for" : "Vote removed from"} ${s.name}. ${votesText(result.votes)}.`
      )
  }

  return (
    <>
      <h2 className="sr-only">Suggestions</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by list"
          className="flex flex-wrap gap-1.5"
        >
          {FILTERS.map((f) => {
            const on = filter === f.id

            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => pickFilter(f.id)}
                className="min-h-11 cursor-pointer rounded-full px-4 text-[15px] font-semibold transition-colors hover:border-(--t-accent-primary)"
                style={{
                  border: `1px solid ${on ? T.accent.primary : T.border.hi}`,
                  background: on ? T.accent.chip : T.bg.deep,
                  color: on ? T.accent.primaryHover : T.ink.base,
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <label
          className="flex items-center gap-2 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="h-11 cursor-pointer px-2.5 text-[15px] font-medium"
            style={{
              border: `1px solid ${T.border.hi}`,
              borderRadius: 12,
              background: T.bg.deep,
              color: T.ink.base,
            }}
          >
            <option value="top">Most votes</option>
            <option value="new">Newest</option>
          </select>
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="m-0 text-[15px] font-semibold"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyBoard filter={filter} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {shown.map((s) => (
            <SuggestionCard
              key={s.documentId}
              suggestion={s}
              signedIn={signedIn}
              busy={busyId === s.documentId}
              onVote={(x) => void handleVote(x)}
              signInHref={SIGN_IN_HREF}
              now={now}
            />
          ))}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <AlreadyInLists optionNames={optionNames} filter={filter} />
    </>
  )
}
