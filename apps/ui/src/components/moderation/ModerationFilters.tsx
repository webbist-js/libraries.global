"use client"

import type { ReviewCategory } from "@repo/access"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { SearchField } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"

import {
  QUEUE_LABELS,
  type ModerationQueueName,
  type Segment,
  SEGMENTS,
} from "./submissionMeta"

export type QueueFilters = {
  category?: ReviewCategory
  segment: Segment
  queue: ModerationQueueName | ""
  locale: string
  q: string
  /** A Drive's documentId, or "": not part of the filter controls below,
   * only carried in the URL by `queueHref`/`apiQuery` (set by a deep
   * link, cleared from the "Filtered by drive" banner). */
  drive: string
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
  const tUi = useUiTranslations("ui")
  const workspace = useUiTranslations("moderationWorkspace")

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
    <div className="flex flex-col gap-5 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
      <div
        role="group"
        aria-label={tUi("status")}
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
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors"
              style={{
                background: active ? T.accent.chip : "transparent",
                color: active ? T.accent.primary : T.ink.dim,
                fontWeight: active ? 600 : 500,
                border: active
                  ? `1px solid ${T.accent.primary}`
                  : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {s.label}
              {count !== undefined ? (
                <span
                  className="rounded-full px-2 text-sm font-semibold tabular-nums"
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
              className="text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              {value.category === "articles"
                ? workspace("articleType")
                : "Queue"}
            </label>
            <SelectField
              id={ids.queue}
              label={
                value.category === "articles"
                  ? workspace("articleType")
                  : "Queue"
              }
              value={value.queue}
              onValueChange={(queue) =>
                onChange({ queue: queue as QueueFilters["queue"] })
              }
              className="min-h-11 rounded-full border-(--t-border-hi) px-4 text-sm shadow-none"
              options={[
                {
                  value: "",
                  label:
                    value.category === "articles"
                      ? workspace("allArticleTypes")
                      : "All your queues",
                },
                ...queues.map((queue) => ({
                  value: queue,
                  label: QUEUE_LABELS[queue],
                })),
              ]}
            />
          </div>
        ) : null}
        {locales.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.locale}
              className="text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              {tUi("language")}{" "}
            </label>
            <SelectField
              id={ids.locale}
              label={tUi("language")}
              value={value.locale}
              onValueChange={(locale) => onChange({ locale })}
              className="min-h-11 rounded-full border-(--t-border-hi) px-4 text-sm shadow-none"
              options={[
                { value: "", label: "All languages" },
                ...locales.map((locale) => ({
                  value: locale.code,
                  label: locale.name,
                })),
              ]}
            />
          </div>
        ) : null}
        <SearchField
          id={ids.search}
          className="min-h-11 min-w-0 flex-1 basis-64"
          size="sm"
          placeholder={tUi("search_contributor_record_or_note")}
          label={tUi("search_submissions")}
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
