"use client"
import {
  localDateTime,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"

import { StatusBadge } from "@/components/ds"

import { publicLiveCopy } from "./live-copy"
import { useMobileClock } from "./useMobileClock"
import { usePublicMobileLive } from "./usePublicMobileLive"

/**
 * The hero's live badge for a mobile library: "Here now", "On the road",
 * "12 min late" or "Not running today", only while the vehicle is sharing
 * live updates. Nothing renders otherwise, so the open-status badge stays
 * the only status on the row.
 */
export function MobileLiveBadge({
  id,
  tt,
  notices,
  timezone,
  status,
}: {
  readonly id: string
  readonly tt: MobileTimetable | null
  readonly notices: TimetableNotice[]
  readonly timezone: string
  readonly status?: string | null
}) {
  const now = useMobileClock()
  const live = usePublicMobileLive(
    tt ? id : undefined,
    tt ?? {
      version: 1,
      cycle: { weeks: 1, anchor: "1970-01-05" },
      stops: [],
      visits: [],
    },
    notices,
    timezone,
    status
  )
  if (!tt || !live || !now) return null
  if (!["here", "road", "late", "notrunning"].includes(live.kind)) return null
  const copy = publicLiveCopy(live, tt, {
    today: localDateTime(now, timezone).date,
    now,
  })

  return (
    <StatusBadge tone={copy.tone} icon={copy.icon} pulse={copy.pulse}>
      {copy.label}
    </StatusBadge>
  )
}
