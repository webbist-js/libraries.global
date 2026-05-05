"use client"

import { Icon } from "@iconify/react"

import type {
  DateScope,
  FilterState,
  PriceScope,
} from "@/components/events/EventsFilterBar"
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

const EVENT_TYPES = [
  { value: "", label: "All types" },
  { value: "talk", label: "Talks" },
  { value: "exhibition", label: "Exhibitions" },
  { value: "workshop", label: "Workshops" },
  { value: "storytime", label: "Storytime" },
  { value: "book_club", label: "Book clubs" },
  { value: "reading_group", label: "Reading groups" },
  { value: "performance", label: "Performances" },
  { value: "screening", label: "Screenings" },
  { value: "tour", label: "Tours" },
  { value: "drop_in", label: "Drop-ins" },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: T.ink.ghost,
          marginBottom: "8px",
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

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

function TypeChip({
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
      className="rounded-md border px-2.5 py-1 text-[10px] tracking-[.08em] uppercase transition-all duration-150"
      style={{
        fontFamily: T.font.mono,
        background: active ? "rgba(127,223,255,0.08)" : "transparent",
        borderColor: active ? "rgba(127,223,255,0.25)" : T.border.line,
        color: active ? T.accent.aurora : T.ink.faint,
      }}
    >
      {label}
    </button>
  )
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
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-(--t-ink-ghost)"
          style={{ color: T.ink.dim, fontFamily: T.font.mono }}
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "" })}
            style={{ color: T.ink.ghost }}
          >
            <Icon icon="mdi:close" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Date scope */}
      <FilterSection label="When">
        <div className="flex flex-col gap-0.5">
          {DATE_SCOPES.map((s) => (
            <DateScopeButton
              key={s.value}
              active={filters.dateScope === s.value}
              icon={s.icon}
              label={s.label}
              onClick={() => onChange({ ...filters, dateScope: s.value })}
            />
          ))}
        </div>
      </FilterSection>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* Price */}
      <FilterSection label="Price">
        <div className="flex flex-wrap gap-1.5">
          {PRICE_SCOPES.map((s) => (
            <PricePill
              key={s.value}
              active={filters.priceScope === s.value}
              label={s.label}
              onClick={() => onChange({ ...filters, priceScope: s.value })}
            />
          ))}
        </div>
      </FilterSection>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* Event type */}
      <FilterSection label="Type">
        <div className="flex flex-wrap gap-1.5">
          {EVENT_TYPES.map((t) => (
            <TypeChip
              key={t.value}
              active={filters.eventType === t.value}
              label={t.label}
              onClick={() => onChange({ ...filters, eventType: t.value })}
            />
          ))}
        </div>
      </FilterSection>
    </aside>
  )
}
