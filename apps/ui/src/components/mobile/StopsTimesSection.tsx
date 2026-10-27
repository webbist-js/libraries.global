"use client"

import {
  addDays,
  describeRepeat,
  localDateTime,
  normalizeMobileTimetable,
  occurrences,
  toMinutes,
  WEEKDAYS,
  type LibraryNotice,
  type TimetableNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds"
import { OpenCorrectionLink } from "@/components/library/LibraryCorrection"
import { LibraryNoticeBanners } from "@/components/library/LibraryNoticeBanners"
import { useStaff } from "@/lib/access-client"
import { analyticsAttributes, pushAnalyticsEvent } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { shortDate, weekdayCopy } from "@/lib/staff/format"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { MobileRouteMap } from "./MobileRouteMap"
import { NearestStopFinder } from "./NearestStopFinder"
import { StopDrawer } from "./StopDrawer"
import { timetablePresentation } from "./timetable-presentation"
import { useMobileClock } from "./useMobileClock"

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

/**
 * The next uncancelled visit of each visit id, from now: today's only if it
 * hasn't left yet. Occurrences come in date order, so the first match wins.
 */
function nextVisitLookup(
  tt: ReturnType<typeof normalizeMobileTimetable>,
  notices: TimetableNotice[],
  now: Date | null,
  timezone: string
): (visitId: string) => ReturnType<typeof occurrences>[number] | null {
  if (!tt || !now) return () => null
  const local = localDateTime(now, timezone)
  const upcoming = occurrences(
    tt,
    notices,
    local.date,
    addDays(local.date, 183)
  )
  const byVisit = new Map<string, (typeof upcoming)[number]>()
  for (const o of upcoming) {
    if (
      !o.cancelledBy &&
      !byVisit.has(o.visitId) &&
      (o.date > local.date || toMinutes(o.depart) >= local.minute)
    )
      byVisit.set(o.visitId, o)
  }

  return (visitId: string) => byVisit.get(visitId) ?? null
}

export function StopsTimesSection({
  id,
  name,
  value,
  timezone,
  status,
  notices,
  timetableUrl,
  slug,
}: {
  readonly id: string
  readonly name: string
  readonly value: unknown
  readonly timezone: string
  readonly status?: string | null
  readonly notices: LibraryNotice[]
  readonly timetableUrl?: string | null
  /** The library's slug, for "Suggest a correction for this stop". */
  readonly slug?: string
}) {
  const tUi = useUiTranslations("ui")

  const tt = normalizeMobileTimetable(value)
  const [view, setView] = useState<"day" | "place">("day")
  const [chosenWeek, setChosenWeek] = useState<{
    week: number
    start: string
  } | null>(null)
  const [stopId, setStopId] = useState<string | null>(null)
  const staff = useStaff()
  const staffHref = useStaffLibraryHref(id, slug)
  const now = useMobileClock()
  const timetableNotices: TimetableNotice[] = notices
  const today = now ? localDateTime(now, timezone).date : null
  const presentation =
    tt && now
      ? timetablePresentation(tt, timetableNotices, now, timezone)
      : null
  const week = chosenWeek?.week ?? presentation?.week ?? 1
  const start = chosenWeek?.start ?? presentation?.monday ?? tt?.cycle.anchor
  const nextVisitOf = nextVisitLookup(tt, timetableNotices, now, timezone)
  const publishedRows = (tt?.visits ?? []).map((visit) => ({
    ...visit,
    actualDate: null as string | null,
    cancelled: false,
  }))
  const shownRows =
    tt && start && view === "day"
      ? occurrences(tt, timetableNotices, start, addDays(start, 6)).flatMap(
          (occurrence) => {
            const visit = tt.visits.find(
              (item) => item.id === occurrence.visitId
            )

            return visit
              ? [
                  {
                    ...visit,
                    arrive: occurrence.arrive,
                    depart: occurrence.depart,
                    actualDate: occurrence.date,
                    cancelled: Boolean(occurrence.cancelledBy),
                  },
                ]
              : []
          }
        )
      : publishedRows
  const repeats = new Set(
    shownRows.map(
      (visit) =>
        `${describeRepeat(visit, tt!.cycle)}${visit.validFrom ? ` · from ${shortDate(visit.validFrom)}` : ""}${visit.validTo ? ` · until ${shortDate(visit.validTo)}` : ""}`
    )
  )
  const sharedRepeat = repeats.size === 1 ? [...repeats][0] : null

  return (
    <section
      id="stops"
      className="space-y-6 rounded-[20px] border p-5 sm:p-7"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="type-h2 m-0">Stops and times</h2>
        {timetableUrl ? (
          <a
            href={timetableUrl}
            {...analyticsAttributes("mobile_service_action", {
              interaction_source: "mobile_timetable",
              action_type: "open",
              library_document_id: id,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-semibold underline"
            style={{ color: T.accent.primary }}
          >
            Official timetable ↗
          </a>
        ) : null}
      </div>
      <LibraryNoticeBanners notices={notices} timezone={timezone} />
      {presentation?.expired ? (
        <p role="status">
          All recorded visits have ended.{" "}
          <OpenCorrectionLink category="Stops & times">
            Suggest an updated timetable
          </OpenCorrectionLink>
        </p>
      ) : null}
      {tt?.visits.length ? (
        <>
          {presentation?.warning ? (
            <p role="status" className="rounded-xl border p-4 text-sm">
              The published timetable ends on {shortDate(presentation.warning)}.
              A current timetable would help visitors plan ahead.
            </p>
          ) : null}
          <NearestStopFinder stops={tt.stops} onSelect={setStopId} />
          <div className="flex flex-wrap gap-3">
            <SegmentedControl
              label={tUi("show_timetable")}
              options={[
                { value: "day", label: "By day" },
                { value: "place", label: tUi("by_place") },
              ]}
              value={view}
              onChange={setView}
            />
            {view === "day" && tt.cycle.weeks > 1 ? (
              <SegmentedControl
                label={tUi("cycle_week")}
                value={String(week)}
                onChange={(value) => {
                  const target = Number(value)
                  if (presentation)
                    setChosenWeek({
                      week: target,
                      start: presentation.weekStart(target),
                    })
                }}
                options={Array.from({ length: tt.cycle.weeks }, (_, index) => ({
                  value: String(index + 1),
                  label: presentation
                    ? `Week ${index + 1} · ${shortDate(presentation.weekStart(index + 1))}–${shortDate(addDays(presentation.weekStart(index + 1), 6))}`
                    : `Week ${index + 1}`,
                }))}
              />
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-96 text-left">
              <caption
                className="text-left text-sm"
                style={{ color: T.ink.dim }}
              >
                {view === "day"
                  ? `Week ${week}: ${start ? `${shortDate(start)}–${shortDate(addDays(start, 6))}` : "published cycle"}.`
                  : "All stops and their published visits."}{" "}
                Times are local to {timezone}.{" "}
                {sharedRepeat ? `Repeats: ${sharedRepeat}.` : ""}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="py-3">
                    {view === "day" ? "Day" : "Stop"}
                  </th>
                  <th scope="col">{view === "day" ? "Stop" : "Day"}</th>
                  <th scope="col">Time</th>
                  {sharedRepeat ? null : <th scope="col">Repeats</th>}
                  <th scope="col">
                    {view === "day" ? "Visit date" : "Next visit"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownRows
                  .sort((a, b) =>
                    view === "place"
                      ? (
                          tt.stops.find((s) => s.id === a.stopId)?.name ?? ""
                        ).localeCompare(
                          tt.stops.find((s) => s.id === b.stopId)?.name ?? ""
                        ) ||
                        WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) ||
                        a.arrive.localeCompare(b.arrive)
                      : WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) ||
                        a.arrive.localeCompare(b.arrive)
                  )
                  .map((visit) => {
                    const stop = tt.stops.find((row) => row.id === visit.stopId)
                    const stopButton = (
                      <button
                        type="button"
                        className="min-h-11 text-left font-semibold underline underline-offset-2"
                        style={{ color: T.accent.primary }}
                        onClick={() => {
                          pushAnalyticsEvent("mobile_service_action", {
                            interaction_source: "mobile_timetable",
                            action_type: "select_stop",
                            library_document_id: id,
                            content_id: visit.stopId,
                          })
                          setStopId(visit.stopId)
                        }}
                      >
                        {stop?.name ?? "Stop"}
                      </button>
                    )

                    return (
                      <tr
                        key={`${visit.id}-${visit.actualDate ?? "published"}`}
                        className="border-t"
                        style={{ borderColor: T.border.divider }}
                      >
                        <th
                          scope="row"
                          className="py-2 pr-4 text-left font-normal"
                        >
                          {view === "day"
                            ? days[WEEKDAYS.indexOf(visit.day)]
                            : stopButton}
                        </th>
                        <td className="pr-4">
                          {view === "day"
                            ? stopButton
                            : days[WEEKDAYS.indexOf(visit.day)]}
                        </td>
                        <td className="pr-4 whitespace-nowrap">
                          {visit.arrive}–{visit.depart}
                        </td>
                        {sharedRepeat ? null : (
                          <td className="pr-4">
                            {describeRepeat(visit, tt.cycle)}
                            {visit.validFrom
                              ? ` · from ${shortDate(visit.validFrom)}`
                              : ""}
                            {visit.validTo
                              ? ` · until ${shortDate(visit.validTo)}`
                              : ""}
                          </td>
                        )}
                        <td className="whitespace-nowrap">
                          {(() => {
                            const next = today ? nextVisitOf(visit.id) : null

                            if (visit.actualDate)
                              return `${shortDate(visit.actualDate)}${visit.cancelled ? " · cancelled" : ""}`

                            return next
                              ? `${weekdayCopy(next.date, today!)}, ${next.arrive}`
                              : today
                                ? "—"
                                : ""
                          })()}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <MobileRouteMap
            libraryDocumentId={id}
            status={status}
            tt={tt}
            notices={timetableNotices}
            timezone={timezone}
            onStop={setStopId}
            selectedStop={stopId}
            date={start}
            caption={`${tt.stops.length} unique stops across the published cycle; the line shows the first active service on or after ${start ? shortDate(start) : "today"}.`}
          />
          <StopDrawer
            id={id}
            name={name}
            tt={tt}
            notices={timetableNotices}
            timezone={timezone}
            stopId={stopId}
            onClose={() => setStopId(null)}
            correctionHref={slug ? `/contribute/correct/${slug}` : undefined}
          />
        </>
      ) : (
        <div>
          <p className="m-0 mb-2 font-semibold">Stops not added yet</p>
          <Link
            className="inline-flex min-h-11 items-center font-semibold underline"
            style={{ color: T.accent.primary }}
            href={
              staff.can("edit", id)
                ? staffHref("/edit?step=timetable")
                : `/contribute?${new URLSearchParams({ action: "correction", library: slug ?? "", name, category: "Stops & times" })}#start`
            }
          >
            Add the stops and timetable →
          </Link>
        </div>
      )}
    </section>
  )
}
