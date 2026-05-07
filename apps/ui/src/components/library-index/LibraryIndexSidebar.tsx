// apps/ui/src/components/library-index/LibraryIndexSidebar.tsx
"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

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
    <label className="fopt">
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
            style={{ fontSize: "9px", color: T.accent.aurora }}
          />
        )}
      </span>
      <span className="fopt-label">{label}</span>
      {count != null && (
        <span className="fopt-note">{count.toLocaleString()}</span>
      )}
    </label>
  )
}

// ── FComingSoon — placeholder for filters that need range UI ─────────────────
function FComingSoon({ text }: { text: string }) {
  return (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "9px",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: T.ink.ghost,
        margin: "4px 0 2px",
      }}
    >
      {text}
    </p>
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
      {/* Search within results */}
      <div style={{ marginBottom: "8px" }}>
        <input
          type="search"
          value={filters.query}
          onChange={(e) =>
            onChange({ ...filters, query: e.target.value, page: 0 })
          }
          placeholder="Search within results…"
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

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

      {/* § 03 Pillar only */}
      <FBlock index="§ 03" label="Pillar only" accordion defaultOpen={false}>
        <div className="fopts">
          <FCheckbox
            checked={filters.featured}
            onChange={(v) => onChange({ ...filters, featured: v, page: 0 })}
            label="Pillar institutions only"
          />
        </div>
      </FBlock>

      {/* § 04 Accessibility — dynamic from MeiliSearch facets */}
      {accessibilityOptions.length > 0 && (
        <FBlock
          index="§ 04"
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

      {/* § 05 Facilities / Services — dynamic from MeiliSearch facets */}
      {serviceOptions.length > 0 && (
        <FBlock
          index="§ 05"
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

      {/* § 06 Operator */}
      <FBlock
        index="§ 06"
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

      {/* § 07 Collection size — requires range slider + numeric MeiliSearch field */}
      <FBlock
        index="§ 07"
        label="Collection size"
        accordion
        defaultOpen={false}
      >
        <div style={{ padding: "4px 0 2px" }}>
          <FComingSoon text="Range filter coming soon" />
        </div>
      </FBlock>

      {/* § 08 Founded year — requires numeric MeiliSearch filterable attribute */}
      <FBlock index="§ 08" label="Founded year" accordion defaultOpen={false}>
        <div style={{ padding: "4px 0 2px" }}>
          <FComingSoon text="Range filter coming soon" />
        </div>
      </FBlock>

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
        .fopts { display: flex; flex-direction: column; gap: 4px; }
        .fopt {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 0;
          cursor: pointer;
        }
        .fopt-cb {
          width: 14px;
          height: 14px;
          border: 1px solid ${T.border.hi};
          border-radius: 3px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 150ms, background 150ms;
        }
        .fopt-on {
          border-color: ${T.accent.aurora} !important;
          background: rgba(127,223,255,0.12) !important;
        }
        .fopt-label {
          font-size: 13px;
          color: ${T.ink.dim};
          flex: 1;
        }
        .fopt-note {
          font-family: ${T.font.mono};
          font-size: 10px;
          color: ${T.ink.faint};
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
      `}</style>
    </div>
  )
}
