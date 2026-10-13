"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { SearchField } from "@/components/ds"
import { CONTINENT_COUNTRIES, CONTINENTS } from "@/lib/data/continents"
import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

import { fieldInput, fieldLabel, Select, Tag } from "./FormParts"

type LibraryHit = {
  id: number
  name: string
  city?: string
  country_name?: string
  country_slug?: string
  entityRef?: string
  website?: string
  libraryType?: string
}

export type ClaimResult = { status: "verified" | "pending"; method: string }

const optionStyle = (active: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  padding: "10px 16px",
  background: active ? T.accent.chip : "transparent",
  border: "none",
  color: active ? T.accent.primaryHover : T.ink.base,
  fontSize: "15px",
  fontWeight: active ? 600 : 400,
  fontFamily: T.font.sans,
  cursor: "pointer",
  textAlign: "left",
})

// ── Inline searchable combobox for countries (returns slug, not code) ─────────

function CountrySlugCombobox({
  countries,
  value,
  onChange,
  disabled,
  id,
  labelledBy,
}: {
  countries: { slug: string; name: string; code: string }[]
  value: string
  onChange: (slug: string) => void
  disabled?: boolean
  /** The trigger button's id, for a `<label htmlFor>`. */
  id: string
  /**
   * The visible label's id. The trigger is named by the label and its
   * current value; a `<label htmlFor>` alone would drop the value.
   */
  labelledBy: string
}) {
  const tUi = useUiTranslations("ui")

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = countries.find((c) => c.slug === value)
  const filtered = query
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : countries

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)

    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const choose = (slug: string) => {
    onChange(slug)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        id={id}
        type="button"
        aria-labelledby={`${labelledBy} ${id}-value`}
        style={{
          ...fieldInput,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span
          id={`${id}-value`}
          style={{ color: selected ? T.ink.base : T.ink.dim }}
        >
          {selected ? selected.name : "Select country…"}
        </span>
        <Icon
          aria-hidden="true"
          icon="mdi:chevron-down"
          width={18}
          height={18}
          style={{ color: T.ink.dim, flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: T.bg.deep,
            border: `1px solid ${T.border.hi}`,
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 12px 28px rgba(23,22,43,.12)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            aria-label={tUi("search_countries")}
            placeholder={tUi("search_countries_2")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "15px",
              fontFamily: T.font.sans,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => choose("")}
              style={optionStyle(!value)}
              className="hover:bg-(--t-bg-surface)"
            >
              All countries
            </button>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  color: T.ink.dim,
                  fontSize: "15px",
                }}
              >
                {tUi("no_results")}{" "}
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => choose(c.slug)}
                style={optionStyle(c.slug === value)}
                className="hover:bg-(--t-bg-surface)"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** "Edinburgh, United Kingdom", or "" when neither is known. */
const placeOf = (hit: LibraryHit) =>
  [hit.city, hit.country_name].filter(Boolean).join(", ")

/** What the screen-reader status line says about the search. */
function searchStatus(searching: boolean, query: string, count: number) {
  if (searching) return "Searching…"
  if (!query.trim()) return ""

  return `${count} ${count === 1 ? "library" : "libraries"} found`
}

/** The chosen library, with a way back to the results. */
function SelectedLibrary({
  hit,
  onChange,
}: {
  hit: LibraryHit
  onChange: () => void
}) {
  const place = placeOf(hit)

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[16px] px-4 py-3.5"
      style={{
        border: `1.5px solid ${T.accent.primary}`,
        background:
          "color-mix(in srgb, var(--t-accent-chip) 45%, var(--t-bg-deep))",
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          aria-hidden="true"
          icon="mdi:bank-outline"
          width={20}
          height={20}
          className="mt-0.5 shrink-0"
          style={{ color: T.accent.primary }}
        />
        <div className="min-w-0">
          <p
            className="m-0 text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {hit.name}
          </p>
          {place ? (
            <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
              {place}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold underline underline-offset-[3px]"
        style={{ color: T.accent.primary }}
      >
        Change<span className="sr-only"> library</span>
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * Find a library on the atlas and claim an affiliation with it. The caller
 * shows the outcome once `onClaimed` fires.
 */
export function LibraryClaimSearch({
  onClaimed,
}: {
  onClaimed: (
    result: ClaimResult & { libraryName: string; entityRef: string }
  ) => void
}) {
  const tUi = useUiTranslations("ui")

  const [continentSlug, setContinentSlug] = useState("")
  const [countrySlug, setCountrySlug] = useState("")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<LibraryHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<LibraryHit | null>(null)
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [claiming, setClaiming] = useState(false)

  // Stable ids that tie each visible label to its control.
  const uid = useId()
  const ids = {
    continent: `${uid}-continent`,
    country: `${uid}-country`,
    countryLabel: `${uid}-country-label`,
    role: `${uid}-role`,
    department: `${uid}-department`,
  }

  // Countries filtered to the selected continent
  const continentIsoCodes = continentSlug
    ? (CONTINENT_COUNTRIES[continentSlug] ?? [])
    : null

  const filteredCountries = COUNTRIES.filter(
    (c) => !continentIsoCodes || continentIsoCodes.includes(c.code)
  )

  const search = async (
    q: string,
    cSlug: string = countrySlug,
    ctSlug: string = continentSlug
  ) => {
    setQuery(q)
    if (!q.trim() && !cSlug && !ctSlug) {
      setHits([])

      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ q })
      if (cSlug) params.set("country_slug", cSlug)
      else if (ctSlug) params.set("continent_slug", ctSlug)
      const res = await fetch(`/api/libraries/search?${params}`)
      const json = (await res.json()) as { hits: LibraryHit[] }
      setHits(json.hits)
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }

  const handleContinentChange = (slug: string) => {
    setContinentSlug(slug)
    setCountrySlug("") // reset country when continent changes
    void search(query, "", slug)
  }

  const handleCountryChange = (slug: string) => {
    setCountrySlug(slug)
    void search(query, slug, continentSlug)
  }

  const handleClaim = async () => {
    if (!selected) return
    setClaiming(true)
    try {
      const res = await fetch("/api/profile/me/claim-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryEntityRef: selected.entityRef ?? String(selected.id),
          libraryName: selected.name,
          libraryWebsite: selected.website ?? "",
          role,
          department,
        }),
      })
      const json = (await res.json()) as ClaimResult & { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Claim failed")

        return
      }
      onClaimed({
        status: json.status,
        method: json.method,
        libraryName: selected.name,
        entityRef: selected.entityRef ?? String(selected.id),
      })
    } catch {
      toast.error("Claim failed")
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Continent + country row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.continent} style={fieldLabel}>
            {tUi("continent")}{" "}
          </label>
          <Select
            id={ids.continent}
            value={continentSlug}
            onChange={(e) => handleContinentChange(e.target.value)}
          >
            <option value="">All continents</option>
            {CONTINENTS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label id={ids.countryLabel} htmlFor={ids.country} style={fieldLabel}>
            {tUi("country")}{" "}
          </label>
          <CountrySlugCombobox
            id={ids.country}
            labelledBy={ids.countryLabel}
            countries={filteredCountries}
            value={countrySlug}
            onChange={handleCountryChange}
          />
        </div>
      </div>

      {/* Library search */}
      <SearchField
        id={`${uid}-search`}
        label={tUi("search_for_your_library")}
        placeholder={tUi("search_for_your_library_eg_british_library")}
        onClear={() => void search("")}
        inputProps={{
          value: query,
          onChange: (e) => void search(e.target.value),
          autoComplete: "off",
        }}
      />

      {/* Results */}
      <p aria-live="polite" className="sr-only">
        {searchStatus(searching, query, hits.length)}
      </p>

      {searching ? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          Searching…
        </p>
      ) : null}

      {!searching && hits.length === 0 && query.trim() ? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          No libraries found. Try a different name or broaden your filters.
        </p>
      ) : null}

      {!searching && hits.length > 0 && !selected ? (
        <ul
          className="m-0 list-none overflow-hidden rounded-[14px] p-0"
          style={{
            border: `1px solid ${T.border.line}`,
            background: T.bg.deep,
          }}
        >
          {hits.map((hit, i) => (
            <li
              key={hit.id}
              style={
                i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : {}
              }
            >
              <button
                type="button"
                onClick={() => setSelected(hit)}
                className="flex w-full cursor-pointer flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-0 bg-transparent px-4 py-3 text-left hover:bg-(--t-bg-surface)"
                style={{ fontFamily: T.font.sans }}
              >
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {hit.name}
                </span>
                <span className="text-[14px]" style={{ color: T.ink.dim }}>
                  {placeOf(hit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Selected library — show role/department fields */}
      {selected ? (
        <div className="flex flex-col gap-4">
          <SelectedLibrary hit={selected} onChange={() => setSelected(null)} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.role} style={fieldLabel}>
                Your role
              </label>
              <input
                id={ids.role}
                style={fieldInput}
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Reference Librarian"
              />
            </div>

            <div>
              <label htmlFor={ids.department} style={fieldLabel}>
                Department<Tag>{tUi("optional_59be71")}</Tag>
              </label>
              <input
                id={ids.department}
                style={fieldInput}
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Rare Books"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={claiming}
            onClick={() => void handleClaim()}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
            style={{ border: "none", fontFamily: T.font.sans }}
          >
            {claiming ? tUi("sending") : "Claim affiliation"}
          </button>
        </div>
      ) : null}
    </div>
  )
}
