"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import { Badge } from "@/components/ds/Badge"
import {
  LIST_ORDER,
  LIST_TINTS,
  type OptionCatalogue,
  type SuggestionList,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

const SHOWN = 24
const PER_LIST = 6

/** The names in the chosen lists (every list for "all"), deduplicated and sorted. */
export function namesInLists(
  optionNames: Record<SuggestionList, string[]>,
  filter: SuggestionList | "all"
): string[] {
  const lists = filter === "all" ? LIST_ORDER : [filter]
  const byKey = new Map<string, string>()
  for (const list of lists)
    for (const name of optionNames[list] ?? []) {
      const key = name.trim().toLowerCase()
      if (key && !byKey.has(key)) byKey.set(key, name.trim())
    }

  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "en"))
}

/**
 * "Already in the lists": the options the board's current filter covers,
 * so people check for an existing option before suggesting one. Shows the
 * six per category (24 in a single category), with a button to show them all.
 */
export function AlreadyInLists({
  optionNames,
  optionCatalogue,
  filter,
}: {
  readonly optionNames: Record<SuggestionList, string[]>
  readonly optionCatalogue?: OptionCatalogue
  readonly filter: SuggestionList | "all"
}) {
  const t = useTranslations("optionSuggestions")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const options = optionCatalogue
    ? (filter === "all" ? LIST_ORDER : [filter])
        .flatMap((list) =>
          optionCatalogue[list].map((option) => ({ ...option, list }))
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    : (filter === "all" ? LIST_ORDER : [filter])
        .flatMap((list) =>
          (optionNames[list] ?? []).map((name) => ({
            documentId: name,
            name,
            list,
          }))
        )
        .sort((a, b) => a.name.localeCompare(b.name))
  const matches = options.filter((item) =>
    `${item.name} ${"summary" in item ? (item.summary ?? "") : ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  )
  const preview =
    filter === "all"
      ? LIST_ORDER.flatMap((list) =>
          matches.filter((item) => item.list === list).slice(0, PER_LIST)
        )
      : matches.slice(0, SHOWN)
  const shown = expanded ? matches : preview

  return (
    <section
      aria-labelledby="already-in-lists"
      className="flex flex-col gap-3 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="already-in-lists"
          className="m-0 font-serif text-[25px] leading-tight font-medium"
          style={{ color: T.ink.base }}
        >
          {t("checklistTitle")}
        </h2>
        <span className="text-sm text-(--t-ink-dim)">
          {t("checklistCount", { count: options.length })}
        </span>
      </div>
      <div className="relative">
        <Icon
          aria-hidden
          icon="mdi:magnify"
          width={17}
          height={17}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--t-ink-dim)"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setExpanded(false)
          }}
          aria-label={t("filterChecklist")}
          placeholder={t("filterChecklist")}
          className="min-h-11 w-full rounded-full border border-(--t-border-line) bg-(--t-bg-void) pr-4 pl-10 text-sm"
        />
      </div>
      {matches.length === 0 ? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          {t("noChecklistMatches")}
        </p>
      ) : (
        <div id={listId} className="grid gap-4">
          {LIST_ORDER.map((list) => {
            const entries = shown.filter(
              (item) =>
                item.list === list || (!item.list && list === LIST_ORDER[0])
            )
            if (!entries.length) return null

            return (
              <section key={list}>
                <h3 className="mt-0 mb-2 flex items-center gap-2 text-[13px] font-bold tracking-[0.08em] text-(--t-ink-dim) uppercase">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: LIST_TINTS[list].fg }}
                  />
                  {t(`lists.${list}`)} ·{" "}
                  {matches.filter((item) => item.list === list).length}
                </h3>
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {entries.map((option) => (
                    <li
                      key={`${option.list ?? "all"}:${option.documentId}`}
                      className="max-w-full text-(--t-ink-base)"
                    >
                      <Badge
                        label={option.name}
                        color="dim"
                        size="md"
                        style={{
                          fontWeight: 400,
                          lineHeight: 1.35,
                          padding: "4px 10px",
                          color: T.ink.base,
                          background: T.bg.void,
                          whiteSpace: "normal",
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      {matches.length > preview.length ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-11 cursor-pointer items-center self-start rounded-full px-4 text-[15px] font-semibold transition-colors hover:border-(--t-accent-primary)"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.hi}`,
            color: T.accent.primary,
          }}
        >
          {t(expanded ? "showFewer" : "showAll", { count: matches.length })}
        </button>
      ) : null}
    </section>
  )
}
