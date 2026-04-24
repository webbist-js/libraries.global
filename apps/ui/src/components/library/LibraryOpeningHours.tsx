"use client"

import { useState } from "react"

import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { T } from "@/lib/design-tokens"
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

// Fixed day scale: 07:00 – 22:00 (for proportional bar rendering)
const SCALE_START = 7 * 60 // 420 min
const SCALE_END = 22 * 60 // 1320 min
const SCALE_TOTAL = SCALE_END - SCALE_START // 900 min

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function getWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)

  return Math.ceil(
    ((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7
  )
}

// ── Compact proportional bar ──────────────────────────────────────────────────

function DayBar({ timeframes }: { timeframes: OpeningTimeframe[] }) {
  return (
    <div
      style={{
        position: "relative",
        height: "6px",
        borderRadius: "999px",
        background: "rgba(255,255,255,.08)",
        overflow: "hidden",
      }}
    >
      {timeframes.map((tf, i) => {
        const start = Math.max(timeToMinutes(tf.startTime), SCALE_START)
        const end = Math.min(timeToMinutes(tf.endTime), SCALE_END)
        if (end <= start) return null
        const left = ((start - SCALE_START) / SCALE_TOTAL) * 100
        const width = ((end - start) / SCALE_TOTAL) * 100

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${left}%`,
              width: `${width}%`,
              borderRadius: "999px",
              background: "rgba(110,231,183,.7)",
            }}
          />
        )
      })}
    </div>
  )
}

// ── Expanded breakdown ────────────────────────────────────────────────────────

function ExpandedBreakdown({ timeframes }: { timeframes: OpeningTimeframe[] }) {
  const dayStart = timeframes[0]!.startTime
  const dayEnd = timeframes.at(-1)!.endTime

  return (
    <div
      style={{
        marginTop: "12px",
        paddingTop: "12px",
        borderTop: `1px solid ${T.border.line}`,
      }}
    >
      {/* Full bar */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            position: "relative",
            height: "28px",
            borderRadius: "8px",
            background: "rgba(255,255,255,.04)",
            overflow: "hidden",
            display: "flex",
          }}
        >
          {timeframes.map((tf, i) => {
            const start = Math.max(timeToMinutes(tf.startTime), SCALE_START)
            const end = Math.min(timeToMinutes(tf.endTime), SCALE_END)
            if (end <= start) return null
            const left = ((start - SCALE_START) / SCALE_TOTAL) * 100
            const width = ((end - start) / SCALE_TOTAL) * 100
            const isStaffed = tf.staffing === "staffed" || !tf.staffing

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: "4px",
                  bottom: "4px",
                  left: `${left}%`,
                  width: `${width}%`,
                  borderRadius: "4px",
                  background: isStaffed
                    ? "rgba(52,211,153,.25)"
                    : "rgba(99,102,241,.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    color: isStaffed
                      ? "rgba(110,231,183,.9)"
                      : "rgba(165,180,252,.9)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tf.staffing
                    ? tf.staffing.charAt(0).toUpperCase() +
                      tf.staffing.slice(1).replace("_", " ")
                    : "Staffed"}
                </span>
              </div>
            )
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4px",
          }}
        >
          <span style={{ fontSize: "11px", color: T.ink.faint }}>
            {to12h(dayStart)}
          </span>
          <span style={{ fontSize: "11px", color: T.ink.faint }}>
            {to12h(dayEnd)}
          </span>
        </div>
      </div>

      {/* Per-slot list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {timeframes.map((tf, i) => {
          const isStaffed = tf.staffing === "staffed" || !tf.staffing
          const label = tf.staffing
            ? tf.staffing.charAt(0).toUpperCase() +
              tf.staffing.slice(1).replace("_", " ")
            : "Staffed"

          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 12px",
                borderRadius: "8px",
                background: isStaffed
                  ? "rgba(52,211,153,.08)"
                  : "rgba(99,102,241,.06)",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: isStaffed ? "#6ee7b7" : "#a5b4fc",
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: "12px", color: T.ink.low }}>
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
  alwaysExpanded = false,
}: {
  readonly openingTimes?: OpeningTimesValue | null
  readonly alwaysExpanded?: boolean
}) {
  const todayKey = getTodayKey()
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(todayKey)
  const weekNumber = getWeekNumber()

  if (!openingTimes?.days?.length) {
    return (
      <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
        {/* Title */}
        <div style={{ marginBottom: "20px" }}>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontWeight: 400,
              fontSize: "26px",
              color: T.ink.base,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            Opening hours
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".16em",
                color: T.accent.aurora,
                textTransform: "uppercase",
                border: `1px solid rgba(127,223,255,.25)`,
                borderRadius: "6px",
                padding: "3px 8px",
              }}
            >
              § WEEK {weekNumber}
            </span>
          </h2>
        </div>
        <p
          style={{ fontSize: "14px", color: T.ink.faint, fontStyle: "italic" }}
        >
          Opening hours not yet available.
        </p>
      </div>
    )
  }

  const daysByKey = new Map(openingTimes.days.map((d) => [d.day, d]))

  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6")}>
      {/* Title */}
      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "26px",
            color: T.ink.base,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          Opening hours
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".16em",
              color: T.accent.aurora,
              textTransform: "uppercase",
              border: `1px solid rgba(127,223,255,.25)`,
              borderRadius: "6px",
              padding: "3px 8px",
            }}
          >
            § WEEK {weekNumber}
          </span>
        </h2>
      </div>

      {/* Day rows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: alwaysExpanded ? "8px" : "2px",
        }}
      >
        {DAY_ORDER.map((day) => {
          const dayData = daysByKey.get(day)
          const isToday = day === todayKey
          const isOpen =
            dayData?.enabled === true && (dayData.timeframes?.length ?? 0) > 0
          const isExpanded = alwaysExpanded ? isOpen : expandedDay === day

          const firstTf = dayData?.timeframes?.[0]
          const lastTf = dayData?.timeframes?.at(-1)
          const timeRange =
            isOpen && firstTf && lastTf
              ? `${firstTf.startTime} – ${lastTf.endTime}`
              : null

          return (
            <div
              key={day}
              onClick={() => {
                if (alwaysExpanded || !isOpen) return
                setExpandedDay(isExpanded ? null : day)
              }}
              role={!alwaysExpanded && isOpen ? "button" : undefined}
              aria-expanded={!alwaysExpanded && isOpen ? isExpanded : undefined}
              style={{
                borderRadius: "12px",
                padding: alwaysExpanded ? "14px 16px" : "10px 12px",
                background: isToday
                  ? "rgba(255,255,255,.05)"
                  : isExpanded
                    ? "rgba(255,255,255,.03)"
                    : "transparent",
                cursor: !alwaysExpanded && isOpen ? "pointer" : "default",
                transition: "background 150ms",
                border:
                  alwaysExpanded && isToday
                    ? "1px solid rgba(127,223,255,.18)"
                    : alwaysExpanded
                      ? "1px solid rgba(255,255,255,.06)"
                      : "none",
              }}
              className={
                !alwaysExpanded && isOpen ? "hover:bg-white/[0.04]" : ""
              }
            >
              {/* Main row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: alwaysExpanded
                    ? "150px 1fr auto"
                    : "130px 1fr auto",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {/* Day name + TODAY badge */}
                <div>
                  <span
                    style={{
                      fontSize: alwaysExpanded ? "16px" : "15px",
                      fontWeight: isToday ? 600 : 400,
                      color: isToday ? T.ink.base : "rgba(255,255,255,.7)",
                    }}
                  >
                    {DAY_LABELS[day]}
                  </span>
                  {isToday ? (
                    <span
                      style={{
                        display: "inline-block",
                        marginLeft: "8px",
                        padding: "1px 7px",
                        borderRadius: "5px",
                        background: "rgba(127,223,255,.15)",
                        border: "1px solid rgba(127,223,255,.3)",
                        fontFamily: T.font.mono,
                        fontSize: "9px",
                        letterSpacing: ".14em",
                        color: T.accent.aurora,
                        textTransform: "uppercase",
                        verticalAlign: "middle",
                      }}
                    >
                      Today
                    </span>
                  ) : null}
                </div>

                {/* Proportional bar (only for open days) */}
                {isOpen && dayData?.timeframes ? (
                  <DayBar timeframes={dayData.timeframes} />
                ) : (
                  <div />
                )}

                {/* Time range or Closed */}
                {isOpen ? (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "13px",
                      color: isToday ? T.ink.base : "rgba(255,255,255,.6)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeRange}
                  </span>
                ) : (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "13px",
                      color: "rgba(248,113,113,.6)",
                    }}
                  >
                    Closed
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && isOpen && dayData?.timeframes ? (
                <ExpandedBreakdown timeframes={dayData.timeframes} />
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
