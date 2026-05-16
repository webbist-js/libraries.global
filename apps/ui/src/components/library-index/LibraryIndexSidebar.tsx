// apps/ui/src/components/library-index/LibraryIndexSidebar.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"

// ── Type groups ────────────────────────────────────────────────────────────────
// Each group maps a UI label to one or more Strapi enum values.
const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Public", types: ["Public"] },
  { label: "Academic / university", types: ["Academic", "University"] },
  { label: "National & legal deposit", types: ["National", "Parliamentary"] },
  { label: "Special / archives", types: ["Special", "Archive"] },
  { label: "Municipal", types: ["Municipal"] },
  { label: "Monastic", types: ["Monastic"] },
  { label: "Mobile / bookmobile", types: ["Mobile"] },
  { label: "Cultural", types: ["Cultural"] },
  { label: "Digital", types: ["Digital"] },
  { label: "Private", types: ["Private"] },
  { label: "Other", types: ["Other", "State"] },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open today" },
  { value: "temporarily_closed", label: "Temporarily closed" },
  { value: "appointment_only", label: "Appointment only" },
  { value: "permanently_closed", label: "Permanently closed" },
]

const OPERATOR_OPTIONS = [
  "National Government",
  "Regional Government",
  "Municipality",
  "University",
  "Religious Institution",
  "Private Foundation",
  "Independent",
  "Volunteer Managed",
  "Community Managed",
  "Other",
]

