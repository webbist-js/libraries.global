"use client"

import { Icon } from "@iconify/react"
import {
  addDays,
  describeRepeat,
  localDateTime,
  occurrences,
  toMinutes,
  WEEKDAYS,
  type PublicLiveState,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { StatusBadge } from "@/components/ds/StatusBadge"
import GlobalLink from "@/components/global/GlobalLink"
import { publicLiveCopy } from "@/components/mobile/live-copy"
import { stopDirections } from "@/components/mobile/mobile-helpers"
import { StopDrawer } from "@/components/mobile/StopDrawer"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { PublicMobileTimetable } from "@/lib/mobile/types"
import { loadStopTimetable, type MobileStopHit } from "@/lib/mobile-stop-search"
import { timeAgo, weekdayCopy, weekdayName } from "@/lib/staff/format"

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
  const tUi = useUiTranslations("ui")

  const [loaded, setLibrary] = useState<PublicMobileTimetable | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const libraryDocumentId = stop.library_document_id
  const library = loaded?.documentId === libraryDocumentId ? loaded : null
  const error = failedId === libraryDocumentId
  useEffect(() => {
    const controller = new AbortController()
    loadStopTimetable(
      { library_document_id: libraryDocumentId },
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setLibrary(data)
          setFailedId(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedId(libraryDocumentId)
      })

    return () => controller.abort()
  }, [libraryDocumentId])
  const tt = library?.timetable,
    local = library ? localDateTime(now, library.timezone) : null,
    selectedStop = tt?.stops.find((row) => row.id === stop.stop_id)
  const visits =
    tt?.visits.filter((visit) => visit.stopId === stop.stop_id) ?? []
  const next =
    tt && local
      ? occurrences(tt, library.notices, local.date, addDays(local.date, 183))
          .filter(
            (visit) =>
              visit.stopId === stop.stop_id &&
              (visit.date > local.date ||
                toMinutes(visit.depart) > local.minute)
          )
          .slice(0, 2)
      : []
  const copy =
    tt && live && local
      ? publicLiveCopy(live, tt, { today: local.date, now })
      : null
  const directions = stopDirections({
    ...stop,
    id: stop.stop_id,
    areaDocumentId: null,
    location: selectedStop ? selectedStop.location : (stop._geo ?? null),
  })
  const updated =
    live?.updatedAt && ["here", "road", "late"].includes(live.kind)
      ? timeAgo(live.updatedAt, now)
      : null

  return (
    <section
      className="space-y-4 p-[18px] text-sm"
      aria-label={tUi("selected_mobile_library_stop")}
      style={{ color: T.ink.base }}
    >
      <header className="relative">
        <div className="min-h-10 pr-14">
          <span
            className="inline-flex min-h-6 items-center gap-2 rounded-full px-3 py-1 text-[13px] font-bold"
            style={{ background: TYPE_TINT.public.bg, color: T.map.stopRing }}
          >
            <Icon aria-hidden="true" icon="mdi:bus-side" width={16} />
            Mobile library stop
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tUi("close_stop_panel")}
          className="absolute top-0 right-0 flex size-10 items-center justify-center rounded-full border bg-white hover:bg-(--t-bg-surface)"
          style={{ borderColor: T.border.line, color: T.ink.base }}
        >
          <Icon aria-hidden="true" icon="mdi:close" width={20} />
        </button>
        <h2
          className="mt-2 mb-0 text-[32px] leading-[1.15]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          {stop.name}
        </h2>
        <p className="mt-2 mb-0" style={{ color: T.ink.dim }}>
          {stop.where || "No landmark added yet."}
        </p>
      </header>
      <p className="m-0">
        {stop.library_path ? (
          <GlobalLink
            href={stop.library_path}
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Served by {stop.library_name}
          </GlobalLink>
        ) : (
          `Served by ${stop.library_name}`
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
            <div
              role="status"
              className="space-y-2 rounded-[18px] border p-3.5"
              style={{
                background:
                  copy.tone === "ok" ? TYPE_TINT.public.bg : T.bg.muted,
                borderColor:
                  copy.tone === "neutral" ? T.border.line : T.edge[copy.tone],
              }}
            >
              <StatusBadge
                tone={copy.tone}
                icon={live?.kind === "here" ? "mdi:check" : copy.icon}
              >
                {copy.label}
              </StatusBadge>
              <p className="m-0 text-base font-bold">{copy.sentence}</p>
              {updated ? (
                <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
                  Updated {updated} by the crew
                </p>
              ) : null}
            </div>
          ) : null}
          <section aria-labelledby="atlas-stop-visits">
            <h3 id="atlas-stop-visits" className="m-0 mb-2 text-base font-bold">
              Visits to this stop
            </h3>
            {visits.length ? (
              <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  Regular visits to {stop.name}
                </caption>
                <thead style={{ color: T.ink.dim }}>
                  <tr
                    className="border-b"
                    style={{ borderColor: T.border.line }}
                  >
                    <th scope="col" className="pr-2 pb-2 font-bold">
                      Day
                    </th>
                    <th scope="col" className="pr-2 pb-2 font-bold">
                      Time
                    </th>
                    <th scope="col" className="pb-2 font-bold">
                      How often
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit) => (
                    <tr
                      key={visit.id}
                      className="border-b"
                      style={{ borderColor: T.border.line }}
                    >
                      <th
                        scope="row"
                        className="py-2 pr-2 align-top font-semibold"
                      >
                        {weekdayName(
                          addDays(tt.cycle.anchor, WEEKDAYS.indexOf(visit.day))
                        )}
                      </th>
                      <td className="py-2 pr-2 align-top">
                        {visit.arrive}–{visit.depart}
                      </td>
                      <td className="py-2 align-top">
                        {describeRepeat(visit, tt.cycle)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="m-0" style={{ color: T.ink.dim }}>
                No visits scheduled for this stop.
              </p>
            )}
          </section>
          <section aria-labelledby="atlas-stop-next">
            <h3 id="atlas-stop-next" className="m-0 mb-1 text-base font-bold">
              Next visits
            </h3>
            {next.length ? (
              <ul className="m-0 list-none p-0">
                {next.map((visit, index) => {
                  const previous = next[index - 1]
                  const sameTime =
                    previous &&
                    !previous.cancelledBy &&
                    !visit.cancelledBy &&
                    previous.arrive === visit.arrive &&
                    previous.depart === visit.depart
                  const date =
                    visit.date === addDays(local!.date, 14)
                      ? "In two weeks"
                      : weekdayCopy(visit.date, local!.date)
                  const reason = visit.cancelledBy
                    ? library.notices.find(
                        (notice) => notice.id === visit.cancelledBy
                      )?.message
                    : null

                  return (
                    <li
                      key={`${visit.date}-${visit.visitId}`}
                      className="border-t py-2"
                      style={{ borderColor: T.border.line }}
                    >
                      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                        {visit.cancelledBy ? (
                          <del style={{ color: T.ink.dim }}>
                            {date}, {visit.arrive}–{visit.depart}
                          </del>
                        ) : sameTime ? (
                          <>
                            <span>{date}</span>
                            <span style={{ color: T.ink.dim }}>Same time</span>
                          </>
                        ) : (
                          <span>
                            {date}, {visit.arrive}–{visit.depart}
                          </span>
                        )}
                      </div>
                      {visit.cancelledBy ? (
                        <p
                          className="m-0 mt-1 text-[13px]"
                          style={{ color: T.accent.danger }}
                        >
                          Not stopping{reason ? ` · ${reason}` : ""}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="m-0" style={{ color: T.ink.dim }}>
                No visits scheduled in the next six months.
              </p>
            )}
          </section>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
              onClick={() => setDrawer(true)}
            >
              View timetable
            </button>
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-[15px] font-semibold hover:bg-(--t-bg-surface)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                Directions
              </a>
            ) : null}
          </div>
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
