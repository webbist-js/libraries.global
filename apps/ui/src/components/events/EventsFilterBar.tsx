"use client"

import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

// ── Types ──────────────────────────────────────────────────────────────────────

export type DateScope = "today" | "tomorrow" | "this-week" | "this-month"
export type PriceScope = "all" | "free" | "paid"

export interface FilterState {
  dateScope: DateScope
  priceScope: PriceScope
  eventType: string
}

interface EventsFilterBarProps {
  readonly filters: FilterState
  readonly onChange: (next: FilterState) => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DATE_SCOPES: { value: DateScope; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
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

// ── Pill Button ────────────────────────────────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 transition-all duration-150",
        "text-[10px] tracking-[.12em] whitespace-nowrap uppercase"
      )}
      style={{
        fontFamily: T.font.mono,
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        borderColor: active ? "rgba(127,223,255,0.3)" : T.border.line,
        color: active ? T.accent.aurora : T.ink.low,
      }}
    >
      {children}
    </button>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EventsFilterBar({ filters, onChange }: EventsFilterBarProps) {
  return (
    <div
      className="sticky top-14 z-20 border-b border-(--t-border-line) backdrop-blur-md"
      style={{ background: "var(--t-header-bg)" }}
    >
      <div className="overflow-x-auto px-6 sm:px-10 lg:px-16">
        {/* Row 1: Date scope */}
        <div
          className="flex items-center gap-2 border-b py-2.5"
          style={{ borderColor: T.border.line }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: T.ink.ghost,
              flexShrink: 0,
              paddingRight: "8px",
            }}
          >
            When
          </span>
          {DATE_SCOPES.map((s) => (
            <Pill
              key={s.value}
              active={filters.dateScope === s.value}
              onClick={() => onChange({ ...filters, dateScope: s.value })}
            >
              {s.label}
            </Pill>
          ))}
        </div>

        {/* Row 2: Price + type */}
        <div className="flex items-center gap-2 py-2.5">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: T.ink.ghost,
              flexShrink: 0,
              paddingRight: "8px",
            }}
          >
            Filter
          </span>
          {PRICE_SCOPES.map((s) => (
            <Pill
              key={s.value}
              active={filters.priceScope === s.value}
              onClick={() => onChange({ ...filters, priceScope: s.value })}
            >
              {s.label}
            </Pill>
          ))}

          <div
            className="mx-2 h-3 w-px shrink-0"
            style={{ background: T.border.line }}
          />

          {EVENT_TYPES.map((t) => (
            <Pill
              key={t.value}
              active={filters.eventType === t.value}
              onClick={() => onChange({ ...filters, eventType: t.value })}
            >
              {t.label}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  )
}
