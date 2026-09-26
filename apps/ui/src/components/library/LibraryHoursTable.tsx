"use client"

import { useEffect, useState } from "react"

import {
  DAY_LABELS,
  DAY_ORDER,
  formatDayTimes,
  getOpenStatus,
  type DayKey,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { T } from "@/lib/design-tokens"

function todayKeyInZone(timezone: string | null | undefined): DayKey | null {
  try {
    const weekday = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone ?? undefined,
      weekday: "long",
    })
      .format(new Date())
      .toLowerCase()

    return DAY_ORDER.includes(weekday as DayKey) ? (weekday as DayKey) : null
  } catch {
    return null
  }
}

/**
 * POC hours table — today's row highlighted lavender + bold.
 * Today-detection runs after mount so the statically cached HTML never
 * bakes in a stale day.
 */
export function LibraryHoursTable({
  openingTimes,
  timezone,
}: {
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
}) {
  const [today, setToday] = useState<DayKey | null>(null)
  useEffect(() => {
    setToday(todayKeyInZone(timezone))
  }, [timezone])

  const days = openingTimes?.days
  const hasHours = Boolean(days?.some((d) => d.enabled && d.timeframes?.length))

  if (!hasHours) {
    return (
      <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
        Hours not added yet.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse text-[16px]">
      <tbody>
        {DAY_ORDER.map((key) => {
          const day = days?.find((d) => d.day === key)
          const isToday = today === key

          return (
            <tr
              key={key}
              style={{
                background: isToday ? T.accent.chip : "transparent",
              }}
            >
              <th
                scope="row"
                className="rounded-l-lg px-2 py-[7px] text-left"
                style={{ fontWeight: isToday ? 700 : 400, color: T.ink.base }}
              >
                {DAY_LABELS[key]}
                {isToday ? " (today)" : ""}
              </th>
              <td
                className="rounded-r-lg px-2 py-[7px] text-right"
                style={{ fontWeight: isToday ? 700 : 400, color: T.ink.base }}
              >
                {formatDayTimes(day)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Live open/closed pill — client-computed so it is never cache-stale.
 * Shows the neutral "Hours not added yet" state when no data exists.
 */
export function LibraryOpenStatusBadge({
  openingTimes,
  timezone,
}: {
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
}) {
  const [status, setStatus] = useState<ReturnType<typeof getOpenStatus> | null>(
    null
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- status must only compute client-side (never cache-stale)
    setStatus(getOpenStatus(openingTimes, timezone))
    const interval = setInterval(
      () => setStatus(getOpenStatus(openingTimes, timezone)),
      60_000
    )

    return () => clearInterval(interval)
  }, [openingTimes, timezone])

  if (!status) return null

  const palette =
    status.state === "open"
      ? { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" }
      : { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" }

  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[14px] font-semibold"
      style={{ background: palette.bg, color: palette.fg }}
    >
      <LibIcon d={LIB_ICONS.clock} size={16} />
      {status.label}
    </span>
  )
}
