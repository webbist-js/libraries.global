"use client"

import { Icon } from "@iconify/react"

import { FilterSidebarSection } from "@/components/ds"
import type {
  DateScope,
  FilterState,
  PriceScope,
  TimeOfDay,
} from "@/components/events/EventsFilterBar"
import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

// ── Constants ──────────────────────────────────────────────────────────────────

const DATE_SCOPES: { value: DateScope; label: string; icon: string }[] = [
  { value: "today", label: "Today", icon: "mdi:calendar-today" },
  { value: "tomorrow", label: "Tomorrow", icon: "mdi:calendar-arrow-right" },
  { value: "this-week", label: "This week", icon: "mdi:calendar-week" },
  { value: "this-month", label: "This month", icon: "mdi:calendar-month" },
]

const PRICE_SCOPES: { value: PriceScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
]

const TIME_SLOTS: { value: TimeOfDay; label: string; range: string }[] = [
  { value: "morning", label: "Morning", range: "06:00–12:00" },
  { value: "afternoon", label: "Afternoon", range: "12:00–18:00" },
  { value: "evening", label: "Evening", range: "18:00–22:00" },
  { value: "night", label: "Night", range: "22:00–06:00" },
]

// Event types from canonical EVENT_TYPE_META (excludes "other")
const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_META)
  .filter(([key]) => key !== "other")
  .map(([key, meta]) => ({ value: key, label: meta.label, color: meta.color }))

// ── Sub-components ─────────────────────────────────────────────────────────────

function DateScopeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-150"
      )}
      style={{
        fontFamily: T.font.mono,
        fontSize: "11px",
        letterSpacing: ".08em",
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        border: active
          ? "1px solid rgba(127,223,255,0.25)"
          : "1px solid transparent",
        color: active ? T.accent.aurora : T.ink.dim,
      }}
    >
      <Icon
        icon={icon}
        className="size-3.5 shrink-0"
        style={{ color: active ? T.accent.aurora : T.ink.ghost }}
      />
      {label}
    </button>
  )
}

function PricePill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-[10px] tracking-[.1em] uppercase transition-all duration-150"
      style={{
        fontFamily: T.font.mono,
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        borderColor: active ? "rgba(127,223,255,0.3)" : T.border.line,
        color: active ? T.accent.aurora : T.ink.low,
      }}
    >
      {label}
    </button>
  )
}

function CheckRow({
  checked,
  label,
  note,
  color,
  count,
  onChange,
}: {
  checked: boolean
  label: string
  note?: string
  color?: string
  count?: number
  onChange: (v: boolean) => void
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: T.accent.aurora, cursor: "pointer" }}
      />
      {color && (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "2px",
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          color: T.ink.dim,
          flex: 1,
        }}
      >
        {label}
        {note ? (
          <span style={{ color: T.ink.ghost, marginLeft: "4px" }}>{note}</span>
        ) : null}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.ghost,
          }}
        >
          {count}
        </span>
      )}
    </label>
  )
}

// ── Toggle helper ──────────────────────────────────────────────────────────────

function toggleArr<TVal>(arr: TVal[], val: TVal): TVal[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

// ── Main component ─────────────────────────────────────────────────────────────

interface EventsSidebarProps {
  readonly filters: FilterState
  readonly onChange: (next: FilterState) => void
}

export function EventsSidebar({ filters, onChange }: EventsSidebarProps) {
  return (
    <aside className="flex flex-col gap-6" style={{ fontFamily: T.font.mono }}>
      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <Icon
          icon="mdi:magnify"
          className="size-4 shrink-0"
          style={{ color: T.ink.ghost }}
        />
        <input
          type="text"
          placeholder="Search events…"
          value={filters.search}
          onChange={(e) =>
            onChange({ ...filters, search: e.target.value, page: 1 })
          }
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-(--t-ink-ghost)"
          style={{ color: T.ink.dim, fontFamily: T.font.mono }}
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "", page: 1 })}
            style={{ color: T.ink.ghost }}
          >
            <Icon icon="mdi:close" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* § 01 · When */}
      <FilterSidebarSection index={1} label="When">
        <div className="flex flex-col gap-0.5">
          {DATE_SCOPES.map((s) => (
            <DateScopeButton
              key={s.value}
              active={filters.dateScope === s.value}
              icon={s.icon}
              label={s.label}
              onClick={() =>
                onChange({ ...filters, dateScope: s.value, page: 1 })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 02 · Category */}
      <FilterSidebarSection index={2} label="Category">
        <div className="flex flex-col">
          {EVENT_TYPE_OPTIONS.map((t) => (
            <CheckRow
              key={t.value}
              checked={filters.eventTypes.includes(t.value)}
              label={t.label}
              color={t.color}
              onChange={(checked) =>
                onChange({
                  ...filters,
                  eventTypes: checked
                    ? [...filters.eventTypes, t.value]
                    : filters.eventTypes.filter((v) => v !== t.value),
                  page: 1,
                })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 03 · Time of day */}
      <FilterSidebarSection index={3} label="Time of day">
        <div className="flex flex-col">
          {TIME_SLOTS.map((slot) => (
            <CheckRow
              key={slot.value}
              checked={filters.timeOfDay.includes(slot.value)}
              label={slot.label}
              note={slot.range}
              onChange={() =>
                onChange({
                  ...filters,
                  timeOfDay: toggleArr(filters.timeOfDay, slot.value),
                  page: 1,
                })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 04 · Price */}
      <FilterSidebarSection index={4} label="Price">
        <div className="flex flex-wrap gap-1.5">
          {PRICE_SCOPES.map((s) => (
            <PricePill
              key={s.value}
              active={filters.priceScope === s.value}
              label={s.label}
              onClick={() =>
                onChange({ ...filters, priceScope: s.value, page: 1 })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 05 · Library direct */}
      <FilterSidebarSection index={5} label="Source">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={filters.libraryDirect}
            onChange={(e) =>
              onChange({ ...filters, libraryDirect: e.target.checked, page: 1 })
            }
            style={{ accentColor: T.accent.aurora, cursor: "pointer" }}
          />
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              color: T.ink.dim,
            }}
          >
            Library direct only
          </span>
        </label>
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            color: T.ink.ghost,
            marginTop: "4px",
            lineHeight: 1.5,
          }}
        >
          Excludes Eventbrite / TicketSource
        </p>
      </FilterSidebarSection>

      {/* Reset */}
      <button
        type="button"
        onClick={() =>
          onChange({
            dateScope: "today",
            priceScope: "all",
            eventTypes: [],
            search: "",
            timeOfDay: [],
            libraryDirect: false,
            countryCode: "",
            regionSlug: "",
            page: 1,
          })
        }
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: T.ink.ghost,
          background: "transparent",
          border: `1px solid ${T.border.line}`,
          borderRadius: "8px",
          padding: "8px",
          cursor: "pointer",
          transition: "color 150ms",
        }}
      >
        Reset all filters
      </button>
    </aside>
  )
}
