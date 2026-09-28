"use client"

import { Icon } from "@iconify/react"
import { Fragment, useEffect, useState } from "react"

import {
  DAY_ORDER,
  DAY_SHORT,
  formatDayTimes,
  getOpenStatus,
  hasStaffingDetail,
  timelinePercent,
  timelineWindow,
  type DayKey,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
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

/** Today's key, set after mount so the static HTML never bakes in a day. */
function useToday(timezone: string | null) {
  const [today, setToday] = useState<DayKey | null>(null)
  useEffect(() => {
    setToday(todayKeyInZone(timezone))
  }, [timezone])

  return today
}

/** Live open/closed status, recomputed every minute on the client. */
function useOpenStatus(
  openingTimes: OpeningTimesValue | null,
  timezone: string | null
) {
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

  return status
}

const STAFFED = "var(--tint-public-fg)"
// Self-service: striped, so it isn't told apart by colour alone.
const SELF_SERVICE = `repeating-linear-gradient(135deg, ${STAFFED} 0 2px, color-mix(in srgb, ${STAFFED} 40%, white) 2px 5px)`

/**
 * Opening hours as a week of bars along a shared time axis (a semantic
 * table: one row per day). Today's row is highlighted after mount.
 */
export function LibraryHoursTable({
  openingTimes,
  timezone,
}: {
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
}) {
  const today = useToday(timezone)
  const days = openingTimes?.days
  const hasHours = Boolean(days?.some((d) => d.enabled && d.timeframes?.length))

  if (!hasHours) {
    return (
      <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
        Hours not added yet.
      </p>
    )
  }

  const window = timelineWindow(openingTimes)
  const staffing = hasStaffingDetail(openingTimes)
  const span = window.endHour - window.startHour
  const step = span <= 8 ? 2 : span <= 14 ? 4 : 6
  const ticks: number[] = []
  for (let h = window.startHour; h < window.endHour; h += step) ticks.push(h)
  ticks.push(window.endHour)
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

  return (
    <div>
      <div
        aria-hidden="true"
        className="mb-2 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[12.5px]"
        style={{ color: T.ink.dim }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-3.5 rounded-full"
            style={{ background: STAFFED }}
          />
          {staffing ? "Staffed" : "Open"}
        </span>
        {staffing ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-3.5 rounded-full"
              style={{ background: SELF_SERVICE }}
            />
            Self-service
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-3.5 rounded-full"
            style={{ background: T.bg.muted2 }}
          />
          Closed
        </span>
      </div>

      <table className="w-full border-collapse text-[14.5px]">
        <caption className="sr-only">
          Opening hours by day{timezone ? `, ${timezone} time` : ""}
        </caption>
        <thead>
          <tr>
            <td className="w-[88px]" />
            <td aria-hidden="true" className="relative h-5 px-1">
              {ticks.map((h) => (
                <span
                  key={h}
                  className="absolute top-0 -translate-x-1/2 text-[11.5px] tabular-nums"
                  style={{
                    left: `${((h - window.startHour) / span) * 100}%`,
                    color: T.ink.low,
                  }}
                >
                  {hh(h)}
                </span>
              ))}
            </td>
          </tr>
        </thead>
        <tbody>
          {DAY_ORDER.map((key) => {
            const day = days?.find((d) => d.day === key)
            const frames = day?.enabled ? (day.timeframes ?? []) : []
            const isToday = today === key

            return (
              <tr
                key={key}
                style={{ background: isToday ? T.accent.chip : "transparent" }}
              >
                <th
                  scope="row"
                  className="rounded-l-xl py-2 pr-2 pl-2.5 text-left align-top whitespace-nowrap"
                  style={{
                    fontWeight: isToday ? 700 : 500,
                    color: T.ink.base,
                  }}
                >
                  {DAY_SHORT[key]}
                  {isToday ? " (today)" : ""}
                </th>
                <td className="rounded-r-xl py-2 pr-2.5 pl-1">
                  <span
                    aria-hidden="true"
                    className="relative mt-1.5 block h-2 overflow-hidden rounded-full"
                    style={{ background: T.bg.muted2 }}
                  >
                    {frames.map((tf) => {
                      const left = timelinePercent(tf.startTime, window)
                      const right = timelinePercent(tf.endTime, window)

                      return (
                        <span
                          key={`${tf.startTime}-${tf.endTime}`}
                          className="absolute inset-y-0 rounded-full"
                          style={{
                            left: `${left}%`,
                            width: `calc(${right - left}% - 2px)`,
                            background:
                              tf.staffing === "self_service"
                                ? SELF_SERVICE
                                : STAFFED,
                          }}
                        />
                      )
                    })}
                  </span>
                  <span
                    className="mt-1 block text-[13.5px] leading-snug tabular-nums"
                    style={{
                      color: frames.length ? T.ink.base : T.ink.dim,
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {frames.length === 0
                      ? "Closed"
                      : frames.map((tf, i) => (
                          <Fragment key={`${tf.startTime}-${tf.endTime}`}>
                            {i > 0 ? ", " : ""}
                            {tf.startTime}–{tf.endTime}
                            {staffing && tf.staffing === "self_service" ? (
                              <span
                                style={{ color: T.ink.dim, fontWeight: 400 }}
                              >
                                {" "}
                                self-service
                              </span>
                            ) : null}
                          </Fragment>
                        ))}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Live open/closed status for the hero — colour, icon and text. Renders
 * nothing until mounted, and nothing when no hours exist (the hours card
 * says so instead).
 */
export function LibraryOpenStatusBadge({
  openingTimes,
  timezone,
}: {
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
}) {
  const status = useOpenStatus(openingTimes, timezone)
  if (!status || status.state === "unknown") return null
  const open = status.state === "open"

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold"
      style={{ color: open ? T.accent.ok : T.accent.danger }}
    >
      <Icon
        aria-hidden="true"
        height={16}
        icon={open ? "mdi:clock-check-outline" : "mdi:clock-remove-outline"}
        width={16}
      />
      <span style={{ color: T.ink.base }}>{status.label}</span>
    </span>
  )
}

/** The hero's "Today" fact card: today's hours and whether it's open now. */
export function LibraryTodayFact({
  openingTimes,
  timezone,
}: {
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
}) {
  const today = useToday(timezone)
  const status = useOpenStatus(openingTimes, timezone)
  const day = today ? openingTimes?.days?.find((d) => d.day === today) : null
  const hasHours = Boolean(
    openingTimes?.days?.some((d) => d.enabled && d.timeframes?.length)
  )
  const dayName = today ? today.charAt(0).toUpperCase() + today.slice(1) : null

  let value = "Hours not added yet"
  if (hasHours && today) {
    const times = formatDayTimes(day ?? undefined)
    const now =
      status?.state === "open"
        ? "open now"
        : status?.state === "closed"
          ? "closed now"
          : null
    value =
      times === "Closed" ? "Closed today" : `${times}${now ? ` · ${now}` : ""}`
  } else if (hasHours) {
    value = "…"
  }

  return (
    <FactCard
      icon="mdi:clock-outline"
      label={dayName ? `Today (${dayName})` : "Today"}
      value={value}
    />
  )
}

/** Small white fact card used in the hero. Server-safe markup. */
export function FactCard({
  icon,
  label,
  value,
}: {
  readonly icon: string
  readonly label: string
  readonly value: string
}) {
  return (
    <div
      className="flex min-w-0 items-start gap-3 rounded-2xl px-3.5 py-3"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: T.bg.muted, color: T.ink.dim }}
      >
        <Icon height={17} icon={icon} width={17} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[12.5px]" style={{ color: T.ink.dim }}>
          {label}
        </span>
        <span
          className="text-[14.5px] leading-snug font-semibold"
          style={{ color: T.ink.base }}
        >
          {value}
        </span>
      </span>
    </div>
  )
}
