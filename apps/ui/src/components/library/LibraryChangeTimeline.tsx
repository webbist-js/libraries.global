"use client"

// The Changes section's batch timeline. The page is rendered statically
// without values; a viewer with `library.history` gets page 1 again from
// the history route, with previous → next, once their session has loaded.

import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { LibIcon } from "@/components/library/LibrarySectionCard"
import { useEntitlements } from "@/lib/access-client"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { LIBRARY_HISTORY_UPGRADE } from "@/lib/plans"
import type {
  LibraryHistoryBatch,
  LibraryHistoryPage,
} from "@/lib/strapi-api/content/server"

import {
  actorLabel,
  batchRow,
  dayName,
  fieldLabel,
  fieldNames,
  formatValue,
  hasValues,
  isImportCreate,
  isUnrecorded,
  isWithheld,
  type RowTone,
  UNRECORDED_NOTE,
} from "./change-history.helpers"

const SECONDARY_PILL =
  "inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-60"

const historyUrl = (documentId: string, page: number) =>
  `/api/libraries/${documentId}/history?page=${page}`

async function loadPage(
  documentId: string,
  page: number
): Promise<LibraryHistoryPage | null> {
  try {
    const res = await fetch(historyUrl(documentId, page))
    if (!res.ok) return null
    const json = (await res.json()) as LibraryHistoryPage

    return Array.isArray(json.data) ? json : null
  } catch {
    return null
  }
}

/** Some field's values exist but weren't sent to this viewer. */
const withheld = (b: LibraryHistoryBatch) => b.fields.some(isWithheld)

/** Rows shown before "Show all". */
const FIRST_ROWS = 4

const ROW_TINT: Record<RowTone, { bg: string; fg: string }> = {
  indigo: { bg: T.accent.chip, fg: T.accent.primary },
  ok: TYPE_TINT.public,
  photo: TYPE_TINT.special,
  import: TYPE_TINT.academic,
}

/** One timeline entry: tinted icon, headline, meta line, details. */
export function TimelineRow({
  icon,
  tone,
  title,
  lead,
  meta,
  children,
}: {
  readonly icon: string
  readonly tone: RowTone
  readonly title: string
  readonly lead?: React.ReactNode
  readonly meta: React.ReactNode[]
  readonly children?: React.ReactNode
}) {
  const tint = ROW_TINT[tone]
  const parts = meta.filter(Boolean)

  return (
    <li
      className="flex gap-4 py-5"
      style={{ borderTop: `1px solid ${T.border.divider}` }}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: tint.bg, color: tint.fg }}
      >
        <LibIcon d={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1 text-[15px] leading-normal">
        <p className="m-0" style={{ color: T.ink.dim }}>
          <strong style={{ color: T.ink.base }}>{title}</strong>
          {lead ? <> {lead}</> : null}
        </p>
        {parts.length > 0 ? (
          <p className="mt-1 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {p}
              </span>
            ))}
          </p>
        ) : null}
        {children}
      </div>
    </li>
  )
}

