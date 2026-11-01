"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import type React from "react"
import { useMemo } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"

import {
  DAY_LABELS,
  DAY_ORDER,
  type OpeningTimeframe,
  type OpeningTimesData,
  type OpeningTimesDay,
  type OpeningTimesDayKey,
} from "./opening-times.types"
import {
  OpeningBlockDetails,
  OpeningScheduleOverrides,
} from "./OpeningScheduleOverrides"

export {
  DAY_LABELS,
  DAY_ORDER,
  emptyOpeningTimes,
  type OpeningTimeframe,
  type OpeningTimesData,
  type OpeningTimesDay,
  type OpeningTimesDayKey,
  type OpeningTimesStaffing,
} from "./opening-times.types"

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

  return tf.overnight
    ? toMins(tf.endTime) >= toMins(tf.startTime)
    : toMins(tf.startTime) >= toMins(tf.endTime)
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
  fontFamily: T.font.sans,
  fontSize: "var(--type-body-small-size)",
  color: T.ink.faint,
}

function selectStyle(hasError: boolean): React.CSSProperties {
  return {
    borderColor: hasError ? T.accent.danger : undefined,
    width: "112px",
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
  const tUi = useUiTranslations("ui")

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
        border: `1px solid ${open ? "var(--tint-public-fg)" : T.border.hi}`,
        borderRadius: "6px",
        padding: "4px 9px 4px 10px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = open
          ? "var(--tint-special-bg)"
          : "var(--tint-public-bg)"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = "none"
      }}
    >
      <span
        style={{
          ...monoSm,
          fontSize: "var(--type-body-small-size)",
          color: open ? "var(--tint-public-fg)" : T.ink.dim,
          transition: "color 0.15s",
          userSelect: "none",
        }}
      >
        {open ? tUi("open") : tUi("closed")}
      </span>
      <span
        style={{
          fontSize: "var(--type-body-small-size)",
          lineHeight: 1,
          color: open ? T.accent.danger : "var(--tint-public-fg)",
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
  const tUi = useUiTranslations("ui")

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
    <SelectField
      label={`Copy ${DAY_LABELS[sourceDay]} hours to another day`}
      value=""
      onValueChange={(selectedValue) => {
        const val = selectedValue
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
      }}
      className="ml-auto w-auto min-w-32"
      options={[
        {
          value: "",
          label: tUi("copy_to"),
          disabled: true,
        },
        {
          value: "weekdays",
          label: tUi("mon_fri"),
        },
        {
          value: "weekend",
          label: tUi("sat_sun"),
        },
        {
          value: "all",
          label: tUi("all_days"),
        },
        ...otherDays.map((d) => ({
          value: String(d),
          label: String(DAY_LABELS[d]),
        })),
      ]}
    />
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
  onDetailsChange,
}: {
  timeframe: OpeningTimeframe
  index: number
  isOverlapping: boolean
  minFrom?: string
  onStartTimeChange: (v: string) => void
  onEndTimeChange: (v: string) => void
  onRemove: () => void
  onDetailsChange: (frame: OpeningTimeframe) => void
}) {
  const tUi = useUiTranslations("ui")

  const invalidRange = hasInvalidRange(timeframe)
  const hasError = isOverlapping || invalidRange
  const minFromMins = minFrom ? toMins(minFrom) : 0
  const minToMins = timeframe.overnight
    ? 0
    : timeframe.startTime
      ? toMins(timeframe.startTime) + 15
      : 15

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      {/* Start time */}
      <SelectField
        value={String(timeframe.startTime ?? "")}
        onValueChange={(selectedValue) => onStartTimeChange(selectedValue)}
        style={selectStyle(hasError)}
        label={`Slot ${index + 1} open from`}
        options={[
          ...(!timeframe.startTime
            ? [{ value: "", label: String(tUi("from")) }]
            : []),
          ...FROM_OPTIONS.map((t) => ({
            value: String(t),
            label: String(t),
            disabled: toMins(t) < minFromMins,
          })),
        ]}
      />

      <span style={{ ...monoSm, fontSize: "var(--type-body-small-size)" }}>
        to
      </span>

      {/* End time */}
      <SelectField
        value={String(timeframe.endTime ?? "")}
        onValueChange={(selectedValue) => onEndTimeChange(selectedValue)}
        style={selectStyle(hasError)}
        label={`Slot ${index + 1} close at`}
        options={[
          ...(!timeframe.endTime
            ? [{ value: "", label: String(tUi("until")) }]
            : []),
          ...TO_OPTIONS.map((t) => ({
            value: String(t),
            label: String(displayTime(t)),
            disabled: toMins(t) < minToMins,
          })),
        ]}
      />

      <OpeningBlockDetails frame={timeframe} onChange={onDetailsChange} />
      {hasError && (
        <span
          style={{
            fontFamily: T.font.sans,
            fontSize: "var(--type-body-small-size)",
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
        aria-label={tUi("remove_slot")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.ink.faint,
          fontSize: "var(--type-body-large-size)",
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
            "var(--t-ink-ghost)")
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
  const tUi = useUiTranslations("ui")

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
          { id: makeId(), startTime, endTime, staffing: "open" },
        ],
      })
    )
  }

  const updateTimeframe = (
    dayKey: OpeningTimesDayKey,
    i: number,
    patch: Partial<OpeningTimeframe>
  ) => {
    const day = value.days.find((d) => d.day === dayKey)
    if (!day) return

    const timeframes = day.timeframes.map((tf, idx) =>
      idx === i ? { ...tf, ...patch } : tf
    )

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
      <OpeningScheduleOverrides value={value} onChange={onChange} />
      {value.days.map((day, dayIdx) => {
        const badIndices = overlapMap[day.day] ?? new Set<number>()
        const isEven = dayIdx % 2 === 0

        return (
          <div
            key={day.day}
            style={{
              padding: "14px 18px 16px",
              background: isEven ? T.bg.surface : "transparent",
              borderTop: dayIdx > 0 ? `1px solid ${T.border.line}` : undefined,
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
                  fontFamily: T.font.sans,
                  fontSize: "var(--type-body-small-size)",
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
                  paddingLeft: "0",
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
                      onDetailsChange={(frame) =>
                        updateTimeframe(day.day, i, frame)
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
                    fontSize: "var(--type-body-small-size)",
                    color: T.accent.primary,
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "3px 0",
                  }}
                >
                  {tUi("add_time_slot")}{" "}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
