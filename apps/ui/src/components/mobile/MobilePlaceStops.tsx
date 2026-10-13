"use client"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Card } from "@/components/ds"
import { T } from "@/lib/design-tokens"
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
    [totals, setTotals] = useState<{
      key: string
      stops: number
      services: number | null
    }>({ key, stops: 0, services: null }),
    [data, setData] = useState<{
      key: string
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
        setData({
          key: `${key}:${after ?? ""}`,
          hits: value.hits,
          next: value.next,
        })
        if (!after)
          setTotals({
            key,
            stops: value.total,
            services: value.services ?? null,
          })
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
  const total = totals.key === key ? totals.stops : 0
  const serviceCount = totals.key === key ? totals.services : null
  const visible = data?.key === `${key}:${after ?? ""}` ? data : null
  const groups = new Map<string, MobileStopHit[]>()
  for (const hit of visible?.hits ?? [])
    groups.set(hit.library_document_id, [
      ...(groups.get(hit.library_document_id) ?? []),
      hit,
    ])
  if (visible && total === 0 && !error) return null

  return (
    <section aria-labelledby={`mobile-stops-${slug}`}>
      <h2
        id={`mobile-stops-${slug}`}
        style={{ fontFamily: T.font.serif }}
        className="text-3xl"
      >
        Mobile libraries that visit {name}
      </h2>
      <p>
        These libraries come to you. Visit times use each service’s local
        timezone.
      </p>
      {error && <p role="status">{error}</p>}
      {visible && (
        <>
          <p style={{ color: T.ink.dim }}>
            {serviceCount !== null ? `${serviceCount} services · ` : ""}
            {total.toLocaleString()} stops · {groups.size} services on this page
            · page {page + 1}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...groups].map(([id, stops]) => (
              <Card key={id} className="p-5">
                <h3 className="m-0 text-lg font-semibold">
                  {stops[0]!.library_path ? (
                    <Link href={stops[0]!.library_path}>
                      {stops[0]!.library_name}
                    </Link>
                  ) : (
                    stops[0]!.library_name
                  )}
                </h3>
                <p className="text-sm" style={{ color: T.ink.dim }}>
                  {stops.length} {stops.length === 1 ? "stop" : "stops"} shown
                  in {name}
                </p>
                {stops.map((hit) => (
                  <div
                    key={hit.id}
                    className="border-t py-3"
                    style={{ borderColor: T.border.line }}
                  >
                    <MobileStopSummary
                      hit={hit}
                      onSelect={() => {
                        setTimetable(null)
                        setSelected(hit)
                      }}
                    />
                  </div>
                ))}
              </Card>
            ))}
          </div>
          {(page > 0 || visible.next) && (
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
                disabled={!visible.next}
                onClick={() => {
                  if (!visible.next) return
                  setPaging({
                    key,
                    page: page + 1,
                    cursors: [...cursors.slice(0, page + 1), visible.next],
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