/** "3 details imported", opening a list of what's behind it. */
export function DetailsDisclosure({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <details className="mt-2.5">
      <summary
        className="cursor-pointer text-[14px] font-semibold"
        style={{ color: T.accent.primary }}
      >
        {label}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

function BatchRow({ batch }: { readonly batch: LibraryHistoryBatch }) {
  const row = batchRow(batch)
  const actor = actorLabel(batch)
  const shown = batch.fields.filter(hasValues)
  const unrecorded = batch.fields.some(isUnrecorded)
  const lead = batch.fields
    .map((f) => f.summary)
    .filter(Boolean)
    .join(" ")
  const note = (
    <p className="m-0 mt-2 text-[13px]" style={{ color: T.ink.dim }}>
      {UNRECORDED_NOTE}
    </p>
  )

  return (
    <TimelineRow
      icon={row.icon}
      tone={row.tone}
      title={row.title}
      lead={lead || null}
      meta={[
        actor.href ? (
          <GlobalLink
            href={actor.href}
            className="underline underline-offset-2"
          >
            {actor.text}
          </GlobalLink>
        ) : (
          actor.text
        ),
        <time key="t" dateTime={batch.changedAt}>
          {dayName(batch.changedAt)}
        </time>,
      ]}
    >
      {row.count ? (
        <DetailsDisclosure label={row.count}>
          {shown.length > 0 ? (
            <dl className="m-0 grid gap-2">
              {shown.map((f) => (
                <div
                  key={f.field}
                  className="rounded-[14px] px-3 py-2"
                  style={{
                    background: T.bg.surface,
                    border: `1px solid ${T.border.line}`,
                  }}
                >
                  <dt
                    className="text-[13px] font-semibold"
                    style={{ color: T.ink.dim }}
                  >
                    {fieldLabel(f.field)}
                  </dt>
                  <dd className="m-0 text-[14px] break-words">
                    <span data-previous style={{ color: T.ink.dim }}>
                      {formatValue(f.previous)}
                    </span>
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> changed to </span>
                    <span data-next style={{ color: T.ink.base }}>
                      {formatValue(f.next)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
              {fieldNames(batch.fields, 12)}
            </p>
          )}
          {unrecorded ? note : null}
        </DetailsDisclosure>
      ) : unrecorded ? (
        note
      ) : null}
    </TimelineRow>
  )
}

export function LibraryChangeTimeline({
  documentId,
  initial,
  created = null,
}: {
  readonly documentId: string
  /** Page 1, as the static page fetched it (without values). */
  readonly initial: LibraryHistoryPage
  /** The "Record created" row, shown last once every batch is listed. */
  readonly created?: React.ReactNode
}) {
  const { can, ready } = useEntitlements()
  const pro = ready && can("library.history")
  const [batches, setBatches] = useState(initial.data)
  const [total, setTotal] = useState(initial.meta.total)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const upgraded = useRef(false)

  // A Pro viewer of the static page: fetch page 1 again, with values.
  useEffect(() => {
    if (!pro || upgraded.current) return
    if (!initial.data.some(withheld)) return
    upgraded.current = true
    let live = true
    loadPage(documentId, 1).then((res) => {
      if (!live || !res) return
      // Swap in the valued page-1 batches; older pages already loaded stay.
      const byId = new Map(res.data.map((b) => [b.batchId, b]))
      setBatches((prev) => {
        const kept = prev.map((b) => byId.get(b.batchId) ?? b)
        const seen = new Set(kept.map((b) => b.batchId))

        return [...kept, ...res.data.filter((b) => !seen.has(b.batchId))]
      })
      setTotal(res.meta.total)
    })

    return () => {
      live = false
    }
  }, [pro, documentId, initial.data])

  function loadMore() {
    setLoading(true)
    setFailed(false)
    loadPage(documentId, page + 1).then((res) => {
      setLoading(false)
      if (!res) {
        setFailed(true)

        return
      }
      setBatches((prev) => {
        const seen = new Set(prev.map((b) => b.batchId))

        return [...prev, ...res.data.filter((b) => !seen.has(b.batchId))]
      })
      setTotal(res.meta.total)
      setPage((p) => p + 1)
    })
  }

  // The import that created the record is the `created` row.
  const rows = created ? batches.filter((b) => !isImportCreate(b)) : batches
  const entries = total - (batches.length - rows.length) + (created ? 1 : 0)
  const more = batches.length < total && page < 100
  const visible = expanded ? rows : rows.slice(0, FIRST_ROWS)
  const showCreated = created && !more && visible.length === rows.length
  const hidden = ready && !pro && batches.some(withheld)

  if (rows.length === 0 && !created)
    return (
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        No changes recorded yet.
      </p>
    )

  function showMore() {
    if (!expanded) {
      setExpanded(true)
      if (rows.length > FIRST_ROWS || !more) return
    }
    loadMore()
  }

  const collapsed = !expanded && rows.length > FIRST_ROWS

  return (
    <div>
      <ul className="m-0 list-none p-0">
        {visible.map((b) => (
          <BatchRow key={b.batchId} batch={b} />
        ))}
        {showCreated ? created : null}
      </ul>

      {hidden ? (
        <p className="mt-3 mb-0 text-[14px]">
          <GlobalLink
            href={LIBRARY_HISTORY_UPGRADE.href}
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            {LIBRARY_HISTORY_UPGRADE.text}
          </GlobalLink>
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        Showing {visible.length + (showCreated ? 1 : 0)} of {entries}{" "}
        {entries === 1 ? "entry" : "entries"}.
      </p>
      {failed ? (
        <p className="mt-3 mb-0 text-[13px]" style={{ color: T.ink.dim }}>
          Older entries couldn’t be loaded. Try again.
        </p>
      ) : null}
      {collapsed || more ? (
        <button
          type="button"
          className={`${SECONDARY_PILL} mt-4`}
          style={{
            background: T.bg.deep,
            borderColor: T.border.hi,
            color: T.ink.base,
          }}
          disabled={loading}
          onClick={showMore}
        >
          {loading
            ? "Loading…"
            : collapsed || entries - rows.length <= initial.meta.pageSize
              ? `Show all ${entries} entries`
              : "Show older entries"}
        </button>
      ) : null}
    </div>
  )
}
