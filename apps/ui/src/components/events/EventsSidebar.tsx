"use client"

import { Icon } from "@iconify/react"
import { useMemo, useState } from "react"

import type {
  FilterState,
  PriceScope,
  TimeOfDay,
} from "@/components/events/EventsFilterBar"
import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import type { CountryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { CONTINENTS, getContinent, getCountryName } from "@/lib/iso-continent"

// ── Constants ──────────────────────────────────────────────────────────────────

const PRICE_SCOPES: { value: PriceScope; label: string }[] = [
  { value: "all", label: "All prices" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
]

const TIME_SLOTS: { value: TimeOfDay; label: string; note: string }[] = [
  { value: "morning", label: "Morning", note: "before 12" },
  { value: "afternoon", label: "Afternoon", note: "12–18" },
  { value: "evening", label: "Evening", note: "18–22" },
  { value: "night", label: "Night", note: "after 22" },
]

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_META)
  .filter(([key]) => key !== "other")
  .map(([key, meta]) => ({ value: key, label: meta.label, color: meta.color }))

// ── Calendar ───────────────────────────────────────────────────────────────────

const CAL_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")

  return `${y}-${m}-${day}`
}

function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string | undefined
  onSelect: (iso: string | undefined) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = firstDay.getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const todayISO = toISODate(today)
  const monthLabel = firstDay
    .toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    .toUpperCase()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else setViewMonth((m) => m + 1)
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={prevMonth}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: T.ink.faint,
            padding: "2px 4px",
          }}
        >
          <Icon icon="mdi:chevron-left" style={{ fontSize: "14px" }} />
        </button>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            color: T.ink.dim,
          }}
        >
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: T.ink.faint,
            padding: "2px 4px",
          }}
        >
          <Icon icon="mdi:chevron-right" style={{ fontSize: "14px" }} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
          marginBottom: "2px",
        }}
      >
        {CAL_DAY_LABELS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.faint,
              padding: "2px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
        }}
      >
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const iso = toISODate(new Date(viewYear, viewMonth, day))
          const isToday = iso === todayISO
          const isSelected = iso === selectedDate

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(isSelected ? undefined : iso)}
              style={{
                textAlign: "center",
                fontFamily: T.font.mono,
                fontSize: "10px",
                padding: "5px 2px",
                borderRadius: "6px",
                border: isSelected
                  ? "1px solid rgba(127,223,255,0.35)"
                  : isToday
                    ? `1px solid ${T.border.hi}`
                    : "1px solid transparent",
                background: isSelected
                  ? "rgba(127,223,255,0.12)"
                  : "transparent",
                color: isSelected
                  ? T.accent.aurora
                  : isToday
                    ? T.ink.base
                    : T.ink.dim,
                cursor: "pointer",
                transition: "background 100ms",
              }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          style={{
            marginTop: "10px",
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".08em",
            color: T.ink.faint,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: 0,
          }}
        >
          <Icon icon="mdi:close" style={{ fontSize: "12px" }} />
          Clear date
        </button>
      )}
    </div>
  )
}

// ── FBlock (accordion-capable) ─────────────────────────────────────────────────

