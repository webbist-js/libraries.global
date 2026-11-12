"use client"
import {
  publicLiveState,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { StatusBadge } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import { publicLiveCopy } from "./live-copy"
import { useMobileClock } from "./useMobileClock"
import { usePublicMobileLive } from "./usePublicMobileLive"

export function MobileTodayStrip({
  id,
  tt,
  notices,
  timezone,
  status,
}: {
  readonly id: string
  readonly tt: MobileTimetable
  readonly notices: TimetableNotice[]
  readonly timezone: string
  readonly status?: string | null
}) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  const now = useMobileClock(),
    live = usePublicMobileLive(id, tt, notices, timezone, status)
  if (status === "permanently_closed")
    return (
      <p
        className="rounded-[20px] border p-5"
        style={{ borderColor: T.edge.danger }}
      >
        {tStatic("mobile.service_ended")}
      </p>
    )
  if (status === "temporarily_closed")
    return (
      <p
        className="rounded-[20px] border p-5"
        style={{ borderColor: T.edge.warn }}
      >
        {tStatic(
          "mobile.paused_for_now_the_timetable_below_is_shown_as_a_record_of_the_service"
        )}
      </p>
    )
  if (status === "planned")
    return (
      <p>
        {tStatic(
          "mobile.service_planned_check_the_timetable_for_the_recorded_start_dates"
        )}
      </p>
    )
  if (!now)
    return (
      <p
        className="rounded-[20px] border p-5"
        style={{ borderColor: T.border.line }}
      >
        {tStatic("mobile.scheduled_visits_are_shown_below")}
      </p>
    )
  const state =
      live ??
      publicLiveState({
        libraryDocumentId: id,
        tt,
        notices,
        session: null,
        sharesLive: false,
        now,
        tz: timezone,
      }),
    copy = publicLiveCopy(state, tt)

  return (
    <section
      aria-label={tUi("todays_service")}
      className="flex flex-wrap items-center gap-4 rounded-[20px] border p-5"
      style={{
        borderColor: T.edge[copy.tone === "neutral" ? "info" : copy.tone],
        background: T.bg.deep,
      }}
    >
      <StatusBadge tone={copy.tone} pulse={copy.pulse} icon={copy.icon}>
        {copy.label}
      </StatusBadge>
      <p className="m-0" aria-live="polite">
        {copy.sentence}
      </p>
    </section>
  )
}
