// apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx
"use client"

import { useEffect, useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { CONTINENT_COUNTRIES, CONTINENTS } from "@/lib/data/continents"
import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"
import { OPERATIONAL_STATUSES } from "@/lib/meilisearch"
import {
  fetchRegionsByCountry,
  type RegionOption,
} from "@/lib/strapi-api/content/regions"

// ── Helpers ────────────────────────────────────────────────────────────────────
function countriesForContinent(continentSlug: string) {
  const codes = CONTINENT_COUNTRIES[continentSlug] ?? []

  return COUNTRIES.filter((c) => codes.includes(c.code)).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

// ── Select pill ────────────────────────────────────────────────────────────────
function GeoSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        fontFamily: T.font.mono,
        fontSize: "11px",
        letterSpacing: ".10em",
        textTransform: "uppercase",
        color: value ? T.ink.base : T.ink.faint,
        background: value ? "rgba(127,223,255,0.06)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${value ? "rgba(127,223,255,0.25)" : T.border.line}`,
        borderRadius: "999px",
        padding: "5px 28px 5px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
        outline: "none",
        opacity: disabled ? 0.4 : 1,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23ffffff44'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ── Sort select ────────────────────────────────────────────────────────────────
const SORT_OPTIONS: {
  value: LibraryIndexFilterState["sort"]
  label: string
}[] = [
  { value: "featured:desc,name:asc", label: "Pillar first" },
  { value: "name:asc", label: "A–Z" },
  { value: "name:desc", label: "Z–A" },
]

// ── Main component ─────────────────────────────────────────────────────────────
interface LibraryIndexGeoFilterBarProps {
  readonly filters: LibraryIndexFilterState
  readonly onChange: (next: LibraryIndexFilterState) => void
}

export function LibraryIndexGeoFilterBar({
  filters,
  onChange,
}: LibraryIndexGeoFilterBarProps) {
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [regionsLoading, setRegionsLoading] = useState(false)

  // Load regions when country changes
  useEffect(() => {
    let cancelled = false
    const slug = filters.countrySlug
    const load = slug
      ? fetchRegionsByCountry(slug)
      : Promise.resolve([] as RegionOption[])
    load.then((r) => {
      if (!cancelled) {
        setRegions(r)
        setRegionsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [filters.countrySlug])

  const countryOptions = filters.continentSlug
    ? countriesForContinent(filters.continentSlug).map((c) => ({
        value: c.slug,
        label: c.name,
      }))
    : []

  const regionOptions = regions.map((r) => ({ value: r.slug, label: r.name }))

  const continentOptions = CONTINENTS.map((c) => ({
    value: c.slug,
    label: c.name,
  }))

  function setContinent(slug: string) {
    onChange({
      ...filters,
      continentSlug: slug,
      countrySlug: "",
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
  }

  function setCountry(slug: string) {
    onChange({
      ...filters,
      countrySlug: slug,
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
  }

  function setRegion(slug: string) {
    onChange({ ...filters, regionSlug: slug, areaSlug: "", page: 0 })
  }

  function resetGeo() {
    onChange({
      ...filters,
      continentSlug: "",
      countrySlug: "",
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
  }

  const hasGeoFilter =
    filters.continentSlug || filters.countrySlug || filters.regionSlug

  const activeTypes = filters.libraryTypes
  const activeStatuses = filters.statuses
  const hasSidebarFilters =
    activeTypes.length > 0 ||
    activeStatuses.length > 0 ||
    filters.featured ||
    filters.accessibilityNames.length > 0 ||
    filters.serviceNames.length > 0 ||
    filters.operatorTypes.length > 0

  function removeType(t: string) {
    onChange({
      ...filters,
      libraryTypes: filters.libraryTypes.filter((x) => x !== t),
      page: 0,
    })
  }

  function removeStatus(s: string) {
    onChange({
      ...filters,
      statuses: filters.statuses.filter((x) => x !== s),
      page: 0,
    })
  }

  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        marginBottom: "20px",
      }}
    >
      {/* Main filter row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          paddingBottom: "10px",
        }}
      >
        {/* Geo selects */}
        <GeoSelect
          value={filters.continentSlug}
          onChange={setContinent}
          placeholder="All continents"
          options={continentOptions}
        />
        <GeoSelect
          value={filters.countrySlug}
          onChange={setCountry}
          placeholder="Country"
          options={countryOptions}
          disabled={!filters.continentSlug}
        />
        <GeoSelect
          value={filters.regionSlug}
          onChange={setRegion}
          placeholder={regionsLoading ? "Loading…" : "Region"}
          options={regionOptions}
          disabled={!filters.countrySlug || regionsLoading}
        />

        {/* Sort */}
        <GeoSelect
          value={filters.sort}
          onChange={(v) =>
            onChange({
              ...filters,
              sort: v as LibraryIndexFilterState["sort"],
              page: 0,
            })
          }
          placeholder="Sort"
          options={SORT_OPTIONS}
        />

        {/* Reset geo */}
        {hasGeoFilter && (
          <button
            type="button"
            onClick={resetGeo}
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: T.ink.faint,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 8px",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Active filter pills row */}
      {hasSidebarFilters && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px",
            paddingBottom: "10px",
          }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.ink.ghost,
              marginRight: "2px",
            }}
          >
            Active:
          </span>

          {filters.featured && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, featured: false, page: 0 })}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.accent.gold,
                background: "rgba(232,201,138,0.1)",
                border: "1px solid rgba(232,201,138,0.25)",
                borderRadius: "4px",
                padding: "2px 7px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ✦ Pillar <span style={{ opacity: 0.6 }}>×</span>
            </button>
          )}

          {activeTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => removeType(t)}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                background: "rgba(127,223,255,0.08)",
                border: "1px solid rgba(127,223,255,0.2)",
                borderRadius: "4px",
                padding: "2px 7px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {t} <span style={{ opacity: 0.6 }}>×</span>
            </button>
          ))}

          {activeStatuses.map((s) => {
            const label =
              OPERATIONAL_STATUSES.find((o) => o.value === s)?.label ?? s

            return (
              <button
                key={s}
                type="button"
                onClick={() => removeStatus(s)}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.accent.ember,
                  background: "rgba(255,184,138,0.08)",
                  border: "1px solid rgba(255,184,138,0.2)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {label} <span style={{ opacity: 0.6 }}>×</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() =>
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
            }
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              marginLeft: "2px",
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
