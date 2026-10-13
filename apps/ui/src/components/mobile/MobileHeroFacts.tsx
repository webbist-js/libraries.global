"use client"
import {
  cycleWeekOf,
  dayRoute,
  localDateTime,
  scheduleState,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { weekdayCopy } from "@/lib/staff/format"

import { timetablePresentation } from "./timetable-presentation"
import { useMobileClock } from "./useMobileClock"

export function MobileHeroFacts({
  tt,
  notices,
  timezone,
  status,
}: {
  readonly tt: MobileTimetable | null
  readonly notices: TimetableNotice[]
  readonly status?: string | null
  readonly timezone: string
}) {
  const tUi = useUiTranslations("ui")

  const now = useMobileClock(),
    local = now && localDateTime(now, timezone),
    today =
      tt && local
        ? dayRoute(tt, notices, local.date).filter((row) => !row.cancelledBy)
        : []
  const state = tt && now ? scheduleState(tt, notices, now, timezone) : null
  const next = state && "nextService" in state ? state.nextService : null
  const presentation =
    tt && now ? timetablePresentation(tt, notices, now, timezone) : null

  return (
    <dl className="m-0 grid gap-3 sm:grid-cols-2">
      <div
        className="rounded-[20px] border p-4"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <dt className="m-0 text-sm" style={{ color: T.ink.dim }}>
          Today
        </dt>
        <dd className="m-0 mt-1 font-semibold">
          {status === "permanently_closed"
            ? "Service ended"
            : status === "temporarily_closed"
              ? "Service paused"
              : status === "planned"
                ? "Service planned"
                : !tt
                  ? "Stops not added yet"
                  : !local
                    ? "See the timetable below"
                    : today.length
                      ? `Week ${cycleWeekOf(tt, local.date)} · ${today.length} stops · ${today[0]!.arrive}–${today.at(-1)!.depart}`
                      : next
                        ? `Next: ${weekdayCopy(next.date, local.date)}, ${next.arrive} at ${tt.stops.find((stop) => stop.id === next.stopId)?.name ?? "the next stop"}`
                        : "No service today"}
        </dd>
      </div>
      <div
        className="rounded-[20px] border p-4"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <dt className="m-0 text-sm" style={{ color: T.ink.dim }}>
          {tUi("timetable")}
        </dt>
        <dd className="m-0 mt-1 font-semibold">
          {tt
            ? `${tt.cycle.weeks}-week cycle${presentation ? ` · next visits in Week ${presentation.week}` : ""}`
            : "Not added yet"}
        </dd>
      </div>
    </dl>
  )
}
