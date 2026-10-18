"use client"

import { useFormatter, useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { EmptyState } from "@/components/ds/EmptyState"
import { SelectField } from "@/components/ds/SelectField"
import {
  LIST_LABELS,
  LIST_ORDER,
  LIST_TINTS,
  type OptionCatalogue,
  type PublicSuggestion,
  sortSuggestions,
  type SuggestionList,
  type SuggestionReviewRound,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

import { SuggestionCard, votesText } from "./SuggestionCard"
import { SuggestionChangesRequested } from "./SuggestionChangesRequested"
import { SuggestionDecisions } from "./SuggestionDecisions"

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
      (s.publicationStatus ?? "published") === "published" &&
      ["open", "reviewing", "planned"].includes(s.status) &&
      (filter === "all" || s.optionKey === filter)
  )
}

const suggestionsText = (n: number) =>
  `${n} ${n === 1 ? "suggestion" : "suggestions"}`

function EmptyBoard({ filter }: { readonly filter: BoardFilter }) {
  const t = useUiTranslations("optionSuggestions")

  return (
    <EmptyState
      surface
      headingLevel={3}
      icon="mdi:thumb-up-outline"
      lead={
        filter === "all"
          ? t("emptyTitle")
          : t("emptyList", { list: t(`lists.${filter}`) })
      }
      detail={t("noOpenIdeas")}
    />
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
  optionCatalogue,
  now,
  round,
  selectedSuggestionId,
  onRevise,
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
  readonly optionCatalogue?: OptionCatalogue
  readonly round?: SuggestionReviewRound | null
  readonly now: Date
  readonly selectedSuggestionId?: string
  readonly onRevise?: (suggestion: PublicSuggestion) => void
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("optionSuggestions")
  const formatter = useFormatter()
  const reviewAt = round?.reviewAt ? new Date(round.reviewAt) : null
  const reviewDate =
    reviewAt && Number.isFinite(reviewAt.getTime())
      ? `${formatter.dateTime(reviewAt, { day: "numeric", timeZone: "UTC" })} ${formatter.dateTime(reviewAt, { month: "short", timeZone: "UTC" })}`
      : null

  const [sort, setSort] = useState<SortMode>("top")
  const [announcement, setAnnouncement] = useState("")
  const ranks = new Map(
    (round?.shortlist ?? []).map((entry) => [entry.documentId, entry.rank])
  )
  const shown = sortSuggestions(boardSuggestions(items, filter), sort)
  const selectedOutside = items.find(
    (item) =>
      item.documentId === selectedSuggestionId &&
      (item.publicationStatus ?? "published") === "published" &&
      !shown.some((visible) => visible.documentId === item.documentId)
  )
  if (sort === "top" && filter === "all")
    shown.sort(
      (a, b) =>
        (ranks.get(a.documentId) ?? Infinity) -
        (ranks.get(b.documentId) ?? Infinity)
    )
  const needsChanges = signedIn
    ? items.filter((s) => s.publicationStatus === "rejected")
    : []
  const lastShortlisted = [...shown]
    .reverse()
    .find((s) => ranks.has(s.documentId))?.documentId

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
      {selectedOutside && (
        <SuggestionCard
          key={`${selectedOutside.documentId}:selected`}
          suggestion={selectedOutside}
          initiallyExpanded
          signedIn={signedIn}
          busy={busyId === selectedOutside.documentId}
          onVote={(idea) => void handleVote(idea)}
          signInHref={SIGN_IN_HREF}
          now={now}
          optionCatalogue={optionCatalogue}
          frozen={
            round?.state === "review" && ranks.has(selectedOutside.documentId)
          }
          shortlistRank={ranks.get(selectedOutside.documentId)}
        />
      )}
      <SuggestionChangesRequested items={needsChanges} onRevise={onRevise} />
      <h2 className="m-0 font-serif text-3xl">
        {t(round?.state === "review" ? "reviewAndVoting" : "openVotes")}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={tUi("filter_by_list")}
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
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors hover:border-(--t-accent-primary)"
                style={{
                  border: `1px solid ${on ? T.accent.primary : T.border.hi}`,
                  background: on ? T.accent.chip : T.bg.deep,
                  color: on ? T.accent.primaryHover : T.ink.base,
                }}
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{
                    background:
                      f.id === "all" ? T.ink.base : LIST_TINTS[f.id].bg,
                  }}
                />
                {f.id === "all" ? t("all") : t(`lists.${f.id}`)}{" "}
                <span className="text-xs tabular-nums">
                  {boardSuggestions(items, f.id).length}
                </span>
              </button>
            )
          })}
        </div>
        <label
          className="flex items-center gap-2 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {t("sort")}
          <SelectField
            label={t("sort")}
            value={sort}
            onValueChange={(value) => setSort(value as SortMode)}
            options={[
              { value: "top", label: t("mostVotes") },
              { value: "new", label: t("newest") },
            ]}
            className="w-auto text-[15px] font-medium"
          />
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
            <li key={s.documentId} className="list-none">
              <SuggestionCard
                key={`${s.documentId}:${s.documentId === selectedSuggestionId}`}
                suggestion={s}
                signedIn={signedIn}
                busy={busyId === s.documentId}
                onVote={(x) => void handleVote(x)}
                signInHref={SIGN_IN_HREF}
                now={now}
                shortlistRank={ranks.get(s.documentId)}
                frozen={round?.state === "review" && ranks.has(s.documentId)}
                optionCatalogue={optionCatalogue}
                initiallyExpanded={s.documentId === selectedSuggestionId}
              />
              {filter === "all" &&
                sort === "top" &&
                s.documentId === lastShortlisted && (
                  <p className="my-5 flex items-center gap-3 text-center text-xs leading-snug font-bold tracking-[0.06em] text-(--t-ink-dim) uppercase sm:gap-4 sm:text-sm">
                    <span
                      aria-hidden
                      className="min-w-6 flex-1 border-t-2 border-dotted border-(--t-border-hi)"
                    />
                    <span className="max-w-[80%] text-balance">
                      {round?.state === "voting" && reviewDate
                        ? t("cutoffProvisionalDate", { date: reviewDate })
                        : t(
                            round?.state === "review"
                              ? "cutoffSaved"
                              : "cutoffProvisional",
                            { count: round?.capacity ?? 5 }
                          )}
                    </span>
                    <span
                      aria-hidden
                      className="min-w-6 flex-1 border-t-2 border-dotted border-(--t-border-hi)"
                    />
                  </p>
                )}
            </li>
          ))}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <SuggestionDecisions items={items} />
    </>
  )
}
