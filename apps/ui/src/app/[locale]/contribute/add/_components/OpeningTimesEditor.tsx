"use client"

import type React from "react"
import { useMemo } from "react"

import { T } from "@/lib/design-tokens"

// ---------------------------------------------------------------------------
// Types — canonical format matching the global::opening-times custom field
// ---------------------------------------------------------------------------

export const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type OpeningTimesDayKey = (typeof DAY_ORDER)[number]

export const DAY_LABELS: Record<OpeningTimesDayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

export type OpeningTimesStaffing = "staffed" | "volunteer" | "self_service"

export interface OpeningTimeframe {
  id: string
  startTime: string
  endTime: string
  staffing: OpeningTimesStaffing
}

export interface OpeningTimesDay {
  day: OpeningTimesDayKey
  enabled: boolean
  timeframes: OpeningTimeframe[]
}

export interface OpeningTimesData {
  version: number
  days: OpeningTimesDay[]
}

export function emptyOpeningTimes(): OpeningTimesData {
  return {
    version: 1,
    days: DAY_ORDER.map((day) => ({ day, enabled: false, timeframes: [] })),
  }
}

// ---------------------------------------------------------------------------
// Time utilities — 15-min intervals
// ---------------------------------------------------------------------------

// 15-min FROM options: 00:00 → 23:45 (96 options)
const FROM_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
})

// 15-min TO options: 00:15 → 24:00 (96 options)
const TO_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const totalMins = (i + 1) * 15
  const h = Math.floor(totalMins / 60) % 24
  const m = totalMins % 60

  return totalMins === 1440
    ? "24:00"
    : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
})

