"use client"
import {
  addDays,
  cycleWeekOf,
  describeRepeat,
  localDateTime,
  normalizeMobileTimetable,
  occurrences,
  toMinutes,
  WEEKDAYS,
  type LibraryNotice,
  type TimetableNotice,
} from "@repo/shared-data"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds"
import { LibraryNoticeBanners } from "@/components/library/LibraryNoticeBanners"
import { useStaff } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { shortDate, weekdayCopy } from "@/lib/staff/format"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { MobileRouteMap } from "./MobileRouteMap"
import { MobileTodayStrip } from "./MobileTodayStrip"
import { NearestStopFinder } from "./NearestStopFinder"
import { StopDrawer } from "./StopDrawer"
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
  const tt = normalizeMobileTimetable(value)
  const [view, setView] = useState<"day" | "place">("day")
  const [chosenWeek, setChosenWeek] = useState<number | null>(null)
  const [stopId, setStopId] = useState<string | null>(null)
  const staff = useStaff()
  const staffHref = useStaffLibraryHref(id, slug)
  const now = useMobileClock()
  const timetableNotices: TimetableNotice[] = notices
  const today = now ? localDateTime(now, timezone).date : null
  // The tabs open on the week the service is in now, until the reader picks one.
  const thisWeek = tt && today ? cycleWeekOf(tt, today) : null
  const week = chosenWeek ?? thisWeek ?? 1
  const nextVisitOf = nextVisitLookup(tt, timetableNotices, now, timezone)

  return (
    <section
      id="stops"
      className="space-y-6 rounded-[20px] border p-5 sm:p-7"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="m-0 text-3xl" style={{ fontFamily: T.font.serif }}>
          Stops and times
        </h2>
        {timetableUrl ? (
          <a
            href={timetableUrl}
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
      {tt?.visits.length ? (
        <>
          <MobileTodayStrip
            id={id}
            tt={tt}
            notices={timetableNotices}
            timezone={timezone}
            status={status}
          />
          <NearestStopFinder stops={tt.stops} onSelect={setStopId} />
          <div className="flex flex-wrap gap-3">
            <SegmentedControl
              label="Show timetable"
              options={[
                { value: "day", label: "By day" },
                { value: "place", label: "By place" },
              ]}
              value={view}
              onChange={setView}
            />
            {view === "day" && tt.cycle.weeks > 1 ? (
              <SegmentedControl
                label="Cycle week"
                value={String(week)}
                onChange={(value) => setChosenWeek(Number(value))}
                options={Array.from({ length: tt.cycle.weeks }, (_, index) => ({
                  value: String(index + 1),
                  label:
                    thisWeek === index + 1
                      ? `Week ${index + 1} · this week`
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
                  ? `Week ${week} of the published cycle. Monthly and specific-date visits show their own repeat rules.`
                  : "All stops and their published visits."}{" "}
                Times are local to {timezone}.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="py-3">
                    {view === "day" ? "Day" : "Stop"}
                  </th>
                  <th scope="col">{view === "day" ? "Stop" : "Day"}</th>
                  <th scope="col">Time</th>
                  <th scope="col">Repeats</th>
                  <th scope="col">Next visit</th>
                </tr>
              </thead>
              <tbody>
                {tt.visits
                  .filter(
                    (visit) =>
                      view === "place" ||
                      visit.repeat.kind !== "cycle" ||
                      visit.repeat.weeks.includes(week)
                  )
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
                        onClick={() => setStopId(visit.stopId)}
                      >
                        {stop?.name ?? "Stop"}
                      </button>
                    )

                    return (
                      <tr
                        key={visit.id}
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
                        <td className="pr-4">
                          {describeRepeat(visit, tt.cycle)}
                          {visit.validFrom
                            ? ` · from ${shortDate(visit.validFrom)}`
                            : ""}
                          {visit.validTo
                            ? ` · until ${shortDate(visit.validTo)}`
                            : ""}
                        </td>
                        <td className="whitespace-nowrap">
                          {(() => {
                            const next = today ? nextVisitOf(visit.id) : null

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
                ? staffHref("/timetable")
                : "/contribute/index"
            }
          >
            Add the stops and timetable →
          </Link>
        </div>
      )}
    </section>
  )
}