function FBlock({
  label,
  accordion = false,
  defaultOpen = true,
  onReset,
  children,
}: {
  label: string
  accordion?: boolean
  defaultOpen?: boolean
  onReset?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="fb">
      {/* Header — clickable when accordion */}
      <div className="fb-hd" style={{ marginBottom: open ? "10px" : 0 }}>
        <button
          type="button"
          onClick={accordion ? () => setOpen((v) => !v) : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
            background: "none",
            border: "none",
            padding: 0,
            cursor: accordion ? "pointer" : "default",
            gap: "8px",
          }}
        >
          <span className="fb-t">{label}</span>
          {accordion && (
            <Icon
              icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
              style={{
                fontSize: "14px",
                color: "rgba(244,247,255,.30)",
                flexShrink: 0,
              }}
            />
          )}
        </button>
        {onReset && open && (
          <button type="button" className="fb-a" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      {open && children}
    </div>
  )
}

// ── FOptRow ────────────────────────────────────────────────────────────────────

function FOptRow({
  checked,
  label,
  note,
  color,
  onChange,
}: {
  checked: boolean
  label: string
  note?: string
  color?: string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`fopt${checked ? "fopt-on" : ""}`}
    >
      <span className="fopt-l">
        <span className="fopt-cb">{checked ? "✓" : ""}</span>
        {color && <span className="fopt-pip" style={{ background: color }} />}
        <span className="fopt-label">
          {label}
          {note && <span className="fopt-note"> · {note}</span>}
        </span>
      </span>
    </button>
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
  readonly countryBreakdown: CountryStat[]
}

export function EventsSidebar({
  filters,
  onChange,
  countryBreakdown,
}: EventsSidebarProps) {
  const derivedContinent = useMemo(
    () =>
      filters.countryCode ? (getContinent(filters.countryCode) ?? "") : "",
    [filters.countryCode]
  )
  const [selectedContinent, setSelectedContinent] = useState(derivedContinent)

  const continentCountries = useMemo(() => {
    const codes = countryBreakdown.map((c) => c.countryCode)
    if (!selectedContinent) return codes

    return codes.filter((c) => getContinent(c) === selectedContinent)
  }, [countryBreakdown, selectedContinent])

  return (
    <aside className="sb">
      {/* Search — always open, no accordion */}
      <FBlock label="Search programme" defaultOpen>
        <div className="fb-search">
          <Icon
            icon="mdi:magnify"
            style={{ fontSize: "14px", color: T.ink.faint, flexShrink: 0 }}
          />
          <input
            type="text"
            placeholder="Author, title, venue, topic…"
            value={filters.search}
            onChange={(e) =>
              onChange({ ...filters, search: e.target.value, page: 1 })
            }
            className="fb-search-input"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: "", page: 1 })}
              style={{
                color: T.ink.faint,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Icon icon="mdi:close" style={{ fontSize: "12px" }} />
            </button>
          )}
        </div>
      </FBlock>

      {/* Location — accordion, closed by default */}
      {countryBreakdown.length > 0 && (
        <FBlock label="§ 01 · Location" accordion defaultOpen={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ position: "relative" }}>
              <select
                value={selectedContinent}
                onChange={(e) => {
                  setSelectedContinent(e.target.value)
                  onChange({ ...filters, countryCode: "", page: 1 })
                }}
                className="fb-select"
              >
                <option value="">All continents</option>
                {CONTINENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="fb-select-car">▾</span>
            </div>
            <div style={{ position: "relative" }}>
              <select
                value={filters.countryCode}
                onChange={(e) =>
                  onChange({ ...filters, countryCode: e.target.value, page: 1 })
                }
                className="fb-select"
              >
                <option value="">All countries</option>
                {continentCountries.map((code) => (
                  <option key={code} value={code}>
                    {getCountryName(code)}
                  </option>
                ))}
              </select>
              <span className="fb-select-car">▾</span>
            </div>
          </div>
        </FBlock>
      )}

      {/* When — accordion, closed by default */}
      <FBlock
        label="§ 02 · When"
        accordion
        defaultOpen={false}
        onReset={
          filters.calendarDate
            ? () => onChange({ ...filters, calendarDate: undefined, page: 1 })
            : undefined
        }
      >
        <MiniCalendar
          selectedDate={filters.calendarDate}
          onSelect={(iso) =>
            onChange({ ...filters, calendarDate: iso, page: 1 })
          }
        />
      </FBlock>

      {/* Category — accordion, closed by default */}
      <FBlock
        label="§ 03 · Category"
        accordion
        defaultOpen={false}
        onReset={
          filters.eventTypes.length > 0
            ? () => onChange({ ...filters, eventTypes: [], page: 1 })
            : undefined
        }
      >
        <div className="fopts">
          {EVENT_TYPE_OPTIONS.map((t) => (
            <FOptRow
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
      </FBlock>

      {/* Time of day — accordion, closed by default */}
      <FBlock
        label="§ 04 · Time of day"
        accordion
        defaultOpen={false}
        onReset={
          filters.timeOfDay.length > 0
            ? () => onChange({ ...filters, timeOfDay: [], page: 1 })
            : undefined
        }
      >
        <div className="fopts">
          {TIME_SLOTS.map((slot) => (
            <FOptRow
              key={slot.value}
              checked={filters.timeOfDay.includes(slot.value)}
              label={slot.label}
              note={slot.note}
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
      </FBlock>

      {/* Price — accordion, closed by default */}
      <FBlock label="§ 05 · Price" accordion defaultOpen={false}>
        <div className="fopts">
          {PRICE_SCOPES.map((s) => (
            <FOptRow
              key={s.value}
              checked={filters.priceScope === s.value}
              label={s.label}
              onChange={() =>
                onChange({ ...filters, priceScope: s.value, page: 1 })
              }
            />
          ))}
        </div>
      </FBlock>

      {/* Reset all */}
      <button
        type="button"
        onClick={() => {
          setSelectedContinent("")
          onChange({
            dateScope: "this-month",
            priceScope: "all",
            eventTypes: [],
            search: "",
            timeOfDay: [],
            countryCode: "",
            regionSlug: "",
            calendarDate: undefined,
            page: 1,
          })
        }}
        className="sb-reset"
      >
        Reset all filters
      </button>

      <style>{`
        .sb {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .fb {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          padding: 16px 18px;
          backdrop-filter: blur(8px);
        }
        .fb-hd {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .fb-t {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: rgba(244,247,255,.48);
          letter-spacing: .22em;
          text-transform: uppercase;
        }
        .fb-a {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          color: rgba(244,247,255,.30);
          letter-spacing: .16em;
          text-transform: uppercase;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-left: 4px;
          flex-shrink: 0;
        }
        .fb-a:hover { color: rgba(244,247,255,.72); }
        .fb-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 8px;
          background: rgba(255,255,255,.04);
        }
        .fb-search-input {
          flex: 1;
          border: 0;
          background: transparent;
          outline: none;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: rgba(244,247,255,.72);
          min-width: 0;
        }
        .fb-search-input::placeholder {
          color: rgba(244,247,255,.30);
        }
        .fb-select {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: .08em;
          background: rgba(7,11,30,1);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          color: rgba(244,247,255,.72);
          padding: 6px 10px;
          padding-right: 24px;
          cursor: pointer;
          outline: none;
          appearance: none;
          width: 100%;
        }
        .fb-select-car {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: rgba(244,247,255,.30);
          font-size: 10px;
        }
        .fopts {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .fopt {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 12.5px;
          color: rgba(244,247,255,.72);
          cursor: pointer;
          transition: background 150ms;
          background: transparent;
          border: none;
          text-align: left;
          width: 100%;
        }
        .fopt:hover { background: rgba(255,255,255,.05); }
        .fopt-on {
          background: rgba(127,223,255,.10) !important;
          color: #7fdfff !important;
          font-weight: 500;
        }
        .fopt-l {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .fopt-cb {
          width: 14px;
          height: 14px;
          border: 1.5px solid rgba(255,255,255,.16);
          border-radius: 3px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          color: transparent;
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
        }
        .fopt-on .fopt-cb {
          background: #7fdfff;
          border-color: #7fdfff;
          color: #0a0f2a;
        }
        .fopt-pip {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .fopt-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
        }
        .fopt-note {
          color: rgba(244,247,255,.30);
          font-size: 10px;
        }
        .fopt-on .fopt-note {
          color: rgba(127,223,255,.65);
        }
        .sb-reset {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: rgba(244,247,255,.30);
          background: transparent;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 10px;
          cursor: pointer;
          transition: color 150ms, border-color 150ms;
          width: 100%;
        }
        .sb-reset:hover {
          color: rgba(244,247,255,.72);
          border-color: rgba(255,255,255,.16);
        }
      `}</style>
    </aside>
  )
}
