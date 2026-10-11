"use client"
import {
  describeRepeat,
  diffTimetable,
  summarizeDiff,
  timetableHash,
  type MobileTimetable,
  type MobileVisit,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { DiffCard } from "@/components/ds/DiffCard"
import { Notice } from "@/components/ds/Notice"
import { MobileRouteMap } from "@/components/mobile/MobileRouteMap"
import { T } from "@/lib/design-tokens"
import { shortDate, weekdayName } from "@/lib/staff/format"

const DAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

export function TimetableReviewPanel({
  before,
  after,
  previousHash,
  timezone = "UTC",
}: {
  readonly before: MobileTimetable | null
  readonly after: MobileTimetable | null
  readonly previousHash?: string
  readonly timezone?: string
}) {
  const tUi = useUiTranslations("ui")

  const diff = diffTimetable(before, after),
    stale = previousHash !== undefined && previousHash !== timetableHash(before)
  const visitText = (visit: MobileVisit, tt: MobileTimetable | null) =>
    `${tt?.stops.find((s) => s.id === visit.stopId)?.name ?? "Stop"}: ${DAY_LABEL[visit.day] ?? visit.day} ${visit.arrive}–${visit.depart} · ${tt ? describeRepeat(visit, tt.cycle) : ""}${visit.validFrom ? ` · from ${shortDate(visit.validFrom)}` : ""}${visit.validTo ? ` · until ${shortDate(visit.validTo)}` : ""}`
  const rows = [
    ...diff.stopsAdded.map((stop) => ({
      label: "Stop added",
      now: "No stop",
      suggested: `${stop.name}${stop.where ? ` · ${stop.where}` : ""}`,
    })),
    ...diff.stopsRemoved.map((stop) => ({
      label: "Stop removed",
      now: stop.name,
      suggested: "No longer a stop",
    })),
    ...diff.stopsChanged.map(({ before, after, fields }) => ({
      label: `Stop changed (${fields.join(", ")})`,
      now: `${before.name} · ${before.where}${fields.includes("location") ? ` · ${before.location ? `${before.location.lat}, ${before.location.lng}` : "No pin"}` : ""}`,
      suggested: `${after.name} · ${after.where}${fields.includes("location") ? ` · ${after.location ? `${after.location.lat}, ${after.location.lng}` : "No pin"}` : ""}`,
    })),
    ...diff.visitsAdded.map((visit) => ({
      label: "Visit added",
      now: "No visit",
      suggested: visitText(visit, after),
    })),
    ...diff.visitsRemoved.map((visit) => ({
      label: "Visit removed",
      now: visitText(visit, before),
      suggested: "No longer visiting",
    })),
    ...diff.visitsChanged.map((change) => ({
      label: "Visit changed",
      now: visitText(change.before, before),
      suggested: visitText(change.after, after),
    })),
    ...(diff.cycleChanged
      ? [
          {
            label: "Cycle",
            now: before
              ? `${before.cycle.weeks} weeks · starts ${weekdayName(before.cycle.anchor)} ${shortDate(before.cycle.anchor)}`
              : "No timetable",
            suggested: after
              ? `${after.cycle.weeks} weeks · starts ${weekdayName(after.cycle.anchor)} ${shortDate(after.cycle.anchor)}`
              : "No timetable",
          },
        ]
      : []),
  ]
  const moved =
    diff.stopsChanged.some((stop) => stop.fields.includes("location")) ||
    diff.stopsAdded.some((stop) => stop.location) ||
    diff.stopsRemoved.some((stop) => stop.location)

  return (
    <div className="space-y-4">
      {stale && (
        <div role="alert">
          <Notice
            icon="mdi:alert-outline"
            tone="warn"
            title={tUi("the_timetable_changed_after_this_was_suggested")}
          >
            <p className="m-0" style={{ color: T.ink.base }}>
              Decline this suggestion; it cannot be applied to the current
              timetable.
            </p>
          </Notice>
        </div>
      )}
      <DiffCard
        title={summarizeDiff(diff)}
        rows={rows}
        byline="Timetable changes"
        actions={null}
      />
      {moved && (
        <details className="group">
          <summary
            className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border bg-white px-4 text-[14px] font-semibold hover:bg-(--t-bg-surface)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            <span aria-hidden="true" className="group-open:hidden">
              Compare stop pins
            </span>
            <span aria-hidden="true" className="hidden group-open:inline">
              Hide stop pins
            </span>
            <span className="sr-only">Compare stop pins</span>
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {before && (
              <section>
                <h4 className="m-0 mb-2 text-[15px] font-semibold">
                  Current pins
                </h4>
                <MobileRouteMap
                  tt={before}
                  notices={[]}
                  timezone={timezone}
                  compact
                />
              </section>
            )}
            {after && (
              <section>
                <h4 className="m-0 mb-2 text-[15px] font-semibold">
                  Suggested pins
                </h4>
                <MobileRouteMap
                  tt={after}
                  notices={[]}
                  timezone={timezone}
                  compact
                />
              </section>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
