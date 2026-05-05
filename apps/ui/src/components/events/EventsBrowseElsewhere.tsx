"use client"

import { useMemo, useState } from "react"

import { SectionHeader } from "@/components/ds"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { CountryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import {
  type Continent,
  CONTINENTS,
  getContinent,
  getCountryName,
} from "@/lib/iso-continent"

interface EventsBrowseElsewhereProps {
  readonly countryBreakdown: CountryStat[]
  readonly filters: FilterState
  readonly onFiltersChange: (next: FilterState) => void
}

export function EventsBrowseElsewhere({
  countryBreakdown,
  filters,
  onFiltersChange,
}: EventsBrowseElsewhereProps) {
  const [activeContinent, setActiveContinent] = useState<Continent | "All">(
    "All"
  )

  // Compute continent totals
  const continentTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const c of countryBreakdown) {
      const cont = getContinent(c.countryCode)
      if (cont) totals[cont] = (totals[cont] ?? 0) + c.count
    }

    return totals
  }, [countryBreakdown])

  // Countries for current continent tab
  const visibleCountries = useMemo(() => {
    if (activeContinent === "All") return countryBreakdown.slice(0, 24)

    return countryBreakdown.filter(
      (c) => getContinent(c.countryCode) === activeContinent
    )
  }, [countryBreakdown, activeContinent])

  if (countryBreakdown.length === 0) return null

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: T.font.mono,
    fontSize: "10px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    padding: "8px 14px",
    border: "none",
    background: active ? "rgba(127,223,255,0.1)" : "transparent",
    color: active ? T.accent.aurora : T.ink.low,
    cursor: "pointer",
    borderBottom: active
      ? `2px solid ${T.accent.aurora}`
      : "2px solid transparent",
    transition: "all 150ms",
    whiteSpace: "nowrap",
  })

  return (
    <section style={{ padding: "60px 0 80px" }}>
      <div style={{ maxWidth: "1296px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ marginBottom: "32px" }}>
          <SectionHeader italic="elsewhere.">
            Browse the programme
          </SectionHeader>
        </div>

        {/* Continent tabs */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            borderBottom: `1px solid ${T.border.line}`,
            marginBottom: "24px",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            style={tabStyle(activeContinent === "All")}
            onClick={() => setActiveContinent("All")}
          >
            All
          </button>
          {CONTINENTS.filter((c) => continentTotals[c]).map((c) => (
            <button
              key={c}
              type="button"
              style={tabStyle(activeContinent === c)}
              onClick={() => setActiveContinent(c)}
            >
              {c}{" "}
              <span style={{ opacity: 0.5 }}>
                ({continentTotals[c]?.toLocaleString() ?? 0})
              </span>
            </button>
          ))}
        </div>

        {/* Country grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "8px",
          }}
        >
          {visibleCountries.map((c) => (
            <button
              key={c.countryCode}
              type="button"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  countryCode: c.countryCode,
                  page: 1,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                border: `1px solid ${
                  filters.countryCode === c.countryCode
                    ? "rgba(127,223,255,0.3)"
                    : T.border.line
                }`,
                borderRadius: "10px",
                background:
                  filters.countryCode === c.countryCode
                    ? "rgba(127,223,255,0.06)"
                    : T.bg.deep,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 150ms",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color:
                    filters.countryCode === c.countryCode
                      ? T.accent.aurora
                      : T.ink.dim,
                  letterSpacing: ".04em",
                }}
              >
                {getCountryName(c.countryCode)}
              </span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: T.ink.ghost,
                }}
              >
                {c.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
