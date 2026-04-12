"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { cn } from "@/lib/styles"

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
type DayKey = (typeof DAY_ORDER)[number]

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

const STAFFING_CONFIG: Record<
  string,
  {
    label: string
    bar: string
    barText: string
    pill: string
    pillText: string
  }
> = {
  staffed: {
    label: "Staffed",
    bar: "bg-emerald-500/20 border border-emerald-500/30",
    barText: "text-emerald-200",
    pill: "bg-emerald-500/20 border border-emerald-500/30",
    pillText: "text-emerald-200",
  },
  unstaffed: {
    label: "Unstaffed",
    bar: "bg-white/6 border border-white/10",
    barText: "text-white/50",
    pill: "bg-white/6 border border-white/10",
    pillText: "text-white/50",
  },
  self_service: {
    label: "Self-Service",
    bar: "bg-violet-500/15 border border-violet-500/25",
    barText: "text-violet-200",
    pill: "bg-violet-500/15 border border-violet-500/25",
    pillText: "text-violet-200",
  },
  restricted: {
    label: "Restricted",
    bar: "bg-red-500/15 border border-red-500/25",
    barText: "text-red-200",
    pill: "bg-red-500/15 border border-red-500/25",
    pillText: "text-red-200",
  },
}

const DEFAULT_STAFFING_CONFIG = {
  label: "Open",
  bar: "bg-indigo-500/15 border border-indigo-500/25",
  barText: "text-indigo-200",
  pill: "bg-indigo-500/15 border border-indigo-500/25",
  pillText: "text-indigo-200",
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpeningTimeframe {
  startTime: string
  endTime: string
  staffing?: string | null
}

interface OpeningTimesDay {
  day: DayKey
  enabled: boolean
  timeframes: OpeningTimeframe[]
}

interface OpeningTimesValue {
  version: number
  days: OpeningTimesDay[]
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

function to12h(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const suffix = (h ?? 0) >= 12 ? "pm" : "am"
  const hour = (h ?? 0) % 12 || 12

  return `${hour}.${(m ?? 0).toString().padStart(2, "0")}${suffix}`
}

function getTodayKey(): DayKey {
  const index = new Date().getDay()

  return DAY_ORDER[index === 0 ? 6 : index - 1] as DayKey
}

function getStaffingConfig(staffing?: string | null) {
  if (!staffing) return DEFAULT_STAFFING_CONFIG

  return STAFFING_CONFIG[staffing] ?? DEFAULT_STAFFING_CONFIG
}

// ── Timeline segment builder ──────────────────────────────────────────────────

type BarSegment =
  | { type: "gap"; flex: number }
  | { type: "timeframe"; flex: number; tf: OpeningTimeframe }

function buildBarSegments(timeframes: OpeningTimeframe[]): BarSegment[] {
  const dayStart = timeToMinutes(timeframes[0]!.startTime)
  const dayEnd = timeToMinutes(timeframes.at(-1)!.endTime)
  const total = dayEnd - dayStart
  if (total <= 0) return []

  const segments: BarSegment[] = []
  let cursor = dayStart

  for (const tf of timeframes) {
    const tfStart = timeToMinutes(tf.startTime)
    const tfEnd = timeToMinutes(tf.endTime)

    if (tfStart > cursor) {
      segments.push({ type: "gap", flex: (tfStart - cursor) / total })
    }

    segments.push({ type: "timeframe", flex: (tfEnd - tfStart) / total, tf })
    cursor = tfEnd
  }

  return segments
}

// ── Expanded breakdown ────────────────────────────────────────────────────────

function TimeframeBreakdown({
  timeframes,
}: {
  timeframes: OpeningTimeframe[]
}) {
  const segments = buildBarSegments(timeframes)
  const dayStart = timeframes[0]!.startTime
  const dayEnd = timeframes.at(-1)!.endTime

  return (
    <div className="mt-3 space-y-3.5 border-t border-white/8 pt-3.5">
      {/* Proportional timeline bar */}
      <div className="space-y-2">
        <div className="flex items-stretch gap-0">
          {/* Left end-cap */}
          <div className="w-0.5 shrink-0 self-stretch rounded-full bg-white/20" />

          {/* Segments */}
          <div className="flex flex-1 items-stretch gap-1 px-1.5">
            {segments.map((seg, i) =>
              seg.type === "gap" ? (
                <div
                  key={i}
                  style={{ flex: seg.flex }}
                  className="min-w-[6px] rounded-lg bg-white/4"
                />
              ) : (
                <div
                  key={i}
                  style={{ flex: seg.flex }}
                  className={cn(
                    "flex min-w-0 items-center justify-center rounded-xl px-2 py-3",
                    getStaffingConfig(seg.tf.staffing).bar
                  )}
                >
                  <span
                    className={cn(
                      "truncate text-xs font-medium",
                      getStaffingConfig(seg.tf.staffing).barText
                    )}
                  >
                    {getStaffingConfig(seg.tf.staffing).label}
                  </span>
                </div>
              )
            )}
          </div>

          {/* Right end-cap */}
          <div className="w-0.5 shrink-0 self-stretch rounded-full bg-white/20" />
        </div>

        {/* Start / end time labels */}
        <div className="flex justify-between px-1">
          <span className="text-xs font-medium text-white/50">
            {to12h(dayStart)}
          </span>
          <span className="text-xs font-medium text-white/50">
            {to12h(dayEnd)}
          </span>
        </div>
      </div>

      {/* Per-timeframe summary list */}
      <div className="space-y-1.5">
        {timeframes.map((tf, i) => {
          const config = getStaffingConfig(tf.staffing)
          const isPrimary = i === 0 || tf.staffing === "staffed"

          return isPrimary ? (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between rounded-xl px-4 py-2.5",
                config.pill
              )}
            >
              <span className={cn("text-xs font-semibold", config.pillText)}>
                {config.label}
              </span>
              <span className={cn("text-xs font-medium", config.pillText)}>
                {to12h(tf.startTime)} – {to12h(tf.endTime)}
              </span>
            </div>
          ) : (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-0.5"
            >
              <span className="text-xs text-white/40">{config.label}</span>
              <span className="text-xs text-white/40">
                {to12h(tf.startTime)} – {to12h(tf.endTime)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function LibraryOpeningHours({
  openingTimes,
}: {
  readonly openingTimes?: OpeningTimesValue | null
}) {
  const todayKey = getTodayKey()
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(todayKey)

  if (!openingTimes?.days?.length) {
    return (
      <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
        <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
          Opening Hours
        </h2>
        <p className="mt-4 text-sm text-white/40 italic">
          Opening hours not yet available.
        </p>
      </div>
    )
  }

  const daysByKey = new Map(openingTimes.days.map((d) => [d.day, d]))

  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
      <div className="mb-4 flex items-center gap-2">
        <Icon icon="mdi:clock-outline" className="size-4 text-white/40" />
        <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
          Opening Hours
        </h2>
      </div>

      <div className="space-y-1">
        {DAY_ORDER.map((day) => {
          const dayData = daysByKey.get(day)
          const isToday = day === todayKey
          const isOpen =
            dayData?.enabled === true && (dayData.timeframes?.length ?? 0) > 0
          const isExpanded = expandedDay === day

          const toggleExpand = () => {
            if (!isOpen) return
            setExpandedDay(isExpanded ? null : day)
          }

          // Summary: first start to last end
          const firstTf = dayData?.timeframes?.[0]
          const lastTf = dayData?.timeframes?.at(-1)
          const daySummary =
            isOpen && firstTf && lastTf
              ? `${firstTf.startTime} – ${lastTf.endTime}`
              : null

          return (
            <div
              key={day}
              className={cn(
                "rounded-xl transition-colors duration-150",
                isToday ? "bg-white/6" : "",
                isExpanded && !isToday ? "bg-white/4" : "",
                isOpen ? "cursor-pointer hover:bg-white/8" : ""
              )}
              onClick={toggleExpand}
              role={isOpen ? "button" : undefined}
              aria-expanded={isOpen ? isExpanded : undefined}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium",
                      isToday ? "text-white" : "text-white/56"
                    )}
                  >
                    {DAY_LABELS[day]}
                  </span>
                  {isToday ? (
                    <span className="text-[10px] font-semibold tracking-[0.1em] text-emerald-400 uppercase">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <span
                      className={cn(
                        "font-medium",
                        isToday ? "text-white" : "text-white/70"
                      )}
                    >
                      {daySummary}
                    </span>
                  ) : (
                    <span className="text-white/28">Closed</span>
                  )}

                  {isOpen ? (
                    <Icon
                      icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}
                      className={cn(
                        "size-4 shrink-0 transition-transform duration-200",
                        isToday ? "text-white/50" : "text-white/28"
                      )}
                    />
                  ) : null}
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && isOpen ? (
                <div className="px-3 pb-3.5">
                  <TimeframeBreakdown timeframes={dayData!.timeframes} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

LibraryOpeningHours.displayName = "LibraryOpeningHours"

export default LibraryOpeningHours
