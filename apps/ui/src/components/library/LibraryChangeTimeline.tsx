"use client"

// The Changes section's batch timeline. The page is rendered statically
// without values; a viewer with `library.history` gets page 1 again from
// the history route, with previous → next, once their session has loaded.

import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { LibIcon } from "@/components/library/LibrarySectionCard"
import { useEntitlements } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { LIBRARY_HISTORY_UPGRADE } from "@/lib/plans"
import type {
  LibraryHistoryBatch,
  LibraryHistoryPage,
} from "@/lib/strapi-api/content/server"

import {
  actorLabel,
  batchVerb,
  dayName,
  fieldLabel,
  fieldNames,
  formatValue,
  hasValues,
} from "./change-history.helpers"

const SECONDARY_PILL =
  "inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-60"

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

const withFields = (b: LibraryHistoryBatch) => b.fields.length > 0
const valued = (b: LibraryHistoryBatch) => b.fields.some(hasValues)

function BatchRow({ batch }: { readonly batch: LibraryHistoryBatch }) {
  const { verb, icon } = batchVerb(batch)
  const actor = actorLabel(batch)
  const n = batch.fields.length
  const shown = batch.fields.filter(hasValues)

  return (
    <li
      className="flex gap-3.5 py-3.5"
      style={{ borderTop: `1px solid ${T.border.divider}` }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: T.bg.muted, color: T.ink.dim }}
      >
        <LibIcon d={icon} size={15} />
      </span>
      <div className="min-w-0 flex-1 text-[15px] leading-normal">
        <p className="m-0" style={{ color: T.ink.base }}>
          <strong>{verb}</strong>
          {n > 0 ? ` ${n} ${n === 1 ? "field" : "fields"}: ` : null}
          {n > 0 ? fieldNames(batch.fields) : null}
        </p>
        <p className="mt-0.5 mb-0 text-[13px]" style={{ color: T.ink.dim }}>
          {actor.href ? (
            <GlobalLink
              href={actor.href}
              className="underline underline-offset-2"
            >
              {actor.text}
            </GlobalLink>
          ) : (
            actor.text
          )}
          {" · "}
          <time dateTime={batch.changedAt}>{dayName(batch.changedAt)}</time>
        </p>
        {shown.length > 0 ? (
          <details className="mt-2">
            <summary
              className="cursor-pointer text-[14px] font-semibold"
              style={{ color: T.accent.primary }}
            >
              Show what changed
            </summary>
            <dl className="m-0 mt-2 grid gap-2">
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
          </details>
        ) : null}
      </div>
    </li>
  )
}

export function LibraryChangeTimeline({
  documentId,
  initial,
}: {
  readonly documentId: string
  /** Page 1, as the static page fetched it (without values). */
  readonly initial: LibraryHistoryPage
}) {
  const { can, ready } = useEntitlements()
  const pro = ready && can("library.history")
  const [batches, setBatches] = useState(initial.data)
  const [total, setTotal] = useState(initial.meta.total)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const upgraded = useRef(false)

  // A Pro viewer of the static page: fetch page 1 again, with values.
  useEffect(() => {
    if (!pro || upgraded.current) return
    if (!initial.data.some(withFields) || initial.data.some(valued)) return
    upgraded.current = true
    let live = true
    loadPage(documentId, 1).then((res) => {
      if (!live || !res) return
      setBatches(res.data)
      setTotal(res.meta.total)
      setPage(1)
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
      const seen = new Set(batches.map((b) => b.batchId))
      setBatches([...batches, ...res.data.filter((b) => !seen.has(b.batchId))])
      setTotal(res.meta.total)
      setPage(page + 1)
    })
  }

  if (batches.length === 0)
    return (
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        No changes recorded yet.
      </p>
    )

  const hidden =
    ready && !pro && batches.some((b) => withFields(b) && !valued(b))
  const more = batches.length < total && page < 100

  return (
    <div>
      <ul className="m-0 list-none p-0">
        {batches.map((b) => (
          <BatchRow key={b.batchId} batch={b} />
        ))}
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p
          aria-live="polite"
          className="m-0 text-[13px]"
          style={{ color: T.ink.dim }}
        >
          Showing {batches.length} of {total}{" "}
          {total === 1 ? "change" : "changes"}.
          {failed ? " Older changes couldn’t be loaded. Try again." : ""}
        </p>
        {more ? (
          <button
            type="button"
            className={SECONDARY_PILL}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
            disabled={loading}
            onClick={loadMore}
          >
            {loading ? "Loading…" : "Show older changes"}
          </button>
        ) : null}
      </div>
    </div>
  )
}
