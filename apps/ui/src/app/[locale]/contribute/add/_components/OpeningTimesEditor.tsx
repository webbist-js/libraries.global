"use client"

import type React from "react"
import { useMemo } from "react"

import { T } from "@/lib/design-tokens"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSlot {
  from: string
  to: string
}

export interface DaySchedule {
  closed: boolean
  byAppointment: boolean
  slots: TimeSlot[]
  note: string
}

export type OpeningTimesData = Record<string, DaySchedule>

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export function emptyOpeningTimes(): OpeningTimesData {
  return Object.fromEntries(
    DAYS.map((d) => [
      d,
      { closed: true, byAppointment: false, slots: [], note: "" },
    ])
  )
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

// Snap minutes to nearest 15-min boundary
function snapTo15(mins: number): number {
  return Math.round(mins / 15) * 15
}

function minsToTime(totalMins: number): string {
  if (totalMins >= 1440) return "24:00"
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function hasInvalidRange(slot: TimeSlot): boolean {
  if (!slot.from || !slot.to) return false

  return toMins(slot.from) >= toMins(slot.to)
}

function overlappingIndices(slots: TimeSlot[]): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!
      const b = slots[j]!
      if (
        a.from &&
        a.to &&
        b.from &&
        b.to &&
        toMins(a.from) < toMins(b.to) &&
        toMins(b.from) < toMins(a.to)
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
// Day open/close toggle — trailing icon, no layout shift
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
      {/* Trailing icon: × when open (click to close), + when closed (click to open) */}
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
// By-appointment mini toggle
// ---------------------------------------------------------------------------

function ApptToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "none",
        border: `1px solid ${checked ? T.accent.violet + "44" : "rgba(255,255,255,0.08)"}`,
        borderRadius: "6px",
        padding: "4px 9px 4px 10px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span
        style={{
          ...monoSm,
          fontSize: "9px",
          color: checked ? T.accent.violet : "rgba(244,247,255,0.28)",
          transition: "color 0.15s",
          userSelect: "none",
        }}
      >
        By appointment
      </span>
      <span
        style={{
          fontSize: "14px",
          lineHeight: 1,
          color: checked ? T.accent.violet : "rgba(244,247,255,0.30)",
          opacity: checked ? 0.7 : 0.5,
          fontWeight: 300,
          marginTop: "-1px",
        }}
      >
        {checked ? "×" : "+"}
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
  sourceDay: string
  onCopy: (targets: string[]) => void
}) {
  const otherDays = DAYS.filter((d) => d !== sourceDay)
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const weekend = ["Saturday", "Sunday"]

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
            onCopy([val])
        }
        // reset
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
          {d}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Time slot row — sequential constraints
// ---------------------------------------------------------------------------

function TimeSlotRow({
  slot,
  index,
  isOverlapping,
  minFrom,
  onFromChange,
  onToChange,
  onRemove,
}: {
  slot: TimeSlot
  index: number
  isOverlapping: boolean
  /** Minimum allowed "from" time — end of the previous slot */
  minFrom?: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onRemove: () => void
}) {
  const invalidRange = hasInvalidRange(slot)
  const hasError = isOverlapping || invalidRange
  const minFromMins = minFrom ? toMins(minFrom) : 0
  // "to" must be at least "from + 15min"
  const minToMins = slot.from ? toMins(slot.from) + 15 : 15

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {/* From */}
      <select
        value={slot.from}
        onChange={(e) => onFromChange(e.target.value)}
        style={selectStyle(hasError)}
        aria-label={`Slot ${index + 1} open from`}
      >
        {!slot.from && <option value="">From…</option>}
        {FROM_OPTIONS.map((t) => (
          <option key={t} value={t} disabled={toMins(t) < minFromMins}>
            {t}
          </option>
        ))}
      </select>

      <span style={{ ...monoSm, fontSize: "9px" }}>to</span>

      {/* To */}
      <select
        value={slot.to}
        onChange={(e) => onToChange(e.target.value)}
        style={selectStyle(hasError)}
        aria-label={`Slot ${index + 1} close at`}
      >
        {!slot.to && <option value="">Until…</option>}
        {TO_OPTIONS.map((t) => (
          <option key={t} value={t} disabled={toMins(t) < minToMins}>
            {displayTime(t)}
          </option>
        ))}
      </select>

      {/* Error */}
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

      {/* Remove */}
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
  day: string,
  patch: Partial<DaySchedule>
): OpeningTimesData {
  return { ...data, [day]: { ...data[day]!, ...patch } }
}

export function OpeningTimesEditor({
  value,
  onChange,
}: OpeningTimesEditorProps) {
  const overlapMap = useMemo(() => {
    const map: Record<string, Set<number>> = {}
    for (const day of DAYS) {
      map[day] = overlappingIndices(value[day]?.slots ?? [])
    }

    return map
  }, [value])

  const addSlot = (day: string) => {
    const slots = value[day]?.slots ?? []
    const lastTo = slots.length > 0 ? slots.at(-1)!.to : ""
    // Start at the end of the last slot (sequential), default 09:00
    const fromMins = lastTo ? toMins(lastTo) : toMins("09:00")
    const fromDefault = minsToTime(snapTo15(fromMins))
    // End 1h after start, snapped to 15-min
    const toDefault = minsToTime(Math.min(snapTo15(fromMins + 60), 1440))
    onChange(
      patchDay(value, day, {
        slots: [...slots, { from: fromDefault, to: toDefault }],
      })
    )
  }

  const updateSlot = (day: string, i: number, patch: Partial<TimeSlot>) => {
    const slots = value[day]!.slots.map((s, idx) =>
      idx === i ? { ...s, ...patch } : s
    )
    // When changing "from", auto-advance "to" if it would become invalid
    if (patch.from !== undefined) {
      const updated = slots[i]!
      if (updated.to && toMins(updated.from) >= toMins(updated.to)) {
        slots[i] = {
          ...updated,
          to: minsToTime(Math.min(snapTo15(toMins(updated.from) + 60), 1440)),
        }
      }
    }
    onChange(patchDay(value, day, { slots }))
  }

  const removeSlot = (day: string, i: number) => {
    onChange(
      patchDay(value, day, {
        slots: value[day]!.slots.filter((_, idx) => idx !== i),
      })
    )
  }

  const copyDayTo = (sourceDay: string, targets: string[]) => {
    const source = value[sourceDay]!
    const updated = { ...value }
    targets.forEach((d) => {
      updated[d] = { ...source, slots: source.slots.map((s) => ({ ...s })) }
    })
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
      {DAYS.map((day, dayIdx) => {
        const schedule = value[day] ?? {
          closed: true,
          byAppointment: false,
          slots: [],
          note: "",
        }
        const badIndices = overlapMap[day] ?? new Set<number>()
        const isEven = dayIdx % 2 === 0

        return (
          <div
            key={day}
            style={{
              padding: "14px 18px 16px",
              background: isEven
                ? "rgba(255,255,255,0.012)"
                : "rgba(255,255,255,0.004)",
              borderTop: dayIdx > 0 ? `1px solid ${T.border.line}` : undefined,
              opacity: schedule.closed ? 0.55 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {/* Row: day label + toggles + copy */}
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
                  color: schedule.closed ? T.ink.faint : T.ink.base,
                  width: "82px",
                  flexShrink: 0,
                  transition: "color 0.15s",
                }}
              >
                {day}
              </span>

              <DayToggle
                open={!schedule.closed}
                onChange={(open) =>
                  onChange(
                    patchDay(value, day, {
                      closed: !open,
                      slots: !open ? [] : schedule.slots,
                    })
                  )
                }
              />

              {!schedule.closed && (
                <ApptToggle
                  checked={schedule.byAppointment}
                  onChange={(v) =>
                    onChange(patchDay(value, day, { byAppointment: v }))
                  }
                />
              )}

              {/* Copy-to selector — any open day with slots */}
              {!schedule.closed && schedule.slots.length > 0 && (
                <CopyDaySelect
                  sourceDay={day}
                  onCopy={(targets) => copyDayTo(day, targets)}
                />
              )}
            </div>

            {/* Time slots */}
            {!schedule.closed && !schedule.byAppointment && (
              <div
                style={{
                  marginTop: "10px",
                  paddingLeft: "98px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                }}
              >
                {schedule.slots.map((slot, i) => {
                  // minFrom for slot i = end of slot i-1 (sequential)
                  const prevTo = i > 0 ? schedule.slots[i - 1]!.to : undefined

                  return (
                    <TimeSlotRow
                      key={i}
                      slot={slot}
                      index={i}
                      isOverlapping={badIndices.has(i)}
                      minFrom={prevTo}
                      onFromChange={(v) => updateSlot(day, i, { from: v })}
                      onToChange={(v) => updateSlot(day, i, { to: v })}
                      onRemove={() => removeSlot(day, i)}
                    />
                  )
                })}

                <button
                  type="button"
                  onClick={() => addSlot(day)}
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

            {/* Note */}
            {!schedule.closed && (
              <div style={{ marginTop: "10px", paddingLeft: "98px" }}>
                <input
                  type="text"
                  value={schedule.note}
                  onChange={(e) =>
                    onChange(patchDay(value, day, { note: e.target.value }))
                  }
                  placeholder="Note — e.g. 'Reading rooms close 30 min earlier'"
                  style={{
                    padding: "7px 11px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    color: T.ink.dim,
                    fontSize: "12px",
                    fontFamily: T.font.sans,
                    outline: "none",
                    width: "100%",
                    maxWidth: "440px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
