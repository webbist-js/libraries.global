"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { type ReactNode, useRef, useState } from "react"

import type {
  OptionCatalogue,
  PublicSuggestion,
  SuggestionList,
  SuggestionReviewRound,
} from "@/lib/community/suggestions"

import { AlreadyInLists } from "./AlreadyInLists"
import { SuggestionHowItWorks } from "./SuggestionReviewCard"
import { type BoardFilter, SuggestionsBoard } from "./SuggestionsBoard"
import {
  SuggestOptionForm,
  type SuggestOptionFormHandle,
} from "./SuggestOptionForm"
import { useSuggestions } from "./useSuggestions"

/**
 * The Suggestions page below its hero: the board in the main column, and
 * the suggestion form over the rail's server-rendered cards (`children`).
 * It holds the list and the board's filter, so a posted suggestion lands
 * at the top of the board, with the filter back on All.
 */
export function SuggestionsWorkspace({
  initial,
  optionNames,
  optionCatalogue,
  now,
  round: initialRound,
  children,
  selectedSuggestionId,
}: {
  /** Server-rendered suggestions; refetched with the viewer's votes. */
  readonly initial: PublicSuggestion[]
  readonly optionNames: Record<SuggestionList, string[]>
  readonly optionCatalogue?: OptionCatalogue
  readonly signedIn: boolean
  /** The server's "now" (ISO), so relative ages hydrate unchanged. */
  readonly round?: SuggestionReviewRound | null
  readonly now: string
  /** The rail's cards under the form. */
  readonly children?: ReactNode
  readonly selectedSuggestionId?: string
}) {
  const tUi = useUiTranslations("ui")

  const {
    items,
    setItems,
    vote,
    busyId,
    error,
    round,
    viewerScope,
    signedIn: viewerSignedIn,
  } = useSuggestions(initial, initialRound)
  const [filter, setFilter] = useState<BoardFilter>("all")
  const form = useRef<SuggestOptionFormHandle>(null)

  const onPosted = (s: PublicSuggestion) => {
    setItems((list) => [
      s,
      ...list.filter((x) => x.documentId !== s.documentId),
    ])
    setFilter("all")
  }

  return (
    <div
      className="mx-auto flex w-full max-w-[1360px] flex-wrap items-start"
      style={{
        padding:
          "clamp(28px,3.4vw,44px) clamp(16px,3vw,32px) clamp(56px,7vw,88px)",
        gap: "clamp(16px,2.4vw,28px)",
      }}
    >
      <div className="w-full">
        <SuggestOptionForm
          ref={form}
          key={viewerScope}
          signedIn={viewerSignedIn}
          optionNames={optionNames}
          optionCatalogue={optionCatalogue}
          suggestions={items}
          onPosted={onPosted}
          onVote={vote}
          busyId={busyId}
          round={round}
          voteError={error}
        />
      </div>
      <div
        className="flex min-w-0 flex-col"
        style={{ flex: "2 1 440px", gap: "clamp(24px,3vw,36px)" }}
      >
        <SuggestionsBoard
          items={items}
          filter={filter}
          onFilterChange={setFilter}
          onVote={vote}
          busyId={busyId}
          error={error}
          signedIn={viewerSignedIn}
          optionNames={optionNames}
          optionCatalogue={optionCatalogue}
          now={new Date(now)}
          round={round}
          selectedSuggestionId={selectedSuggestionId}
          onRevise={(suggestion) => form.current?.revise(suggestion.documentId)}
        />
      </div>

      <aside
        aria-label={tUi("sidebar")}
        className="flex min-w-0 flex-col gap-3.5 min-[760px]:sticky min-[760px]:top-24 min-[760px]:max-w-[440px]"
        style={{ flex: "1 1 290px" }}
      >
        <AlreadyInLists
          optionNames={optionNames}
          optionCatalogue={optionCatalogue}
          filter="all"
        />
        <SuggestionHowItWorks />
        {children}
      </aside>
    </div>
  )
}
