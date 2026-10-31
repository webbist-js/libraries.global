"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { PaginationControls } from "@/components/ds/PaginationControls"
import { SearchField } from "@/components/ds/SearchField"
import { Skeleton } from "@/components/ui/skeleton"
import { T } from "@/lib/design-tokens"
import type { DriveTask } from "@/lib/drives/types"

import { DriveTaskRow } from "./DriveTaskRow"

const SEARCH_DELAY_MS = 300

const PILL =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
const NEAR_PILL =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

/** "Showing 10 libraries", or what's honest when there are none. */
function statusLine(count: number, query: string, loading: boolean): string {
  if (loading && count === 0) return "Loading libraries…"
  if (count > 0)
    return `Showing ${count} ${count === 1 ? "library" : "libraries"}`
  if (query) return `No libraries in this drive match “${query}”.`

  return "Every library in this drive is done or in review."
}

/**
 * A drive's open tasks, one page at a time: a "Town or county" search
 * (sent once typing pauses), "Near me" (asks for the location only when
 * pressed, and again to turn it off), a compact list and numbered pages.
 * The caller fetches; this component only asks.
 */
export function DriveTaskList({
  tasks,
  verb,
  selectedId,
  doneIds,
  loading,
  error,
  hasMore,
  near,
  query,
  onSearch,
  onNear,
  page,
  pageSize,
  total,
  onPage,
  icon,
  onSelect,
}: {
  readonly tasks: readonly DriveTask[]
  readonly verb: string
  readonly selectedId: string | null
  /** Libraries sent this session: shown "In review". */
  readonly doneIds: ReadonlySet<string>
  readonly loading: boolean
  readonly error: string | null
  readonly hasMore: boolean
  /** The list is sorted by distance from the reader. */
  readonly near: boolean
  /** The search the list shows, for the empty message. */
  readonly query: string
  readonly onSearch: (q: string) => void
  readonly onNear: (point: { lat: number; lng: number } | null) => void
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPage: (page: number) => void
  readonly icon?: string
  readonly onSelect: (task: DriveTask) => void
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("drivePage")

  const id = useId()
  const [text, setText] = useState(query)
  const [locating, setLocating] = useState(false)
  const [nearError, setNearError] = useState<string | null>(null)
  const search = useRef(onSearch)
  useEffect(() => {
    search.current = onSearch
  })
  // Typing restarts the timer; the search goes once it pauses.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  const type = (value: string) => {
    setText(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(
      () => search.current(value.trim()),
      SEARCH_DELAY_MS
    )
  }

  const locate = () => {
    if (near) {
      onNear(null)

      return
    }
    setNearError(null)
    const geo = globalThis.navigator?.geolocation
    const fail = () => {
      setLocating(false)
      setNearError("We couldn’t find where you are. Search by town instead.")
    }
    if (!geo) {
      fail()

      return
    }
    setLocating(true)
    geo.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onNear({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      fail,
      { maximumAge: 300_000, timeout: 10_000 }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <SearchField
          size="md"
          loading={loading}
          id={`${id}-q`}
          label={tUi("town_or_county")}
          placeholder={tUi("town_or_county")}
          onClear={() => type("")}
          className="min-h-12 [&_input]:placeholder:text-(--t-ink-dim)"
          inputProps={{
            value: text,
            onChange: (e) => type(e.target.value),
            autoComplete: "off",
          }}
        />
        <div>
          <button
            type="button"
            aria-pressed={near}
            onClick={locate}
            disabled={locating}
            className={`${NEAR_PILL} ${near ? "" : "bg-(--t-bg-deep) hover:bg-(--t-bg-surface)"}`}
            style={
              near
                ? {
                    background: T.accent.chip,
                    borderColor: T.accent.primary,
                    color: T.accent.primaryHover,
                  }
                : { borderColor: T.border.hi, color: T.ink.base }
            }
          >
            <Icon
              aria-hidden="true"
              height={20}
              icon={locating ? "mdi:loading" : "mdi:crosshairs-gps"}
              className={
                locating ? "animate-spin motion-reduce:animate-none" : undefined
              }
              width={20}
            />
            Near me
          </button>
        </div>
        {nearError ? (
          <p className="col-span-2 m-0 text-sm" style={{ color: T.ink.dim }}>
            {nearError}
          </p>
        ) : null}
      </div>

      <p role="status" className="sr-only" style={{ color: T.ink.dim }}>
        {statusLine(tasks.length, query, loading)}
        {near && tasks.length > 0 ? ", nearest first" : ""}
      </p>
      {error ? (
        <p
          role="alert"
          className="m-0 text-sm font-semibold"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}

      {loading && tasks.length === 0 && !error ? (
        <div
          aria-busy="true"
          role="status"
          aria-label={tUi("loading_results")}
          className="divide-y divide-(--t-divider) overflow-hidden rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep)"
        >
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="flex min-h-14 items-center gap-3 px-3.5 py-2"
            >
              <Skeleton className="size-8 shrink-0 rounded-full bg-(--t-border-line)" />
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="h-3 w-3/4 rounded-full bg-(--t-border-line)" />
                <Skeleton className="h-2.5 w-1/2 rounded-full bg-(--t-border-line)" />
              </div>
              <Skeleton className="h-9 w-20 shrink-0 rounded-full bg-(--t-border-line)" />
            </div>
          ))}
        </div>
      ) : tasks.length > 0 ? (
        <ul
          aria-label={tUi("libraries_to_do")}
          className="m-0 flex list-none flex-col divide-y divide-(--t-divider) overflow-hidden rounded-[20px] border border-(--t-border-line) p-0"
        >
          {tasks.map((task) => (
            <DriveTaskRow
              key={task.documentId}
              task={task}
              verb={verb}
              selected={task.documentId === selectedId}
              inReview={task.inReview || doneIds.has(task.documentId)}
              heldByOther={task.heldByOther}
              onSelect={onSelect}
              icon={icon}
            />
          ))}
        </ul>
      ) : null}

      {tasks.length === 0 && !loading && !error ? (
        <p className="m-0 text-sm text-(--t-ink-dim)">
          {statusLine(0, query, false)}
        </p>
      ) : null}
      {error ? (
        <button
          type="button"
          onClick={() => onPage(page)}
          className={`${PILL} self-start border-(--t-border-hi)`}
        >
          {t("retry")}
        </button>
      ) : null}
      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-xs text-(--t-ink-dim)">
            {t("taskRange", {
              first: tasks.length ? page * pageSize + 1 : 0,
              last: Math.min(page * pageSize + tasks.length, total),
              total,
            })}
            {near ? ` · ${t("nearestFirst")}` : ""}
          </p>
          <PaginationControls
            page={page}
            pageCount={Math.max(
              Math.ceil(total / pageSize),
              page + (hasMore ? 2 : 1)
            )}
            onPage={onPage}
            disabled={loading}
          />
        </div>
      ) : null}
    </div>
  )
}
