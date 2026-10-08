"use client"
import { Icon } from "@iconify/react"
import {
  dayRoute,
  localDateTime,
  type PublicLiveState,
} from "@repo/shared-data"
import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { publicLiveCopy } from "@/components/mobile/live-copy"
import { StopDrawer } from "@/components/mobile/StopDrawer"
import { T } from "@/lib/design-tokens"
import type { PublicMobileTimetable } from "@/lib/mobile/types"
import { loadStopTimetable, type MobileStopHit } from "@/lib/mobile-stop-search"

export function AtlasStopPanel({
  stop,
  live,
  now,
  onClose,
}: {
  readonly stop: MobileStopHit
  readonly live?: PublicLiveState
  readonly now: Date
  readonly onClose: () => void
}) {
  const [loaded, setLibrary] = useState<PublicMobileTimetable | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null),
    [drawer, setDrawer] = useState(false)
  const library =
    loaded?.documentId === stop.library_document_id ? loaded : null
  const error = failedId === stop.library_document_id
  useEffect(() => {
    const controller = new AbortController()
    loadStopTimetable(stop, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setLibrary(data)
          setFailedId(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedId(stop.library_document_id)
      })

    return () => controller.abort()
  }, [stop.library_document_id])
  const tt = library?.timetable,
    today = library ? localDateTime(now, library.timezone).date : null
  const route = tt && today ? dayRoute(tt, library.notices, today) : []
  const copy = tt && live ? publicLiveCopy(live, tt) : null

  return (
    <section
      className="space-y-5 p-5"
      aria-label="Selected mobile library stop"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="m-0 text-sm font-semibold"
            style={{ color: T.map.stopRing }}
          >
            Mobile library stop
          </p>
          <h2
            className="mt-1 mb-0 text-2xl"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {stop.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stop panel"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-white hover:bg-(--t-bg-surface)"
          style={{ borderColor: T.border.line, color: T.ink.base }}
        >
          <Icon aria-hidden="true" icon="mdi:close" width={20} />
        </button>
      </div>
      <p>{stop.where || "No landmark added yet."}</p>
      <p>
        {stop.library_path ? (
          <GlobalLink
            href={stop.library_path}
            className="font-semibold underline"
          >
            {stop.library_name}
          </GlobalLink>
        ) : (
          stop.library_name
        )}
      </p>
      {error ? (
        <p role="status">
          The timetable could not be loaded. Open the library page to try again.
        </p>
      ) : !library ? (
        <p role="status">Loading timetable…</p>
      ) : tt ? (
        <>
          {copy ? (
            <p
              role="status"
              className="m-0 rounded-[14px] p-3"
              style={{ background: T.bg.muted2 }}
            >
              {copy.sentence}
            </p>
          ) : null}
          <p>
            {tt.stops.length} stops · {tt.cycle.weeks}-week cycle
          </p>
          <h3
            className="mb-2 text-[20px]"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            Today’s route
          </h3>
          {route.length ? (
            <ol className="space-y-2 pl-5">
              {route.map((visit) => (
                <li key={visit.visitId}>
                  {tt.stops.find((row) => row.id === visit.stopId)?.name} ·{" "}
                  {visit.arrive}–{visit.depart}
                  {visit.cancelledBy ? " · Cancelled" : ""}
                </li>
              ))}
            </ol>
          ) : (
            <p>No visits scheduled today.</p>
          )}
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
            onClick={() => setDrawer(true)}
          >
            Stop times and calendar
          </button>
          <StopDrawer
            id={library.documentId}
            name={library.name}
            tt={tt}
            timezone={library.timezone}
            notices={library.notices}
            stopId={drawer ? stop.stop_id : null}
            onClose={() => setDrawer(false)}
          />
        </>
      ) : (
        <div>
          <p className="m-0 font-semibold">No timetable added yet</p>
          <p className="m-0 mt-1 text-sm" style={{ color: T.ink.dim }}>
            Stops and times appear here once the library adds them.
          </p>
          {stop.library_path ? (
            <GlobalLink
              href={`${stop.library_path}#stops`}
              className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              See the library’s Stops section
            </GlobalLink>
          ) : null}
        </div>
      )}
    </section>
  )
}
