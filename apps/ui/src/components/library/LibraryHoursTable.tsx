"use client"

import { Icon } from "@iconify/react"
import {
  OPENING_MODE_LABELS,
  hasOpeningHours,
  type OpeningTimesStaffing,
  effectiveLibraryHours,
  effectiveLibraryWeekHours,
  noticeLocalDate,
  noticeAddDays,
  type LibraryNotice,
} from "@repo/shared-data"
import { useLocale, useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  DAY_ORDER,
  formatDayTimes,
  getOpenStatus,
  timelinePercent,
  timelineWindow,
  type DayKey,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { T } from "@/lib/design-tokens"

const NO_NOTICES: readonly LibraryNotice[] = []

function useNoticeWeekHours(
  hours: OpeningTimesValue | null,
  timezone: string | null,
  notices: readonly LibraryNotice[]
) {
  const [value, setValue] = useState(hours)
  useEffect(() => {
    const update = () => {
      const date = noticeLocalDate(new Date(), timezone)
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
      setValue(
        effectiveLibraryWeekHours(
          hours,
          notices,
          noticeAddDays(date, -(weekday + 6) % 7)
        ) as OpeningTimesValue
      )
    }
    update()
    const timer = setInterval(update, 60_000)

    return () => clearInterval(timer)
  }, [hours, timezone, notices])

  return value
}

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
  timezone: string | null,
  notices: readonly LibraryNotice[]
) {
  const [status, setStatus] = useState<ReturnType<typeof getOpenStatus> | null>(
    null
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- status must only compute client-side (never cache-stale)
    setStatus(getOpenStatus(openingTimes, timezone, new Date(), notices))
    const interval = setInterval(
      () =>
        setStatus(getOpenStatus(openingTimes, timezone, new Date(), notices)),
      60_000
    )

    return () => clearInterval(interval)
  }, [openingTimes, timezone, notices])

  return status
}

const MODE_STYLES: Record<string, string> = {
  staffed: "var(--t-palette-mint-fg)",
  self_service:
    "repeating-linear-gradient(135deg, var(--t-palette-mint-fg) 0 4px, var(--t-palette-mint-bg) 4px 8px)",
  volunteer: "var(--t-palette-amber-fg)",
  appointment:
    "repeating-linear-gradient(90deg, var(--t-ink-low) 0 2px, var(--t-bg-muted) 2px 6px)",
  open: "var(--t-accent-primary)",
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  staffed: "Library staff are on hand for help, enquiries and services.",
  self_service:
    "The building is open without staff. A library card may be needed for entry; check the library’s requirements.",
  volunteer: "Volunteers are on hand. Some services may be limited.",
  appointment:
    "Visits require a booking. Check the library’s booking arrangements before going.",
  open: "Open to visitors; staffing is not recorded.",
}

