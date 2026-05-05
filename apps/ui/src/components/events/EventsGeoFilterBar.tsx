"use client"

import { useMemo, useState } from "react"

import type { FilterState } from "@/components/events/EventsFilterBar"
import type { CountryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { CONTINENTS, getContinent, getCountryName } from "@/lib/iso-continent"

interface EventsGeoFilterBarProps {
  readonly filters: FilterState
  readonly onChange: (next: FilterState) => void
  readonly countryBreakdown: CountryStat[]
}

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: "11px",
  letterSpacing: ".08em",
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: "8px",
  color: T.ink.dim,
  padding: "6px 10px",
  cursor: "pointer",
  outline: "none",
  appearance: "none" as const,
  paddingRight: "24px",
}

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
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        padding: "6px 12px",
        borderRadius: "20px",
        border: `1px solid ${active ? "rgba(127,223,255,0.3)" : T.border.line}`,
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        color: active ? T.accent.aurora : T.ink.low,
        cursor: "pointer",
        transition: "all 150ms",
      }}
    >
      {children}
    </button>
  )
}

export function EventsGeoFilterBar({
  filters,
  onChange,
  countryBreakdown,
}: EventsGeoFilterBarProps) {
  const [selectedContinent, setSelectedContinent] = useState("")

  // Build country options for the selected continent
  const continentCountries = useMemo(() => {
    const codes = countryBreakdown.map((c) => c.countryCode)
    if (!selectedContinent) return codes

    return codes.filter((c) => getContinent(c) === selectedContinent)
  }, [countryBreakdown, selectedContinent])

  const activeFilters: string[] = []
  if (filters.countryCode)
    activeFilters.push(getCountryName(filters.countryCode))
  if (filters.priceScope === "free") activeFilters.push("Free")
  if (filters.page > 1) activeFilters.push(`Page ${filters.page}`)

  return (
    <div
      className="sticky top-14 z-20"
      style={{
        background: "var(--t-header-bg)",
        borderBottom: `1px solid ${T.border.line}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: "1296px",
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          flexWrap: "wrap",
        }}
      >
        {/* Continent */}
        <div style={{ position: "relative" }}>
          <select
            value={selectedContinent}
            onChange={(e) => {
              setSelectedContinent(e.target.value)
              onChange({ ...filters, countryCode: "", page: 1 })
            }}
            style={SELECT_STYLE}
          >
            <option value="">All continents</option>
            {CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: T.ink.ghost,
              fontSize: "10px",
            }}
          >
            ▾
          </span>
        </div>

        {/* Country */}
        <div style={{ position: "relative" }}>
          <select
            value={filters.countryCode}
            onChange={(e) =>
              onChange({ ...filters, countryCode: e.target.value, page: 1 })
            }
            style={SELECT_STYLE}
          >
            <option value="">Country</option>
            {continentCountries.map((code) => (
              <option key={code} value={code}>
                {getCountryName(code)}
              </option>
            ))}
          </select>
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: T.ink.ghost,
              fontSize: "10px",
            }}
          >
            ▾
          </span>
        </div>

        <div
          style={{
            width: "1px",
            height: "20px",
            background: T.border.line,
            flexShrink: 0,
          }}
        />

        <Pill
          active={filters.priceScope === "free"}
          onClick={() =>
            onChange({
              ...filters,
              priceScope: filters.priceScope === "free" ? "all" : "free",
              page: 1,
            })
          }
        >
          Free
        </Pill>

        <Pill active={false} onClick={() => onChange({ ...filters, page: 1 })}>
          New
        </Pill>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div
          style={{
            maxWidth: "1296px",
            margin: "0 auto",
            padding: "6px 24px 10px",
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {activeFilters.map((label) => (
            <span
              key={label}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: "12px",
                border: `1px solid ${T.border.line}`,
                color: T.ink.low,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {label}
            </span>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                countryCode: "",
                regionSlug: "",
                priceScope: "all",
                page: 1,
              })
            }
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.accent.danger,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "3px 4px",
            }}
          >
            Clear ×
          </button>
        </div>
      )}
    </div>
  )
}
