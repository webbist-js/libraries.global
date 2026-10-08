"use client"
import {
  publicLiveState,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"

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
  const now = useMobileClock(),
    live = usePublicMobileLive(id, tt, notices, timezone, status)
  if (status === "permanently_closed")
    return (
      <p
        className="rounded-[20px] border p-5"
        style={{ borderColor: T.edge.danger }}
      >
        Service ended.
      </p>
    )
  if (status === "temporarily_closed")
    return (
      <p
        className="rounded-[20px] border p-5"
        style={{ borderColor: T.edge.warn }}
      >
        Paused for now. The timetable below is shown as a record of the service.
      </p>
    )
  if (!now)
    return (
      <p
        className="rounded-[20px] border p-5"
        style={{ borderColor: T.border.line }}
      >
        Scheduled visits are shown below.
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
      aria-label="Today's service"
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
