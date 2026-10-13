"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { SearchField } from "@/components/ds/SearchField"
import { T } from "@/lib/design-tokens"
import type { DriveTask } from "@/lib/drives/types"

import { DriveTaskRow } from "./DriveTaskRow"

const SEARCH_DELAY_MS = 300

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-semibold transition-colors"

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
 * pressed, and again to turn it off), the list, "Show more", and "Give me
 * a library". The caller fetches; this component only asks.
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
  onMore,
  onRandom,
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
  readonly onMore: () => void
  readonly onRandom: () => void
  readonly onSelect: (task: DriveTask) => void
}) {
  const tUi = useUiTranslations("ui")

  const id = useId()
  const [text, setText] = useState("")
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
      <div className="flex flex-col gap-3">
        <SearchField
          id={`${id}-q`}
          label={tUi("town_or_county")}
          placeholder={tUi("town_or_county")}
          onClear={() => type("")}
          inputProps={{
            value: text,
            onChange: (e) => type(e.target.value),
            autoComplete: "off",
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={near}
            onClick={locate}
            className={`${PILL} ${near ? "" : "bg-white hover:bg-(--t-bg-surface)"}`}
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
              height={17}
              icon={locating ? "mdi:loading" : "mdi:crosshairs-gps"}
              className={
                locating ? "animate-spin motion-reduce:animate-none" : undefined
              }
              width={17}
            />
            Near me
          </button>
          <button
            type="button"
            onClick={onRandom}
            className={`${PILL} bg-white hover:bg-(--t-bg-surface)`}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              height={17}
              icon="mdi:dice-multiple-outline"
              width={17}
            />
            Give me a library
          </button>
        </div>
        {nearError ? (
          <p className="m-0 text-[14.5px]" style={{ color: T.ink.dim }}>
            {nearError}
          </p>
        ) : null}
      </div>

      <p
        role="status"
        className="m-0 text-[14.5px] font-semibold"
        style={{ color: T.ink.dim }}
      >
        {statusLine(tasks.length, query, loading)}
        {near && tasks.length > 0 ? ", nearest first" : ""}
      </p>
      {error ? (
        <p
          role="alert"
          className="m-0 text-[14.5px] font-semibold"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}

      {tasks.length > 0 ? (
        <ul
          aria-label={tUi("libraries_to_do")}
          className="m-0 flex list-none flex-col gap-2 p-0"
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
            />
          ))}
        </ul>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={onMore}
          disabled={loading}
          className={`${PILL} self-start bg-white hover:bg-(--t-bg-surface) disabled:opacity-70`}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          {loading ? tUi("loading") : "Show more"}
        </button>
      ) : null}
    </div>
  )
}
