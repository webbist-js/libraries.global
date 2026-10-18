"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useTransition } from "react"

import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import {
  JOURNAL_SORTS,
  journalHref,
  type JournalQuery,
  type JournalSort,
} from "./journalLanding.helpers"

const SELECT_CLASS =
  "min-h-11 cursor-pointer rounded-full border px-4 py-2 text-[14px] font-medium"

/** Language and sort selects plus the grid/list switch for "All articles". */
export function JournalListControls({
  query,
}: {
  readonly query: JournalQuery
  readonly lang: string
  readonly languages: { code: string; name: string }[]
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

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
        <span style={{ color: T.ink.dim }}>{t("sort")}</span>
        <select
          className={SELECT_CLASS}
          onChange={(e) => go({ sort: e.target.value as JournalSort })}
          style={selectStyle}
          value={query.sort}
        >
          {JOURNAL_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(sort === "title" ? "titleSort" : sort)}
            </option>
          ))}
        </select>
      </label>

      <div
        aria-label={tUi("layout")}
        className="flex items-center gap-1 rounded-full border p-1"
        role="group"
        style={{ background: T.bg.deep, borderColor: T.border.hi }}
      >
        {(
          [
            ["grid", t("gridView"), "mdi:view-grid-outline"],
            ["list", t("listView"), "mdi:format-list-bulleted"],
          ] as const
        ).map(([view, label, icon]) => {
          const active = query.view === view

          return (
            <Link
              aria-current={active ? "true" : undefined}
              aria-label={label}
              className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-muted)"
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
