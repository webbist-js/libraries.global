// apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx
"use client"

import { useEffect, useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { CONTINENT_COUNTRIES, CONTINENTS } from "@/lib/data/continents"
import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

// ── Types ──────────────────────────────────────────────────────────────────────
interface RegionOption {
  slug: string
  name: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function countriesForContinent(continentSlug: string) {
  const codes = CONTINENT_COUNTRIES[continentSlug] ?? []

  return COUNTRIES.filter((c) => codes.includes(c.code)).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

async function fetchRegions(countrySlug: string): Promise<RegionOption[]> {
  try {
    const res = await fetch(
      `/api/regions?countrySlug=${encodeURIComponent(countrySlug)}`,
      { cache: "force-cache" }
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { name?: string; slug?: string }[]
    }

    return (json.data ?? [])
      .filter((r) => r.slug && r.name)
      .map((r) => ({ slug: r.slug!, name: r.name! }))
  } catch {
    return []
  }
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
  { value: "featured:desc,name:asc", label: "Featured first" },
  { value: "name:asc", label: "A–Z" },
  { value: "name:desc", label: "Z–A" },
]

// ── Main component ─────────────────────────────────────────────────────────────
interface LibraryIndexGeoFilterBarProps {
  readonly filters: LibraryIndexFilterState
  readonly onChange: (next: LibraryIndexFilterState) => void
  readonly resultCount?: number
}

export function LibraryIndexGeoFilterBar({
  filters,
  onChange,
  resultCount,
}: LibraryIndexGeoFilterBarProps) {
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [regionsLoading, setRegionsLoading] = useState(false)

  // Load regions when country changes
  useEffect(() => {
    let cancelled = false
    const slug = filters.countrySlug
    const load = slug
      ? fetchRegions(slug)
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

  // Active geo label for result count string
  const geoLabel = [
    filters.regionSlug &&
      regions.find((r) => r.slug === filters.regionSlug)?.name,
    filters.countrySlug &&
      countryOptions.find((c) => c.value === filters.countrySlug)?.label,
    filters.continentSlug &&
      continentOptions.find((c) => c.value === filters.continentSlug)?.label,
  ]
    .filter(Boolean)
    .join(", ")

  const hasGeoFilter =
    filters.continentSlug || filters.countrySlug || filters.regionSlug

  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: T.bg.space,
        position: "sticky",
        top: "56px",
        zIndex: 15,
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
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

        {/* Reset */}
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Result count */}
        {resultCount != null && (
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              color: T.ink.faint,
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            {resultCount.toLocaleString()} libraries
            {geoLabel ? ` in ${geoLabel}` : ""}
          </p>
        )}

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
      </div>
    </div>
  )
}
