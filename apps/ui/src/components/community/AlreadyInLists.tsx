"use client"

import { Icon } from "@iconify/react"
import { useId, useState } from "react"

import { LIST_ORDER, type SuggestionList } from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

const SHOWN = 24

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
 * first 24, with a button to show them all.
 */
export function AlreadyInLists({
  optionNames,
  filter,
}: {
  readonly optionNames: Record<SuggestionList, string[]>
  readonly filter: SuggestionList | "all"
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const names = namesInLists(optionNames, filter)
  const shown = expanded ? names : names.slice(0, SHOWN)

  return (
    <section
      aria-labelledby="already-in-lists"
      className="flex flex-col gap-2.5"
    >
      <h2
        id="already-in-lists"
        className="m-0 text-[17px] font-bold"
        style={{ color: T.ink.base }}
      >
        Already in the lists
      </h2>
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        Check these first so we don’t get duplicates.
      </p>
      {names.length === 0 ? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          Nothing in this list yet.
        </p>
      ) : (
        <ul id={listId} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {shown.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full text-[14px] font-semibold"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
                color: T.ink.base,
                padding: "6px 12px",
              }}
            >
              <Icon
                aria-hidden="true"
                height={13}
                icon="mdi:check"
                width={13}
                style={{ color: T.accent.ok }}
              />
              {name}
            </li>
          ))}
        </ul>
      )}
      {names.length > SHOWN ? (
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
          {expanded ? "Show fewer" : `Show all ${names.length}`}
        </button>
      ) : null}
    </section>
  )
}