// ── FBlock accordion ───────────────────────────────────────────────────────────
function FBlock({
  index,
  label,
  accordion = false,
  defaultOpen = true,
  onReset,
  children,
}: {
  index: string
  label: string
  accordion?: boolean
  defaultOpen?: boolean
  onReset?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="fb">
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
            textAlign: "left",
          }}
        >
          <span className="fb-t">
            <span style={{ color: T.accent.aurora }}>{index}</span>
            {" · "}
            {label}
          </span>
          {accordion && (
            <Icon
              icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
              style={{
                fontSize: "14px",
                color: T.ink.faint,
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

// ── FCheckbox ──────────────────────────────────────────────────────────────────
function FCheckbox({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  count?: number
}) {
  return (
    <label className={`fopt ${checked ? "fopt-row-on" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: "absolute",
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      />
      <span className={`fopt-cb ${checked ? "fopt-on" : ""}`} aria-hidden>
        {checked && (
          <Icon
            icon="mdi:check"
            style={{ fontSize: "10px", color: "#052030" }}
          />
        )}
      </span>
      <span className={`fopt-label ${checked ? "fopt-label-on" : ""}`}>
        {label}
      </span>
      {count != null && (
        <span className={`fopt-note ${checked ? "fopt-note-on" : ""}`}>
          {count.toLocaleString()}
        </span>
      )}
    </label>
  )
}

// ── DistanceSlider ────────────────────────────────────────────────────────────
const MI_TO_M = 1609.344
const SLIDER_MIN = 5
const SLIDER_MAX = 250
const SLIDER_STEP = 5

function DistanceSlider({
  filters,
  onChange,
}: {
  filters: LibraryIndexFilterState
  onChange: (next: LibraryIndexFilterState) => void
}) {
  const committedMiles = Math.round(filters.nearRadius / MI_TO_M)
  const [localMiles, setLocalMiles] = useState(committedMiles)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = filters.nearLat != null

  // Sync local value when filter changes externally (e.g. reset)
  useEffect(() => {
    setLocalMiles(committedMiles)
  }, [committedMiles])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value)
    setLocalMiles(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, nearRadius: val * MI_TO_M, page: 0 })
    }, 300)
  }

  return (
    <div style={{ padding: "2px 0 4px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".1em",
            color: active ? T.ink.dim : T.ink.faint,
          }}
        >
          Within
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "13px",
            color: active ? T.accent.aurora : T.ink.faint,
          }}
        >
          {localMiles} mi
        </span>
      </div>

      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        value={localMiles}
        disabled={!active}
        onChange={handleChange}
        className="dist-slider"
        style={{
          opacity: active ? 1 : 0.35,
          ["--pct" as string]: `${((localMiles - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`,
        }}
      />

      {!active && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.ghost,
            margin: "8px 0 0",
          }}
        >
          Enable &ldquo;Find nearby&rdquo; to use
        </p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface LibraryIndexSidebarProps {
  readonly filters: LibraryIndexFilterState
  readonly onChange: (next: LibraryIndexFilterState) => void
  readonly accessibilityOptions?: string[]
  readonly serviceOptions?: string[]
}

export function LibraryIndexSidebar({
  filters,
  onChange,
  accessibilityOptions = [],
  serviceOptions = [],
}: LibraryIndexSidebarProps) {
  // ── Type group toggle ────────────────────────────────────────────────────────
  // A group is "checked" if ALL of its types are in filters.libraryTypes.
  function isGroupChecked(types: string[]): boolean {
    return types.every((t) => filters.libraryTypes.includes(t))
  }

  function toggleGroup(types: string[], checked: boolean) {
    let next = [...filters.libraryTypes]
    next = checked
      ? [...new Set([...next, ...types])]
      : next.filter((t) => !types.includes(t))
    onChange({ ...filters, libraryTypes: next, page: 0 })
  }

  // ── Status toggle ────────────────────────────────────────────────────────────
  function toggleStatus(value: string, checked: boolean) {
    const next = checked
      ? [...new Set([...filters.statuses, value])]
      : filters.statuses.filter((s) => s !== value)
    onChange({ ...filters, statuses: next, page: 0 })
  }

  // ── Accessibility toggle ──────────────────────────────────────────────────────
  function toggleAccessibility(value: string, checked: boolean) {
    const next = checked
      ? [...new Set([...filters.accessibilityNames, value])]
      : filters.accessibilityNames.filter((s) => s !== value)
    onChange({ ...filters, accessibilityNames: next, page: 0 })
  }

  // ── Service toggle ────────────────────────────────────────────────────────────
  function toggleService(value: string, checked: boolean) {
    const next = checked
      ? [...new Set([...filters.serviceNames, value])]
      : filters.serviceNames.filter((s) => s !== value)
    onChange({ ...filters, serviceNames: next, page: 0 })
  }

  // ── Operator toggle ───────────────────────────────────────────────────────────
  function toggleOperator(value: string, checked: boolean) {
    const next = checked
      ? [...new Set([...filters.operatorTypes, value])]
      : filters.operatorTypes.filter((s) => s !== value)
    onChange({ ...filters, operatorTypes: next, page: 0 })
  }

  const resetAll = () =>
    onChange({
      ...filters,
      libraryTypes: [],
      statuses: [],
      featured: false,
      accessibilityNames: [],
      serviceNames: [],
      operatorTypes: [],
      page: 0,
    })

  return (
    <div className="sb">
      {/* § 01 Library type */}
      <FBlock
        index="§ 01"
        label="Library type"
        accordion
        defaultOpen={false}
        onReset={
          filters.libraryTypes.length > 0
            ? () => onChange({ ...filters, libraryTypes: [], page: 0 })
            : undefined
        }
      >
        <div className="fopts">
          {TYPE_GROUPS.map((g) => (
            <FCheckbox
              key={g.label}
              checked={isGroupChecked(g.types)}
              onChange={(v) => toggleGroup(g.types, v)}
              label={g.label}
            />
          ))}
        </div>
      </FBlock>

      {/* § 02 Status */}
      <FBlock
        index="§ 02"
        label="Status"
        accordion
        defaultOpen={false}
        onReset={
          filters.statuses.length > 0
            ? () => onChange({ ...filters, statuses: [], page: 0 })
            : undefined
        }
      >
        <div className="fopts">
          {STATUS_OPTIONS.map((s) => (
            <FCheckbox
              key={s.value}
              checked={filters.statuses.includes(s.value)}
              onChange={(v) => toggleStatus(s.value, v)}
              label={s.label}
            />
          ))}
        </div>
      </FBlock>

      {/* Accessibility — dynamic from MeiliSearch facets */}
      {accessibilityOptions.length > 0 && (
        <FBlock
          index=""
          label="Accessibility"
          accordion
          defaultOpen={false}
          onReset={
            filters.accessibilityNames.length > 0
              ? () => onChange({ ...filters, accessibilityNames: [], page: 0 })
              : undefined
          }
        >
          <div className="fopts">
            {accessibilityOptions.map((name) => (
              <FCheckbox
                key={name}
                checked={filters.accessibilityNames.includes(name)}
                onChange={(v) => toggleAccessibility(name, v)}
                label={name}
              />
            ))}
          </div>
        </FBlock>
      )}

      {/* Facilities / Services — dynamic from MeiliSearch facets */}
      {serviceOptions.length > 0 && (
        <FBlock
          index=""
          label="Facilities"
          accordion
          defaultOpen={false}
          onReset={
            filters.serviceNames.length > 0
              ? () => onChange({ ...filters, serviceNames: [], page: 0 })
              : undefined
          }
        >
          <div className="fopts">
            {serviceOptions.map((name) => (
              <FCheckbox
                key={name}
                checked={filters.serviceNames.includes(name)}
                onChange={(v) => toggleService(name, v)}
                label={name}
              />
            ))}
          </div>
        </FBlock>
      )}

      {/* § 03 Operator */}
      <FBlock
        index="§ 03"
        label="Operator"
        accordion
        defaultOpen={false}
        onReset={
          filters.operatorTypes.length > 0
            ? () => onChange({ ...filters, operatorTypes: [], page: 0 })
            : undefined
        }
      >
        <div className="fopts">
          {OPERATOR_OPTIONS.map((label) => (
            <FCheckbox
              key={label}
              checked={filters.operatorTypes.includes(label)}
              onChange={(v) => toggleOperator(label, v)}
              label={label}
            />
          ))}
        </div>
      </FBlock>

      {/* § 04 Distance — slider, active when near-me is on */}
      <FBlock index="§ 04" label="Distance" accordion defaultOpen={false}>
        <DistanceSlider filters={filters} onChange={onChange} />
      </FBlock>

      {/* Pillar only — standalone checkbox, no accordion */}
      <FCheckbox
        checked={filters.featured}
        onChange={(v) => onChange({ ...filters, featured: v, page: 0 })}
        label="Pillar institutions only"
      />

      {/* Reset all */}
      <button type="button" className="sb-reset" onClick={resetAll}>
        Reset all filters
      </button>

      <style>{`
        .sb { display: flex; flex-direction: column; gap: 2px; }
        .fb {
          background: rgba(255,255,255,.025);
          border: 1px solid ${T.border.line};
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 6px;
        }
        .fb-hd {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .fb-t {
          font-family: ${T.font.mono};
          font-size: 9.5px;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: ${T.ink.low};
          flex: 1;
          text-align: left;
        }
        .fb-a {
          font-family: ${T.font.mono};
          font-size: 9px;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: ${T.accent.aurora};
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          opacity: 0.7;
          flex-shrink: 0;
        }
        .fb-a:hover { opacity: 1; }
        .fopts { display: flex; flex-direction: column; gap: 2px; }
        .fopt {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          cursor: pointer;
          border-radius: 7px;
          transition: background 120ms;
        }
        .fopt:hover:not(.fopt-row-on) {
          background: rgba(255,255,255,0.04);
        }
        .fopt-row-on {
          background: rgba(127,223,255,0.1);
        }
        .fopt-cb {
          width: 15px;
          height: 15px;
          border: 1.5px solid ${T.border.hi};
          border-radius: 4px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 120ms, background 120ms;
        }
        .fopt-on {
          border-color: ${T.accent.aurora} !important;
          background: ${T.accent.aurora} !important;
        }
        .fopt-label {
          font-family: ${T.font.sans};
          font-size: 13.5px;
          color: ${T.ink.dim};
          flex: 1;
          line-height: 1.3;
        }
        .fopt-label-on {
          color: ${T.accent.aurora};
        }
        .fopt-note {
          font-family: ${T.font.mono};
          font-size: 10px;
          color: ${T.ink.faint};
          flex-shrink: 0;
        }
        .fopt-note-on {
          color: rgba(127,223,255,0.6);
        }
        .sb-reset {
          font-family: ${T.font.mono};
          font-size: 9px;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: ${T.ink.faint};
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 2px;
          text-align: left;
          margin-top: 2px;
        }
        .sb-reset:hover { color: ${T.ink.dim}; }
        .dist-slider {
          width: 100%;
          appearance: none;
          height: 3px;
          border-radius: 2px;
          background: linear-gradient(
            to right,
            ${T.accent.aurora} 0%,
            ${T.accent.aurora} var(--pct, 19%),
            rgba(255,255,255,.12) var(--pct, 19%),
            rgba(255,255,255,.12) 100%
          );
          outline: none;
          cursor: pointer;
        }
        .dist-slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${T.accent.aurora};
          border: 2px solid #070b1e;
          cursor: pointer;
          transition: transform 100ms;
        }
        .dist-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .dist-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${T.accent.aurora};
          border: 2px solid #070b1e;
          cursor: pointer;
        }
        .dist-slider:disabled { cursor: not-allowed; }
      `}</style>
    </div>
  )
}
