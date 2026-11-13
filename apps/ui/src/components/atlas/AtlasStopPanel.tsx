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
import { useTranslations } from "next-intl"
import { useEffect, useState, useContext } from "react"

import { StatusBadge } from "@/components/ds/StatusBadge"
import GlobalLink from "@/components/global/GlobalLink"
import { publicLiveCopy } from "@/components/mobile/live-copy"
import { stopDirections } from "@/components/mobile/mobile-helpers"
import { StopDrawer } from "@/components/mobile/StopDrawer"
import { analyticsAttributes } from "@/lib/analytics-events"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { PublicMobileTimetable } from "@/lib/mobile/types"
import { loadStopTimetable, type MobileStopHit } from "@/lib/mobile-stop-search"
import { timeAgo, weekdayCopy, weekdayName } from "@/lib/staff/format"

import { AtlasAnalysisPanelContext } from "./AtlasAnalysisHeader"

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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")
  const inInspect = useContext(AtlasAnalysisPanelContext)

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
        {!inInspect ? (
          <>
            <div className="min-h-10 pr-14">
              <span
                className="inline-flex min-h-6 items-center gap-2 rounded-full px-3 py-1 text-sm font-bold"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: T.map.stopRing,
                }}
              >
                <Icon aria-hidden="true" icon="mdi:bus-side" width={16} />
                {tStatic("atlas.mobile_library_stop")}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tUi("close_stop_panel")}
              className="absolute top-0 right-0 flex size-10 items-center justify-center rounded-full border bg-(--t-bg-deep) hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.line, color: T.ink.base }}
            >
              <Icon aria-hidden="true" icon="mdi:close" width={20} />
            </button>
            <h2 className="type-h2 mt-2 mb-0">{stop.name}</h2>
          </>
        ) : null}
        <p className="mt-2 mb-0" style={{ color: T.ink.dim }}>
          {stop.where || "No landmark added yet."}
        </p>
      </header>
      <p className="m-0">
        {stop.library_path ? (
          <GlobalLink
            href={stop.library_path}
            {...analyticsAttributes("select_content", {
              interaction_source: "atlas_panel",
              content_type: "library",
              library_document_id: stop.library_document_id,
              view_mode: "map",
            })}
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            {tStatic("atlas.served_by")} {stop.library_name}
          </GlobalLink>
        ) : (
          `Served by ${stop.library_name}`
        )}
      </p>
      {error ? (
        <p role="status">
          {tStatic(
            "atlas.the_timetable_could_not_be_loaded_open_the_library_page_to_try_again"
          )}
        </p>
      ) : !library ? (
        <p role="status">{tStatic("atlas.loading_timetable")}</p>
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
                <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                  {tExisting("editorial.updated")} {updated} by the crew
                </p>
              ) : null}
            </div>
          ) : null}
          <section aria-labelledby="atlas-stop-visits">
            <h3 id="atlas-stop-visits" className="type-h3 m-0 mb-2">
              {tStatic("common.visitsStop")}
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
                      {tStatic("common.day")}
                    </th>
                    <th scope="col" className="pr-2 pb-2 font-bold">
                      {tStatic("common.time")}
                    </th>
                    <th scope="col" className="pb-2 font-bold">
                      {tStatic("atlas.how_often")}
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
                {tStatic("atlas.no_visits_scheduled_for_this_stop")}
              </p>
            )}
          </section>
          <section aria-labelledby="atlas-stop-next">
            <h3 id="atlas-stop-next" className="type-h3 m-0 mb-1">
              {tStatic("common.nextVisits")}
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
                            <span style={{ color: T.ink.dim }}>
                              {tStatic("atlas.same_time")}
                            </span>
                          </>
                        ) : (
                          <span>
                            {date}, {visit.arrive}–{visit.depart}
                          </span>
                        )}
                      </div>
                      {visit.cancelledBy ? (
                        <p
                          className="m-0 mt-1 text-sm"
                          style={{ color: T.accent.danger }}
                        >
                          {tStatic("common.notStopping")}
                          {reason ? ` · ${reason}` : ""}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="m-0" style={{ color: T.ink.dim }}>
                {tStatic("atlas.no_visits_scheduled_in_the_next_six_months")}
              </p>
            )}
          </section>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-(--t-action-primary) px-5 text-base font-semibold text-white transition-colors hover:bg-(--t-action-primary-hover)"
              onClick={() => setDrawer(true)}
              {...analyticsAttributes("mobile_service_action", {
                interaction_source: "atlas_panel",
                action_type: "open",
                library_document_id: stop.library_document_id,
                content_id: stop.id,
              })}
            >
              {tStatic("atlas.view_timetable")}
            </button>
            {directions ? (
              <a
                href={directions}
                {...analyticsAttributes("library_action", {
                  interaction_source: "atlas_panel",
                  action_type: "directions",
                  library_document_id: stop.library_document_id,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-base font-semibold hover:bg-(--t-bg-surface)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                {tStatic("atlas.directions")}
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
          <p className="m-0 font-semibold">
            {tStatic("atlas.no_timetable_added_yet")}
          </p>
          <p className="m-0 mt-1 text-sm" style={{ color: T.ink.dim }}>
            {tStatic(
              "atlas.stops_and_times_appear_here_once_the_library_adds_them"
            )}
          </p>
          {stop.library_path ? (
            <GlobalLink
              href={`${stop.library_path}#stops`}
              {...analyticsAttributes("mobile_service_action", {
                interaction_source: "atlas_panel",
                action_type: "open",
                library_document_id: stop.library_document_id,
                content_id: stop.id,
              })}
              className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              {tStatic("atlas.see_the_library_s_stops_section")}
            </GlobalLink>
          ) : null}
        </div>
      )}
    </section>
  )
}
