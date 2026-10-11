"use client"
import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Card } from "@/components/ds"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { PublicMobileTimetable } from "@/lib/mobile/types"
import {
  loadStopTimetable,
  searchPlaceMobileStops,
  type MobileStopHit,
} from "@/lib/mobile-stop-search"
import { Link } from "@/lib/navigation"
import { shortDate } from "@/lib/staff/format"

import { nextStopVisit } from "./mobile-place-stops.logic"
import { StopDrawer } from "./StopDrawer"
import { useMobileClock } from "./useMobileClock"

export function MobileStopSummary({
  hit,
  onSelect,
}: {
  hit: MobileStopHit
  onSelect?: () => void
}) {
  const now = useMobileClock(),
    next = now ? nextStopVisit(hit, now) : null

  return (
    <div>
      <p className="m-0 font-semibold">
        {onSelect ? (
          <button
            className="inline-flex min-h-11 items-center text-left underline-offset-2 hover:underline"
            type="button"
            onClick={onSelect}
          >
            {hit.name}
          </button>
        ) : (
          hit.name
        )}
      </p>
      <p className="my-1 text-sm" style={{ color: T.ink.dim }}>
        {hit.where}
      </p>
      <p className="my-2 text-sm">
        {now
          ? next
            ? `Next ${shortDate(next.date)}, ${next.arrive}–${next.depart}`
            : "No upcoming visit recorded"
          : "Calculating the next visit…"}
      </p>
    </div>
  )
}
export function MobilePlaceStops({
  level = "area",
  slug,
  name,
}: {
  level?: "area" | "region"
  slug: string
  name: string
}) {
  const tUi = useUiTranslations("ui")

  // Keyset paging: `cursors[n]` is the cursor that opens page n (null for
  // the first); the total comes with the first page. The paging state is
  // keyed by the place, so a different place starts again at page one.
  const key = `${level}:${slug}`
  const [paging, setPaging] = useState<{
      key: string
      page: number
      cursors: (string | null)[]
    }>({ key, page: 0, cursors: [null] }),
    [total, setTotal] = useState(0),
    [data, setData] = useState<{
      hits: MobileStopHit[]
      next: string | null
    } | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<MobileStopHit | null>(null),
    [timetable, setTimetable] = useState<PublicMobileTimetable | null>(null)
  const { page, cursors } =
    paging.key === key ? paging : { page: 0, cursors: [null] }
  const after = cursors[page] ?? null
  useEffect(() => {
    let active = true
    searchPlaceMobileStops(level, slug, after)
      .then((value) => {
        if (!active) return
        setData({ hits: value.hits, next: value.next })
        if (!after) setTotal(value.total)
        setError("")
      })
      .catch(() => {
        if (active) setError("Mobile stops are temporarily unavailable.")
      })

    return () => {
      active = false
    }
  }, [level, slug, after])
  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    loadStopTimetable(selected, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setTimetable(value)
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("The timetable could not be loaded.")
      })

    return () => controller.abort()
  }, [selected])
  if (data && total === 0 && !error) return null

  return (
    <section aria-labelledby={`mobile-stops-${slug}`}>
      <h2
        id={`mobile-stops-${slug}`}
        style={{ fontFamily: T.font.serif }}
        className="text-3xl"
      >
        Mobile library stops in {name}
      </h2>
      <p>
        These libraries come to you. Visit times use each service’s local
        timezone.
      </p>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <p style={{ color: T.ink.dim }}>
            {total.toLocaleString()} stops · page {page + 1}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.hits.map((hit) => (
              <Card key={hit.id} className="p-5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
                  style={{
                    background: TYPE_TINT.public.bg,
                    color: TYPE_TINT.public.fg,
                  }}
                >
                  <Icon aria-hidden="true" icon="mdi:bus-stop" width={14} />
                  Mobile stop
                </span>
                <MobileStopSummary
                  hit={hit}
                  onSelect={() => {
                    setTimetable(null)
                    setSelected(hit)
                  }}
                />
                {hit.library_path ? (
                  <Link
                    href={hit.library_path}
                    style={{ color: T.accent.primary }}
                  >
                    {hit.library_name} →
                  </Link>
                ) : (
                  <span>{hit.library_name}</span>
                )}
              </Card>
            ))}
          </div>
          {(page > 0 || data.next) && (
            <nav
              aria-label={tUi("mobile_stops_pages")}
              className="mt-5 flex gap-3"
            >
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-full border bg-white px-4 font-semibold hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
                disabled={!page}
                onClick={() => setPaging({ key, page: page - 1, cursors })}
              >
                {tUi("previous")}{" "}
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-full border bg-white px-4 font-semibold hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
                disabled={!data.next}
                onClick={() => {
                  if (!data.next) return
                  setPaging({
                    key,
                    page: page + 1,
                    cursors: [...cursors.slice(0, page + 1), data.next],
                  })
                }}
              >
                {tUi("next")}{" "}
              </button>
            </nav>
          )}
        </>
      )}
      {selected && timetable?.timetable && (
        <StopDrawer
          id={selected.library_document_id}
          name={selected.library_name}
          tt={timetable.timetable}
          notices={timetable.notices}
          timezone={timetable.timezone}
          stopId={selected.stop_id}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}