/** A shared time axis, with each day’s individual opening periods written out. */
export function LibraryHoursTable({
  openingTimes,
  compact = false,
  dashboard = false,
  timezone,
  notices = NO_NOTICES,
}: {
  readonly compact?: boolean
  readonly dashboard?: boolean
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
  readonly notices?: readonly LibraryNotice[]
}) {
  const tUi = useUiTranslations("ui")
  const tPage = useUiTranslations("libraryPage")
  const locale = useLocale()
  const today = useToday(timezone)
  const recordedHours = hasOpeningHours(openingTimes)
  const hours = useNoticeWeekHours(openingTimes, timezone, notices)
  const days = hours?.days
  const hasHours = Boolean(
    days?.some((day) => day.enabled && day.timeframes?.length)
  )

  if (!hasHours && !recordedHours) {
    return (
      <p className="m-0 text-base" style={{ color: T.ink.dim }}>
        Hours not added yet.
      </p>
    )
  }

  const overnight = (days ?? []).some(
    (day) =>
      day.enabled &&
      day.timeframes?.some(
        (frame) => frame.overnight || frame.endTime < frame.startTime
      )
  )
  const window = overnight
    ? { startHour: 0, endHour: 24 }
    : timelineWindow(hours)
  const modes = [
    ...new Set(
      (days ?? [])
        .filter((day) => day.enabled)
        .flatMap((day) =>
          (day.timeframes ?? []).map((frame) => frame.staffing ?? "open")
        )
    ),
  ]
  const weekdayName = (key: DayKey) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 1 + DAY_ORDER.indexOf(key))))
  const hourLabel = (hour: number) =>
    `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`
  const endMinute = (frame: {
    startTime: string
    endTime: string
    overnight?: boolean
  }) => {
    const [hour = 0, minute = 0] = frame.endTime.split(":").map(Number)

    return (
      hour * 60 +
      minute +
      (frame.overnight || frame.endTime < frame.startTime ? 1440 : 0)
    )
  }

  return (
    <div className={dashboard ? "record-hours-table" : undefined}>
      {!compact ? (
        <div
          aria-hidden="true"
          className="hours-time-axis mb-2 flex justify-between px-3 text-xs tabular-nums"
          style={{ color: T.ink.dim }}
        >
          <span>{hourLabel(window.startHour)}</span>
          <span>{hourLabel((window.startHour + window.endHour) / 2)}</span>
          <span>{hourLabel(window.endHour)}</span>
        </div>
      ) : null}
      <ol
        aria-label={`Opening hours by day${timezone ? `, ${timezone} time` : ""}`}
        className={
          compact
            ? "m-0 list-none space-y-1 p-0"
            : "m-0 list-none space-y-2 p-0"
        }
      >
        {DAY_ORDER.map((key) => {
          const day = days?.find((item) => item.day === key)
          const frames = day?.enabled
            ? [...(day.timeframes ?? [])].sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              )
            : []
          const isToday = today === key
          const first = frames[0]
          const last = [...frames].sort(
            (a, b) => endMinute(b) - endMinute(a)
          )[0]
          const range =
            first && last
              ? `${first.startTime}–${last.endTime}${last.overnight || last.endTime < last.startTime ? " · next day" : ""}`
              : tUi("closed")

          return (
            <li
              key={key}
              className={
                compact
                  ? "rounded-xl border px-3 py-2.5"
                  : "rounded-2xl border px-3 py-3"
              }
              style={{
                background: isToday ? T.accent.chip : "transparent",
                borderColor: isToday ? T.border.hi : "transparent",
              }}
            >
              {compact ? (
                <div className="grid grid-cols-[minmax(80px,.85fr)_minmax(0,1.3fr)] gap-3 text-sm leading-relaxed">
                  <span className={isToday ? "font-bold" : "font-semibold"}>
                    {weekdayName(key)}
                    {isToday ? (
                      <span className="block text-xs font-normal">
                        {tPage("today")}
                      </span>
                    ) : null}
                  </span>
                  {frames.length ? (
                    <ul className="m-0 grid list-none gap-2 p-0 text-right">
                      {frames.map((frame) => (
                        <li
                          key={`${frame.startTime}:${frame.endTime}:${frame.staffing ?? ""}`}
                        >
                          <span className="block tabular-nums">
                            {frame.startTime}–{frame.endTime}
                            {frame.overnight || frame.endTime < frame.startTime
                              ? " · next day"
                              : ""}
                          </span>
                          <span
                            className="block text-xs"
                            style={{ color: T.ink.dim }}
                          >
                            {OPENING_MODE_LABELS[
                              (frame.staffing ?? "open") as OpeningTimesStaffing
                            ] ?? "Open"}
                          </span>
                          {frame.note ? (
                            <p
                              className="m-0 mt-1 text-xs leading-relaxed"
                              style={{ color: T.ink.dim }}
                            >
                              {frame.note}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-right" style={{ color: T.ink.dim }}>
                      {tUi("closed")}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-base">
                    <span className={isToday ? "font-bold" : "font-semibold"}>
                      {weekdayName(key)}
                      {isToday ? " (today)" : ""}
                    </span>
                    <span className="tabular-nums" style={{ color: T.ink.dim }}>
                      {dashboard && frames.length > 1
                        ? frames
                            .map(
                              (frame) =>
                                `${frame.startTime}–${frame.endTime}${frame.overnight || frame.endTime < frame.startTime ? " · next day" : ""}`
                            )
                            .join(", ")
                        : range}
                      {dashboard && frames.length === 1 && !first?.note ? (
                        <span className="block text-xs">
                          {OPENING_MODE_LABELS[
                            (first?.staffing ?? "open") as OpeningTimesStaffing
                          ] ?? "Open"}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="relative mt-2 h-2.5 overflow-hidden rounded-full border"
                    style={{ background: T.bg.muted, borderColor: T.border.hi }}
                  >
                    {frames.flatMap((frame, index) => {
                      const left = timelinePercent(frame.startTime, window)
                      const right = timelinePercent(frame.endTime, window)
                      const spans: [number, number][] =
                        frame.overnight || frame.endTime < frame.startTime
                          ? [
                              [left, 100],
                              [0, right],
                            ]
                          : [[left, right]]

                      return spans
                        .filter(([start, end]) => end > start)
                        .map(([start, end], segment) => (
                          <span
                            key={`${index}-${segment}`}
                            className="absolute inset-y-0"
                            style={{
                              left: `${start}%`,
                              width: `${end - start}%`,
                              background:
                                MODE_STYLES[frame.staffing ?? "open"] ??
                                MODE_STYLES.open,
                            }}
                          />
                        ))
                    })}
                  </div>
                  {frames.length > 0 &&
                  (!dashboard ||
                    frames.length > 1 ||
                    frames.some((frame) => frame.note)) ? (
                    <ul className="m-0 mt-2 list-none space-y-1 p-0 text-sm">
                      {frames.map((frame) => (
                        <li
                          key={`${frame.startTime}:${frame.endTime}:${frame.staffing ?? ""}`}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="tabular-nums">
                              {frame.startTime}–{frame.endTime}
                              {frame.overnight ||
                              frame.endTime < frame.startTime
                                ? " · next day"
                                : ""}
                            </span>
                            <span style={{ color: T.ink.dim }}>
                              {OPENING_MODE_LABELS[
                                (frame.staffing ??
                                  "open") as OpeningTimesStaffing
                              ] ?? "Open"}
                            </span>
                          </div>
                          {frame.note ? (
                            <p
                              className="m-0 mt-0.5 text-sm leading-relaxed"
                              style={{ color: T.ink.dim }}
                            >
                              {frame.note}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </li>
          )
        })}
      </ol>
      <details
        className="mt-3 rounded-xl border p-3"
        style={{ borderColor: T.border.line, background: T.bg.surface }}
      >
        <summary className="cursor-pointer text-sm font-semibold">
          What the opening modes mean
        </summary>
        <ul className="m-0 mt-3 grid list-none gap-3 p-0 text-sm sm:grid-cols-2">
          {modes.map((mode) => (
            <li key={mode}>
              <div className="flex items-center gap-2 font-semibold">
                <span
                  aria-hidden="true"
                  className="h-3 w-6 shrink-0 rounded-sm"
                  style={{ background: MODE_STYLES[mode] ?? MODE_STYLES.open }}
                />
                {OPENING_MODE_LABELS[mode as OpeningTimesStaffing] ?? "Open"}
              </div>
              <p
                className="m-0 mt-1 leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                {MODE_DESCRIPTIONS[mode] ?? MODE_DESCRIPTIONS.open}
              </p>
            </li>
          ))}
        </ul>
      </details>
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
  notices = NO_NOTICES,
  operationalStatus,
  prominent = false,
}: {
  readonly prominent?: boolean
  readonly operationalStatus?: string | null
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
  readonly notices?: readonly LibraryNotice[]
}) {
  const status = useOpenStatus(openingTimes, timezone, notices)
  const fixed: Record<string, string> = {
    permanently_closed: "Permanently closed",
    temporarily_closed: "Temporarily closed",
    planned: "Not open yet",
    appointment_only: "Visits by appointment",
  }
  if (operationalStatus && fixed[operationalStatus])
    return (
      <p
        className={
          prominent
            ? "m-0 text-[30px] leading-tight"
            : "m-0 text-sm font-semibold"
        }
        style={{ fontFamily: prominent ? T.font.sans : undefined }}
      >
        {fixed[operationalStatus]}
      </p>
    )
  if (!status || status.state === "unknown")
    return (
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        Current opening status unavailable · check the published hours
      </p>
    )
  const open = status.state === "open"

  return (
    <span
      className={
        prominent
          ? "inline-flex items-center gap-2 text-[30px] leading-tight"
          : "inline-flex items-center gap-1.5 text-sm font-semibold"
      }
      style={{
        color: open ? T.accent.ok : T.accent.danger,
        fontFamily: prominent ? T.font.sans : undefined,
      }}
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
  notices = NO_NOTICES,
}: {
  readonly openingTimes: OpeningTimesValue | null
  readonly timezone: string | null
  readonly notices?: readonly LibraryNotice[]
}) {
  const status = useOpenStatus(openingTimes, timezone, notices)
  // Today and the notice-adjusted hours are only known on the client (the
  // page is static), so both come from one effect: the HTML never bakes in
  // a date, and hydration stays stable around midnight.
  const [fact, setFact] = useState<{
    today: DayKey | null
    hours: OpeningTimesValue | null
    closed: boolean
  } | null>(null)
  useEffect(() => {
    const update = () => {
      const effective = effectiveLibraryHours(
        openingTimes,
        notices,
        noticeLocalDate(new Date(), timezone)
      )

      setFact({
        today: todayKeyInZone(timezone),
        hours: effective.hours as OpeningTimesValue | null,
        closed: effective.closed,
      })
    }
    update()
    const timer = setInterval(update, 60_000)

    return () => clearInterval(timer)
  }, [openingTimes, timezone, notices])
  const today = fact?.today ?? null
  openingTimes = fact ? fact.hours : openingTimes
  const day = today ? openingTimes?.days?.find((d) => d.day === today) : null
  const hasHours = Boolean(
    openingTimes?.days?.some((d) => d.enabled && d.timeframes?.length)
  )
  const dayName = today ? today.charAt(0).toUpperCase() + today.slice(1) : null

  const value = todayFactValue(
    Boolean(fact?.closed),
    today,
    hasHours,
    day,
    status
  )

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
  note,
  className,
}: {
  readonly icon: string
  readonly label: string
  readonly value: string
  readonly note?: string
  readonly className?: string
}) {
  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl px-3.5 py-3 ${className ?? ""}`}
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
        <span className="text-sm" style={{ color: T.ink.dim }}>
          {label}
        </span>
        <span
          className="text-sm leading-snug font-semibold"
          style={{ color: T.ink.base }}
        >
          {value}
        </span>
        {note ? (
          <span
            className="mt-1 text-xs leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            {note}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function todayFactValue(
  closed: boolean,
  today: DayKey | null,
  hasHours: boolean,
  day: Parameters<typeof formatDayTimes>[0] | null,
  status: ReturnType<typeof useOpenStatus>
) {
  let value = "Hours not added yet"
  if (closed && today) value = "Closed today"
  else if (hasHours && today) {
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

  return value
}
