"use client"

import { Icon } from "@iconify/react"
import { useTransition } from "react"

import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import {
  JOURNAL_SORT_LABELS,
  JOURNAL_SORTS,
  journalHref,
  type JournalQuery,
  type JournalSort,
} from "./journalLanding.helpers"

const SELECT_CLASS =
  "cursor-pointer rounded-[10px] border px-3 py-2 text-[14px] font-medium"

/** Language and sort selects plus the grid/list switch for "All articles". */
export function JournalListControls({
  query,
  lang,
  languages,
}: {
  readonly query: JournalQuery
  readonly lang: string
  readonly languages: { code: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(changes: Partial<JournalQuery>) {
    startTransition(() => {
      router.push(journalHref(query, changes), { scroll: false })
    })
  }

  const selectStyle = {
    background: T.bg.deep,
    borderColor: T.border.hi,
    color: T.ink.base,
  }

  return (
    <div
      aria-busy={pending}
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <label className="flex items-center gap-2 text-[14px]">
        <span style={{ color: T.ink.dim }}>Language</span>
        <select
          className={SELECT_CLASS}
          onChange={(e) => go({ lang: e.target.value })}
          style={selectStyle}
          value={lang}
        >
          {languages.length === 0 ? (
            <option value={lang}>{lang}</option>
          ) : (
            languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="flex items-center gap-2 text-[14px]">
        <span style={{ color: T.ink.dim }}>Sort</span>
        <select
          className={SELECT_CLASS}
          onChange={(e) => go({ sort: e.target.value as JournalSort })}
          style={selectStyle}
          value={query.sort}
        >
          {JOURNAL_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {JOURNAL_SORT_LABELS[sort]}
            </option>
          ))}
        </select>
      </label>

      <div
        aria-label="Layout"
        className="flex items-center gap-1 rounded-full border p-1"
        role="group"
        style={{ background: T.bg.deep, borderColor: T.border.hi }}
      >
        {(
          [
            ["grid", "Grid view", "mdi:view-grid-outline"],
            ["list", "List view", "mdi:format-list-bulleted"],
          ] as const
        ).map(([view, label, icon]) => {
          const active = query.view === view

          return (
            <Link
              aria-current={active ? "true" : undefined}
              aria-label={label}
              className="flex size-8 items-center justify-center rounded-full transition-colors"
              href={journalHref(query, { view })}
              key={view}
              scroll={false}
              style={
                active
                  ? { background: T.ink.base, color: "#fff" }
                  : { color: T.ink.dim }
              }
            >
              <Icon aria-hidden="true" height={17} icon={icon} width={17} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