function toMins(t: string): number {
  if (!t) return 0
  if (t === "24:00") return 1440
  const [h, m] = t.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

function snapTo15(mins: number): number {
  return Math.round(mins / 15) * 15
}

function minsToTime(totalMins: number): string {
  if (totalMins >= 1440) return "24:00"
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function makeId(): string {
  const crypto = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID()

  return `tf-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hasInvalidRange(tf: OpeningTimeframe): boolean {
  if (!tf.startTime || !tf.endTime) return false

  return toMins(tf.startTime) >= toMins(tf.endTime)
}

function overlappingIndices(timeframes: OpeningTimeframe[]): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < timeframes.length; i++) {
    for (let j = i + 1; j < timeframes.length; j++) {
      const a = timeframes[i]!
      const b = timeframes[j]!
      if (
        a.startTime &&
        a.endTime &&
        b.startTime &&
        b.endTime &&
        toMins(a.startTime) < toMins(b.endTime) &&
        toMins(b.startTime) < toMins(a.endTime)
      ) {
        bad.add(i)
        bad.add(j)
      }
    }
  }

  return bad
}

function displayTime(t: string): string {
  if (t === "24:00") return "00:00 (midnight)"

  return t
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const monoSm: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: "10px",
  letterSpacing: ".12em",
  textTransform: "uppercase" as const,
  color: T.ink.faint,
}

function selectStyle(hasError: boolean): React.CSSProperties {
  return {
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    padding: "7px 30px 7px 11px",
    borderRadius: "7px",
    border: `1px solid ${hasError ? T.accent.danger + "80" : "rgba(255,255,255,0.14)"}`,
    background: hasError ? "rgba(255,138,138,0.06)" : "rgba(255,255,255,0.05)",
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: T.font.mono,
    outline: "none",
    cursor: "pointer",
    width: "112px",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(244,247,255,0.25)'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    boxSizing: "border-box" as const,
  }
}

// ---------------------------------------------------------------------------
// Day open/close toggle
// ---------------------------------------------------------------------------

function DayToggle({
  open,
  onChange,
}: {
  open: boolean
  onChange: (open: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!open)}
      title={open ? "Mark as closed" : "Mark as open"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        background: "none",
        border: `1px solid ${open ? "rgba(127,223,255,0.22)" : "rgba(255,255,255,0.10)"}`,
        borderRadius: "6px",
        padding: "4px 9px 4px 10px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = open
          ? "rgba(255,138,138,0.06)"
          : "rgba(127,223,255,0.06)"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = "none"
      }}
    >
      <span
        style={{
          ...monoSm,
          fontSize: "9px",
          color: open ? T.accent.aurora : "rgba(244,247,255,0.30)",
          transition: "color 0.15s",
          userSelect: "none",
        }}
      >
        {open ? "Open" : "Closed"}
      </span>
      <span
        style={{
          fontSize: "14px",
          lineHeight: 1,
          color: open ? T.accent.danger : T.accent.aurora,
          opacity: open ? 0.7 : 0.5,
          fontWeight: 300,
          transition: "color 0.15s, opacity 0.15s",
          marginTop: "-1px",
        }}
      >
        {open ? "×" : "+"}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Copy-day selector
// ---------------------------------------------------------------------------

function CopyDaySelect({
  sourceDay,
  onCopy,
}: {
  sourceDay: OpeningTimesDayKey
  onCopy: (targets: OpeningTimesDayKey[]) => void
}) {
  const otherDays = DAY_ORDER.filter((d) => d !== sourceDay)
  const weekdays: OpeningTimesDayKey[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]
  const weekend: OpeningTimesDayKey[] = ["saturday", "sunday"]

  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const val = e.target.value
        if (!val) return
        switch (val) {
          case "weekdays":
            onCopy(weekdays)
            break
          case "weekend":
            onCopy(weekend)
            break
          case "all":
            onCopy(otherDays)
            break

          default:
            onCopy([val as OpeningTimesDayKey])
        }
        e.target.value = ""
      }}
      style={{
        ...monoSm,
        fontSize: "9px",
        color: T.accent.aurora,
        opacity: 0.65,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        outline: "none",
        marginLeft: "auto",
        letterSpacing: ".12em",
        appearance: "none" as const,
        WebkitAppearance: "none" as const,
      }}
    >
      <option
        value=""
        disabled
        style={{ background: "#0d1020", color: T.ink.dim }}
      >
        Copy to…
      </option>
      <option
        value="weekdays"
        style={{ background: "#0d1020", color: T.ink.base }}
      >
        Mon–Fri
      </option>
      <option
        value="weekend"
        style={{ background: "#0d1020", color: T.ink.base }}
      >
        Sat–Sun
      </option>
      <option value="all" style={{ background: "#0d1020", color: T.ink.base }}>
        All days
      </option>
      {otherDays.map((d) => (
        <option
          key={d}
          value={d}
          style={{ background: "#0d1020", color: T.ink.base }}
        >
          {DAY_LABELS[d]}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Time slot (timeframe) row
// ---------------------------------------------------------------------------

function TimeframeRow({
  timeframe,
  index,
  isOverlapping,
  minFrom,
  onStartTimeChange,
  onEndTimeChange,
  onRemove,
}: {
  timeframe: OpeningTimeframe
  index: number
  isOverlapping: boolean
  minFrom?: string
  onStartTimeChange: (v: string) => void
  onEndTimeChange: (v: string) => void
  onRemove: () => void
}) {
  const invalidRange = hasInvalidRange(timeframe)
  const hasError = isOverlapping || invalidRange
  const minFromMins = minFrom ? toMins(minFrom) : 0
  const minToMins = timeframe.startTime ? toMins(timeframe.startTime) + 15 : 15

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {/* Start time */}
      <select
        value={timeframe.startTime}
        onChange={(e) => onStartTimeChange(e.target.value)}
        style={selectStyle(hasError)}
        aria-label={`Slot ${index + 1} open from`}
      >
        {!timeframe.startTime && <option value="">From…</option>}
        {FROM_OPTIONS.map((t) => (
          <option key={t} value={t} disabled={toMins(t) < minFromMins}>
            {t}
          </option>
        ))}
      </select>

      <span style={{ ...monoSm, fontSize: "9px" }}>to</span>

      {/* End time */}
      <select
        value={timeframe.endTime}
        onChange={(e) => onEndTimeChange(e.target.value)}
        style={selectStyle(hasError)}
        aria-label={`Slot ${index + 1} close at`}
      >
        {!timeframe.endTime && <option value="">Until…</option>}
        {TO_OPTIONS.map((t) => (
          <option key={t} value={t} disabled={toMins(t) < minToMins}>
            {displayTime(t)}
          </option>
        ))}
      </select>

      {hasError && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".10em",
            color: T.accent.danger,
            opacity: 0.8,
          }}
          title={
            invalidRange
              ? "End time must be after start time"
              : "This slot overlaps with another"
          }
        >
          {invalidRange ? "End ≤ start" : "Overlaps"}
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove slot"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.22)",
          fontSize: "18px",
          lineHeight: 1,
          padding: "0 2px",
          display: "flex",
          alignItems: "center",
          transition: "color 0.12s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = T.accent.danger)
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.22)")
        }
      >
        ×
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

interface OpeningTimesEditorProps {
  value: OpeningTimesData
  onChange: (updated: OpeningTimesData) => void
}

function patchDay(
  data: OpeningTimesData,
  dayKey: OpeningTimesDayKey,
  patch: Partial<OpeningTimesDay>
): OpeningTimesData {
  return {
    ...data,
    days: data.days.map((d) => (d.day === dayKey ? { ...d, ...patch } : d)),
  }
}

export function OpeningTimesEditor({
  value,
  onChange,
}: OpeningTimesEditorProps) {
  const overlapMap = useMemo(() => {
    const map: Record<string, Set<number>> = {}
    for (const day of value.days) {
      map[day.day] = overlappingIndices(day.timeframes)
    }

    return map
  }, [value])

  const addTimeframe = (dayKey: OpeningTimesDayKey) => {
    const day = value.days.find((d) => d.day === dayKey)
    const timeframes = day?.timeframes ?? []
    const lastEnd = timeframes.length > 0 ? timeframes.at(-1)!.endTime : ""
    const fromMins = lastEnd ? toMins(lastEnd) : toMins("09:00")
    const startTime = minsToTime(snapTo15(fromMins))
    const endTime = minsToTime(Math.min(snapTo15(fromMins + 60), 1440))

    onChange(
      patchDay(value, dayKey, {
        timeframes: [
          ...timeframes,
          { id: makeId(), startTime, endTime, staffing: "staffed" },
        ],
      })
    )
  }

  const updateTimeframe = (
    dayKey: OpeningTimesDayKey,
    i: number,
    patch: Partial<Pick<OpeningTimeframe, "startTime" | "endTime">>
  ) => {
    const day = value.days.find((d) => d.day === dayKey)
    if (!day) return

    const timeframes = day.timeframes.map((tf, idx) =>
      idx === i ? { ...tf, ...patch } : tf
    )

    // Auto-advance endTime if startTime change makes range invalid
    if (patch.startTime !== undefined) {
      const updated = timeframes[i]!
      if (
        updated.endTime &&
        toMins(updated.startTime) >= toMins(updated.endTime)
      ) {
        timeframes[i] = {
          ...updated,
          endTime: minsToTime(
            Math.min(snapTo15(toMins(updated.startTime) + 60), 1440)
          ),
        }
      }
    }

    onChange(patchDay(value, dayKey, { timeframes }))
  }

  const removeTimeframe = (dayKey: OpeningTimesDayKey, i: number) => {
    const day = value.days.find((d) => d.day === dayKey)
    if (!day) return
    onChange(
      patchDay(value, dayKey, {
        timeframes: day.timeframes.filter((_, idx) => idx !== i),
      })
    )
  }

  const copyDayTo = (
    sourceKey: OpeningTimesDayKey,
    targets: OpeningTimesDayKey[]
  ) => {
    const source = value.days.find((d) => d.day === sourceKey)
    if (!source) return

    let updated = value
    for (const target of targets) {
      updated = patchDay(updated, target, {
        enabled: source.enabled,
        timeframes: source.timeframes.map((tf) => ({
          ...tf,
          id: makeId(),
        })),
      })
    }
    onChange(updated)
  }

  return (
    <div
      style={{
        borderRadius: "10px",
        border: `1px solid ${T.border.line}`,
        overflow: "hidden",
      }}
    >
      {value.days.map((day, dayIdx) => {
        const badIndices = overlapMap[day.day] ?? new Set<number>()
        const isEven = dayIdx % 2 === 0

        return (
          <div
            key={day.day}
            style={{
              padding: "14px 18px 16px",
              background: isEven
                ? "rgba(255,255,255,0.012)"
                : "rgba(255,255,255,0.004)",
              borderTop: dayIdx > 0 ? `1px solid ${T.border.line}` : undefined,
              opacity: day.enabled ? 1 : 0.55,
              transition: "opacity 0.15s",
            }}
          >
            {/* Row: day label + toggle + copy */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  letterSpacing: ".13em",
                  textTransform: "uppercase",
                  color: day.enabled ? T.ink.base : T.ink.faint,
                  width: "82px",
                  flexShrink: 0,
                  transition: "color 0.15s",
                }}
              >
                {DAY_LABELS[day.day]}
              </span>

              <DayToggle
                open={day.enabled}
                onChange={(open) =>
                  onChange(
                    patchDay(value, day.day, {
                      enabled: open,
                      timeframes: open ? day.timeframes : [],
                    })
                  )
                }
              />

              {day.enabled && day.timeframes.length > 0 && (
                <CopyDaySelect
                  sourceDay={day.day}
                  onCopy={(targets) => copyDayTo(day.day, targets)}
                />
              )}
            </div>

            {/* Timeframes */}
            {day.enabled && (
              <div
                style={{
                  marginTop: "10px",
                  paddingLeft: "98px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                }}
              >
                {day.timeframes.map((tf, i) => {
                  const prevEnd =
                    i > 0 ? day.timeframes[i - 1]!.endTime : undefined

                  return (
                    <TimeframeRow
                      key={tf.id}
                      timeframe={tf}
                      index={i}
                      isOverlapping={badIndices.has(i)}
                      minFrom={prevEnd}
                      onStartTimeChange={(v) =>
                        updateTimeframe(day.day, i, { startTime: v })
                      }
                      onEndTimeChange={(v) =>
                        updateTimeframe(day.day, i, { endTime: v })
                      }
                      onRemove={() => removeTimeframe(day.day, i)}
                    />
                  )
                })}

                <button
                  type="button"
                  onClick={() => addTimeframe(day.day)}
                  style={{
                    alignSelf: "flex-start",
                    ...monoSm,
                    fontSize: "9px",
                    color: T.accent.aurora,
                    opacity: 0.65,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "3px 0",
                    letterSpacing: ".14em",
                  }}
                >
                  + Add time slot
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
