"use client"

import { useEffect, useId, useRef, useState } from "react"

import { SearchField } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import {
  QUEUE_LABELS,
  type ModerationQueueName,
  type Segment,
  SEGMENTS,
} from "./submissionMeta"

export type QueueFilters = {
  segment: Segment
  queue: ModerationQueueName | ""
  locale: string
  q: string
}

const selectStyle: React.CSSProperties = {
  borderColor: T.border.hi,
  background: T.bg.deep,
  color: T.ink.base,
  fontFamily: T.font.sans,
}

/**
 * The queue's controls: the status segments (Pending, Needs changes,
 * Decided) and, in a fieldset, the queue and language filters and the
 * search. Only the caller's own queues are offered; the language filter
 * appears only when `locales` has more than one entry.
 */
export function ModerationFilters({
  value,
  queues,
  locales,
  counts,
  onChange,
}: {
  readonly value: QueueFilters
  readonly queues: readonly ModerationQueueName[]
  readonly locales: readonly { code: string; name: string }[]
  /** Per segment, within the selected queue; null while unknown. */
  readonly counts: Partial<Record<Segment, number>>
  readonly onChange: (patch: Partial<QueueFilters>) => void
}) {
  const ids = { queue: useId(), locale: useId(), search: useId() }
  const [q, setQ] = useState(value.q)
  const searchRef = useRef<HTMLInputElement>(null)

  // Keep the box in step when the URL changes (back/forward), but never
  // while the user is typing in it: a debounced search landing in the URL
  // would otherwise overwrite the characters typed since.
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      document.activeElement === searchRef.current
    )
      return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ(value.q)
  }, [value.q])

  // Search after a pause in typing.
  useEffect(() => {
    if (q.trim() === value.q) return
    const t = setTimeout(() => onChange({ q: q.trim() }), 400)

    return () => clearTimeout(t)
  }, [q, value.q, onChange])

  return (
    <div className="flex flex-col gap-5">
      <div
        role="group"
        aria-label="Status"
        className="inline-flex w-fit flex-wrap gap-1 rounded-full p-1"
        style={{ background: T.bg.muted2 }}
      >
        {SEGMENTS.map((s) => {
          const active = value.segment === s.id
          const count = counts[s.id]

          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ segment: s.id })}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] transition-colors"
              style={{
                background: active ? T.bg.deep : "transparent",
                color: active ? T.ink.base : T.ink.dim,
                fontWeight: active ? 600 : 500,
                border: active
                  ? `1px solid ${T.border.line}`
                  : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {s.label}
              {count !== undefined ? (
                <span
                  className="rounded-full px-2 text-[13px] font-semibold tabular-nums"
                  style={{
                    background: active ? T.accent.chip : T.bg.muted,
                    color: active ? T.accent.primary : T.ink.dim,
                    lineHeight: "20px",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <fieldset className="m-0 flex flex-wrap items-end gap-3 border-0 p-0">
        <legend className="sr-only">Filter submissions</legend>
        {queues.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.queue}
              className="text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Queue
            </label>
            <select
              id={ids.queue}
              value={value.queue}
              onChange={(e) =>
                onChange({ queue: e.target.value as QueueFilters["queue"] })
              }
              className="rounded-[14px] border px-3 py-2.5 text-[15px]"
              style={selectStyle}
            >
              <option value="">All your queues</option>
              {queues.map((queue) => (
                <option key={queue} value={queue}>
                  {QUEUE_LABELS[queue]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {locales.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.locale}
              className="text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Language
            </label>
            <select
              id={ids.locale}
              value={value.locale}
              onChange={(e) => onChange({ locale: e.target.value })}
              className="rounded-[14px] border px-3 py-2.5 text-[15px]"
              style={selectStyle}
            >
              <option value="">All languages</option>
              {locales.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <SearchField
          id={ids.search}
          className="min-w-[16rem] flex-1"
          size="sm"
          placeholder="Search contributor, record or note"
          label="Search submissions"
          inputRef={searchRef}
          onClear={() => {
            setQ("")
            onChange({ q: "" })
          }}
          inputProps={{
            value: q,
            maxLength: 100,
            onChange: (e) => setQ(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") onChange({ q: q.trim() })
            },
          }}
        />
      </fieldset>
    </div>
  )
}
