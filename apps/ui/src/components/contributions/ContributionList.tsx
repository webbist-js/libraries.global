"use client"

import {
  type ComponentProps,
  type ReactNode,
  useId,
  useMemo,
  useState,
} from "react"

import { T } from "@/lib/design-tokens"

import { ContributionFilters } from "./ContributionFilters"
import { ContributionRow } from "./ContributionRow"
import { type ContributionItem, groupByDay } from "./contributions"

type RowExtras = Omit<ComponentProps<typeof ContributionRow>, "item">

/**
 * A card of contributions: a serif title and live count, filter chips, then
 * the rows grouped by day. The profile's Contributions tab (accepted only,
 * filtered by kind) and My submissions (every status, filtered by status)
 * both render it, so the two lists look and read the same.
 */
export function ContributionList<I extends ContributionItem, F extends string>({
  title,
  items,
  filters,
  matches,
  legend,
  rowExtras,
  intro,
}: {
  title: string
  items: readonly I[]
  /** The chips; the first is selected to start with. */
  filters: readonly { id: F; label: string }[]
  matches: (item: I, filter: F) => boolean
  /** The chips' group name for screen readers, e.g. "Filter by status". */
  legend: string
  /** Points, an action or a note for a row. */
  rowExtras?: (item: I) => RowExtras
  /** A line under the title, e.g. where the rest of the list lives. */
  intro?: ReactNode
}) {
  const titleId = useId()
  const [active, setActive] = useState<F>(filters[0]!.id)

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((f) => [
          f.id,
          items.filter((item) => matches(item, f.id)).length,
        ])
      ) as Record<F, number>,
    [filters, items, matches]
  )
  const filtered = useMemo(
    () => items.filter((item) => matches(item, active)),
    [items, matches, active]
  )
  const grouped = useMemo(() => groupByDay(filtered), [filtered])
  const activeLabel = filters.find((f) => f.id === active)?.label
  const isFirst = active === filters[0]!.id

  return (
    <section
      aria-labelledby={titleId}
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        background: T.bg.deep,
      }}
    >
      <div className="flex flex-col gap-4 px-6 pt-5 pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id={titleId}
            className="type-h2 m-0"
            style={{
              color: T.ink.base,
            }}
          >
            {title}
          </h2>
          <span
            className="text-base"
            style={{ color: T.ink.dim }}
            aria-live="polite"
          >
            {filtered.length}{" "}
            {filtered.length === 1 ? "contribution" : "contributions"}
            {isFirst ? "" : ` · ${activeLabel}`}
          </span>
        </div>
        {intro}
        <ContributionFilters
          legend={legend}
          options={filters}
          active={active}
          counts={counts}
          onChange={setActive}
        />
      </div>

      {grouped.length === 0 ? (
        <p
          className="m-0 border-t px-6 py-6 text-base"
          style={{ borderTopColor: T.border.divider, color: T.ink.dim }}
        >
          Nothing here yet.
        </p>
      ) : (
        grouped.map((group) => (
          <div key={group.label}>
            <h3
              className="type-small-heading m-0 border-t px-6 pt-4 pb-1"
              style={{ borderTopColor: T.border.line, color: T.ink.low }}
            >
              {group.label}
            </h3>
            <ul className="m-0 list-none p-0">
              {group.items.map((item) => (
                <ContributionRow
                  key={item.documentId}
                  item={item}
                  {...rowExtras?.(item)}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
