"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { type ReactNode, useState } from "react"

import type {
  PublicSuggestion,
  SuggestionList,
} from "@/lib/community/suggestions"

import { type BoardFilter, SuggestionsBoard } from "./SuggestionsBoard"
import { SuggestOptionForm } from "./SuggestOptionForm"
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
  signedIn,
  now,
  children,
}: {
  /** Server-rendered suggestions; refetched with the viewer's votes. */
  readonly initial: PublicSuggestion[]
  readonly optionNames: Record<SuggestionList, string[]>
  readonly signedIn: boolean
  /** The server's "now" (ISO), so relative ages hydrate unchanged. */
  readonly now: string
  /** The rail's cards under the form. */
  readonly children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const { items, setItems, vote, busyId, error } = useSuggestions(initial)
  const [filter, setFilter] = useState<BoardFilter>("all")

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
          signedIn={signedIn}
          optionNames={optionNames}
          now={new Date(now)}
        />
      </div>

      <aside
        aria-label={tUi("sidebar")}
        className="flex min-w-0 flex-col gap-3.5 min-[760px]:sticky min-[760px]:top-24 min-[760px]:max-w-[440px]"
        style={{ flex: "1 1 290px" }}
      >
        <SuggestOptionForm
          signedIn={signedIn}
          optionNames={optionNames}
          suggestions={items}
          onPosted={onPosted}
        />
        {children}
      </aside>
    </div>
  )
}
