"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useTransition } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import {
  JOURNAL_SORTS,
  journalHref,
  type JournalQuery,
  type JournalSort,
} from "./journalLanding.helpers"

/** Sort and layout share the sticky toolbar with the discovery filters. */
export function JournalListControls({
  query,
}: {
  readonly query: JournalQuery
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

  return (
    <div aria-busy={pending} className="flex flex-wrap items-center gap-2">
      <SelectField
        appearance="pill"
        label={t("sort")}
        value={query.sort}
        disabled={pending}
        className="min-w-[132px]"
        onValueChange={(value) => go({ sort: value as JournalSort })}
        options={JOURNAL_SORTS.map((sort) => ({
          value: sort,
          label: t(sort === "title" ? "titleSort" : sort),
        }))}
      />

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
              className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-muted)"
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
