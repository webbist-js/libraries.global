"use client"
import {
  addDays,
  describeRepeat,
  localDateTime,
  occurrences,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { Sheet } from "@/components/ds"
import { analyticsAttributes } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { weekdayCopy } from "@/lib/staff/format"

import { stopDirections } from "./mobile-helpers"
import { useMobileClock } from "./useMobileClock"

export function StopDrawer({
  id,
  name,
  tt,
  notices,
  timezone,
  stopId,
  onClose,
  correctionHref,
}: {
  readonly id: string
  readonly name: string
  readonly tt: MobileTimetable
  readonly notices: TimetableNotice[]
  readonly timezone: string
  readonly stopId: string | null
  readonly onClose: () => void
  /** Where "Suggest a correction for this stop" goes. */
  readonly correctionHref?: string
}) {
  const tUi = useUiTranslations("ui")

  const now = useMobileClock(),
    stop = tt.stops.find((row) => row.id === stopId),
    date = now ? localDateTime(now, timezone).date : null
  const next =
    stop && date
      ? occurrences(tt, notices, date, addDays(date, 183))
          .filter((row) => row.stopId === stop.id)
          .slice(0, 4)
      : []
  const directions = stop ? stopDirections(stop) : null

  return (
    <Sheet
      open={!!stop}
      onClose={onClose}
      side="right"
      title={stop?.name ?? "Stop"}
    >
      {stop ? (
        <>
          <p className="m-0" style={{ color: T.ink.dim }}>
            {stop.where || "No landmark added yet."}
          </p>
          <p className="mt-1 text-sm" style={{ color: T.ink.dim }}>
            Mobile library · {name}
          </p>
          <ul className="list-none p-0">
            {tt.visits
              .filter((visit) => visit.stopId === stop.id)
              .map((visit) => (
                <li className="py-2" key={visit.id}>
                  {describeRepeat(visit, tt.cycle)} · {visit.arrive}–
                  {visit.depart}
                </li>
              ))}
          </ul>
          <h3 className="type-h3 mt-4 mb-2">Next visits</h3>
          {next.length ? (
            <table className="w-full text-left">
              <caption className="sr-only">
                Upcoming visits to {stop.name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">{tUi("status")}</th>
                </tr>
              </thead>
              <tbody>
                {next.map((visit) => {
                  const cancelled = Boolean(visit.cancelledBy)
                  const reason = cancelled
                    ? notices.find((notice) => notice.id === visit.cancelledBy)
                        ?.message
                    : null

                  return (
                    <tr key={`${visit.date}-${visit.visitId}`}>
                      <th scope="row" className="py-2 pr-3 font-normal">
                        {cancelled ? (
                          <del style={{ color: T.ink.dim }}>
                            {weekdayCopy(visit.date, date!)}
                          </del>
                        ) : (
                          weekdayCopy(visit.date, date!)
                        )}
                      </th>
                      <td className="pr-3">
                        {cancelled ? (
                          <del style={{ color: T.ink.dim }}>
                            {visit.arrive}–{visit.depart}
                          </del>
                        ) : (
                          `${visit.arrive}–${visit.depart}`
                        )}
                      </td>
                      <td>
                        {cancelled ? (
                          <span style={{ color: T.accent.danger }}>
                            Not stopping{reason ? ` · ${reason}` : ""}
                          </span>
                        ) : (
                          "Scheduled"
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p>
              {now
                ? "No visits scheduled in the next six months."
                : "Visit dates appear when the page is ready."}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-4">
            {directions ? (
              <a
                className="inline-flex min-h-11 items-center font-semibold underline"
                style={{ color: T.accent.primary }}
                href={directions}
                {...analyticsAttributes("library_action", {
                  interaction_source: "mobile_timetable",
                  action_type: "directions",
                  library_document_id: id,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Directions ↗
              </a>
            ) : null}
            <a
              className="inline-flex min-h-11 items-center font-semibold underline"
              style={{ color: T.accent.primary }}
              href={`/api/mobile/${id}/calendar.ics?stop=${stop.id}`}
              {...analyticsAttributes("mobile_service_action", {
                interaction_source: "mobile_timetable",
                action_type: "ics_handoff",
                library_document_id: id,
                content_id: stop.id,
              })}
            >
              Download six months of visits (.ics)
            </a>
          </div>
          <p className="text-sm" style={{ color: T.ink.dim }}>
            A downloaded calendar is a snapshot. Check this page for changes
            before travelling.
          </p>
          {correctionHref ? (
            <p className="mt-4 text-sm">
              <Link
                href={correctionHref}
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Suggest a correction for this stop
              </Link>
            </p>
          ) : null}
        </>
      ) : null}
    </Sheet>
  )
}
