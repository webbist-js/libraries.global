"use client"

import type {
  AtlasAccessMetric,
  AtlasLibraryAccessArea,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import {
  accessValue,
  ACCESS_COMPARE_PAGE_SIZE,
  ACCESS_COMPARE_PREVIEW_SIZE,
  type AreaSort,
  type ProvisionDirection,
  type SortDirection,
} from "@/components/atlas/atlas-access-analysis"
import { ACCESS_GAP } from "@/components/atlas/atlas-map.style"
import { Icon } from "@/components/atlas/atlas-ui"
import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"

export function AccessCompare({
  metric,
  scopeDescription,
  onSelect,
  selected,
  showAllAreas,
  query,
  setQuery,
  sort,
  setSort,
  resolvedDirection,
  setDirection,
  setPage,
  areaKind,
  rows,
  currentPage,
}: {
  readonly metric: AtlasAccessMetric
  readonly scopeDescription: string
  readonly onSelect: (id: string) => void
  readonly selected: string | null
  readonly showAllAreas: boolean
  readonly query: string
  readonly setQuery: (query: string) => void
  readonly sort: AreaSort
  readonly setSort: (sort: AreaSort) => void
  readonly resolvedDirection: SortDirection
  readonly setDirection: (direction: ProvisionDirection) => void
  readonly setPage: (page: number) => void
  readonly areaKind: string
  readonly rows: readonly AtlasLibraryAccessArea[]
  readonly currentPage: number
}) {
  const tUi = useUiTranslations("ui")

  const start = showAllAreas ? currentPage * ACCESS_COMPARE_PAGE_SIZE : 0
  const visibleRows = rows.slice(
    start,
    start +
      (showAllAreas ? ACCESS_COMPARE_PAGE_SIZE : ACCESS_COMPARE_PREVIEW_SIZE)
  )

  return (
    <section
      aria-label={tUi("library_access_area_comparison")}
      className="flex flex-col gap-5"
    >
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        }}
      >
        <label className="flex min-w-0 flex-col gap-2 text-sm font-bold">
          {tUi("sort_by")}{" "}
          <SelectField
            label={tUi("sort_by")}
            value={sort}
            onValueChange={(value) => {
              setSort(value as AreaSort)
              setDirection(
                value === "rate"
                  ? "provisionLow"
                  : value === "libraries"
                    ? "desc"
                    : "asc"
              )
              setPage(0)
            }}
            options={[
              {
                value: "rate",
                label:
                  metric === "per100k"
                    ? "Libraries per 100k"
                    : "People per library",
              },
              { value: "name", label: "Area name" },
              { value: "libraries", label: "Matching libraries" },
            ]}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-sm font-bold">
          Order
          <SelectField
            label="Order"
            value={resolvedDirection}
            onValueChange={(value) => {
              setDirection(value as SortDirection)
              setPage(0)
            }}
            options={[
              { value: "asc", label: sort === "name" ? "A–Z" : "Lowest first" },
              {
                value: "desc",
                label: sort === "name" ? "Z–A" : "Highest first",
              },
            ]}
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm font-bold">
        Search areas
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(0)
          }}
          className="min-h-[48px] w-full rounded-2xl border bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
          style={{ borderColor: T.border.hi }}
        />
      </label>
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        {rows.length.toLocaleString()} {rows.length === 1 ? "area" : "areas"}
        {query.trim() ? " match your search" : ""}. Unknown values stay last. “5
        / 8” means 5 match your filters out of 8 indexed.
      </p>
      {rows.length ? (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={tUi("area_comparison_table")}
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              {areaKind} ·{" "}
              {metric === "per100k"
                ? "libraries per 100k people"
                : "people per library"}
              . {scopeDescription} Showing {start + 1}–
              {start + visibleRows.length} of {rows.length} areas.
            </caption>
            <thead>
              <tr
                className="border-b text-sm"
                style={{ borderColor: T.border.hi, color: T.ink.dim }}
              >
                <th scope="col" className="min-w-20 pr-2 pb-2 font-semibold">
                  Area
                </th>
                <th scope="col" className="px-1 pb-2 text-right font-semibold">
                  {tUi("libraries")}{" "}
                </th>
                <th scope="col" className="px-1 pb-2 text-right font-semibold">
                  Residents
                </th>
                <th
                  scope="col"
                  className="pb-2 pl-1 text-right font-semibold whitespace-nowrap"
                >
                  {metric === "per100k" ? "Per 100k" : "People / lib"}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((area) => (
                <ComparisonRow
                  key={area.id}
                  {...{ area, metric, onSelect }}
                  selected={selected === area.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p
          role="status"
          className="m-0 rounded-2xl border p-4 text-sm"
          style={{ borderColor: T.border.hi, background: T.bg.surface }}
        >
          {query.trim()
            ? "No areas match your search in this scope."
            : "No reporting areas are available in this scope."}
        </p>
      )}
    </section>
  )
}

function comparisonNote(area: AtlasLibraryAccessArea): string | null {
  if (area.status === "missing_population") return "No population data"
  if (area.status === "no_records") return "Not indexed yet"

  return area.indexedCount < 5 ? "Few records" : null
}

function ComparisonRow({
  area,
  metric,
  onSelect,
  selected,
}: {
  readonly area: AtlasLibraryAccessArea
  readonly metric: AtlasAccessMetric
  readonly onSelect: (id: string) => void
  readonly selected: boolean
}) {
  const note = comparisonNote(area)
  const noMatches = area.status === "available" && area.libraryCount === 0
  const value =
    area.status !== "available"
      ? "—"
      : noMatches && metric === "peoplePerLibrary"
        ? "No matches"
        : accessValue(area, metric)

  return (
    <tr
      className="border-b align-top"
      style={{
        borderColor: T.border.divider,
        background: selected ? T.bg.selected : undefined,
      }}
    >
      <th scope="row" className="py-3 pr-2 font-normal">
        <button
          type="button"
          onClick={() => onSelect(area.id)}
          aria-pressed={selected}
          className="min-h-6 text-left leading-snug font-semibold [overflow-wrap:anywhere] underline decoration-1 underline-offset-2 focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
          style={{ color: T.accent.primary }}
        >
          {area.name}
        </button>
        {note ? (
          <small
            className="mt-0.5 block text-xs leading-snug"
            style={{ color: note === "Few records" ? ACCESS_GAP : T.ink.dim }}
          >
            {note}
          </small>
        ) : null}
      </th>
      <td className="px-1 py-3 text-right whitespace-nowrap tabular-nums">
        <span
          aria-label={`${area.libraryCount.toLocaleString()} matching libraries out of ${area.indexedCount.toLocaleString()} indexed before filters`}
          title={`${area.libraryCount.toLocaleString()} matching / ${area.indexedCount.toLocaleString()} indexed before filters`}
        >
          {area.libraryCount.toLocaleString()}
          {area.libraryCount !== area.indexedCount
            ? ` / ${area.indexedCount.toLocaleString()}`
            : ""}
        </span>
      </td>
      <td className="px-1 py-3 text-right whitespace-nowrap tabular-nums">
        {area.population?.toLocaleString() ?? "—"}
      </td>
      <td
        className="py-3 pl-1 text-right font-semibold whitespace-nowrap tabular-nums"
        title={
          noMatches && metric === "peoplePerLibrary"
            ? "No indexed libraries match the current filters; people per library has no finite value."
            : undefined
        }
      >
        {value}
      </td>
    </tr>
  )
}

export function AccessCompareFooter({
  total,
  showAllAreas,
  setShowAllAreas,
  currentPage,
  setPage,
}: {
  readonly total: number
  readonly showAllAreas: boolean
  readonly setShowAllAreas: (show: boolean) => void
  readonly currentPage: number
  readonly setPage: (page: number) => void
}) {
  const tUi = useUiTranslations("ui")

  if (total <= ACCESS_COMPARE_PREVIEW_SIZE) return null

  return showAllAreas ? (
    <div className="flex flex-col gap-1 text-xs">
      {total > ACCESS_COMPARE_PAGE_SIZE ? (
        <nav
          aria-label={tUi("area_comparison_pages")}
          className="flex items-center justify-between gap-2"
        >
          <button
            type="button"
            aria-label={tUi("previous_area_page")}
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="flex min-h-11 items-center gap-1 font-semibold disabled:opacity-40"
            style={{ color: T.accent.primary }}
          >
            <Icon name="chev" size={14} className="rotate-180" />{" "}
            {tUi("previous")}{" "}
          </button>
          <span
            role="status"
            className="tabular-nums"
            style={{ color: T.ink.dim }}
          >
            {(currentPage * ACCESS_COMPARE_PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(
              total,
              (currentPage + 1) * ACCESS_COMPARE_PAGE_SIZE
            ).toLocaleString()}{" "}
            of {total.toLocaleString()}
          </span>
          <button
            type="button"
            aria-label={tUi("next_area_page")}
            disabled={(currentPage + 1) * ACCESS_COMPARE_PAGE_SIZE >= total}
            onClick={() => setPage(currentPage + 1)}
            className="flex min-h-11 items-center gap-1 font-semibold disabled:opacity-40"
            style={{ color: T.accent.primary }}
          >
            {tUi("next")} <Icon name="chev" size={14} />
          </button>
        </nav>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setShowAllAreas(false)
          setPage(0)
        }}
        className="min-h-9 self-center font-semibold underline underline-offset-2"
        style={{ color: T.accent.primary }}
      >
        Show fewer areas
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => {
        setShowAllAreas(true)
        setPage(0)
      }}
      aria-label={`Show all ${total.toLocaleString()} areas in the comparison table`}
      className="min-h-[48px] w-full rounded-full border bg-white px-4 text-sm font-semibold"
      style={{ borderColor: T.border.hi }}
    >
      Show all {total.toLocaleString()}
    </button>
  )
}
