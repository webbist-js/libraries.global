"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { SearchField } from "@/components/ds"
import { CONTINENT_COUNTRIES, CONTINENTS } from "@/lib/data/continents"
import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

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

type ClaimResult = { status: "verified" | "pending"; method: string }

// ── Inline searchable combobox for countries (returns slug, not code) ─────────

function CountrySlugCombobox({
  countries,
  value,
  onChange,
  disabled,
}: {
  countries: { slug: string; name: string; code: string }[]
  value: string
  onChange: (slug: string) => void
  disabled?: boolean
}) {
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

  const triggerStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${T.border.hi}`,
    background: disabled ? T.bg.deep : T.bg.surface,
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: T.font.sans,
    outline: "none",
    boxSizing: "border-box",
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    opacity: disabled ? 0.5 : 1,
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={triggerStyle}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span style={{ color: selected ? T.ink.base : T.ink.faint }}>
          {selected ? selected.name : "Select country…"}
        </span>
        <span style={{ color: T.ink.faint, fontSize: "10px" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--t-bg-deep)",
            border: `1px solid ${T.border.hi}`,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "13px",
              fontFamily: T.font.sans,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => {
                onChange("")
                setOpen(false)
                setQuery("")
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "9px 14px",
                background: !value ? T.accent.chip : "transparent",
                border: "none",
                color: !value ? T.accent.primaryHover : T.ink.dim,
                fontSize: "13px",
                fontFamily: T.font.sans,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              All countries
            </button>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  color: T.ink.faint,
                  fontSize: "13px",
                }}
              >
                No results
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.slug)
                  setOpen(false)
                  setQuery("")
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background: c.slug === value ? T.accent.chip : "transparent",
                  border: "none",
                  color: c.slug === value ? T.accent.primaryHover : T.ink.dim,
                  fontSize: "13px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-white/[0.05]"
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

// ── Main component ─────────────────────────────────────────────────────────────

export function LibraryClaimSearch({
  onClaimed,
}: {
  onClaimed: (
    result: ClaimResult & { libraryName: string; entityRef: string }
  ) => void
}) {
  const [continentSlug, setContinentSlug] = useState("")
  const [countrySlug, setCountrySlug] = useState("")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<LibraryHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<LibraryHit | null>(null)
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  // Countries filtered to the selected continent
  const continentIsoCodes = continentSlug
    ? (CONTINENT_COUNTRIES[continentSlug] ?? [])
    : null

  const filteredCountries = COUNTRIES.filter(
    (c) => !continentIsoCodes || continentIsoCodes.includes(c.code)
  )

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${T.border.hi}`,
    background: T.bg.surface,
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: T.font.sans,
    outline: "none",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: T.font.sans,
    fontSize: "14px",
    fontWeight: 500,
    color: T.ink.faint,
    display: "block",
    marginBottom: "6px",
  }

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
      setClaimResult(json)
      onClaimed({
        ...json,
        libraryName: selected.name,
        entityRef: selected.entityRef ?? String(selected.id),
      })
    } catch {
      toast.error("Claim failed")
    } finally {
      setClaiming(false)
    }
  }

  if (claimResult) {
    return (
      <div
        style={{
          padding: "16px 20px",
          borderRadius: "10px",
          border: `1px solid ${claimResult.status === "verified" ? "rgba(142,240,179,0.3)" : "rgba(255,207,122,0.3)"}`,
          background:
            claimResult.status === "verified"
              ? "rgba(142,240,179,0.05)"
              : "rgba(255,207,122,0.05)",
        }}
      >
        {claimResult.status === "verified" ? (
          <p style={{ margin: 0, fontSize: "13px", color: T.accent.ok }}>
            Verified — your email domain matched the library&apos;s website. You
            are now a verified librarian.
          </p>
        ) : claimResult.method === "vouching" ? (
          <p style={{ margin: 0, fontSize: "13px", color: T.accent.warn }}>
            Your claim is pending verification by a verified librarian at this
            institution.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "13px", color: T.accent.warn }}>
            Your claim has been submitted. Our team will verify and get back to
            you via email.
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Continent + country row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        <div>
          <label style={labelStyle}>Continent</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={continentSlug}
            onChange={(e) => handleContinentChange(e.target.value)}
          >
            <option value="" style={{ background: "var(--t-bg-deep)" }}>
              All continents
            </option>
            {CONTINENTS.map((c) => (
              <option
                key={c.slug}
                value={c.slug}
                style={{ background: "var(--t-bg-deep)" }}
              >
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Country</label>
          <CountrySlugCombobox
            countries={filteredCountries}
            value={countrySlug}
            onChange={handleCountryChange}
          />
        </div>
      </div>

      {/* Library search */}
      <SearchField
        id="claim-library-search"
        label="Search for your library"
        placeholder="Search for your library — e.g. British Library"
        onClear={() => void search("")}
        inputProps={{
          value: query,
          onChange: (e) => void search(e.target.value),
          autoComplete: "off",
        }}
      />

      {/* Results */}
      {searching && (
        <p
          style={{
            fontSize: "14px",
            color: T.ink.dim,
          }}
        >
          Searching…
        </p>
      )}

      {!searching && hits.length === 0 && query.trim() && (
        <p
          style={{
            fontSize: "14px",
            color: T.ink.dim,
          }}
        >
          No libraries found — try a different name or broaden your filters.
        </p>
      )}

      {!searching && hits.length > 0 && !selected && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          {hits.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => setSelected(hit)}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                borderBottom:
                  i < hits.length - 1 ? `1px solid ${T.border.line}` : "none",
                color: T.ink.dim,
                fontSize: "13px",
                fontFamily: T.font.sans,
                cursor: "pointer",
                textAlign: "left",
              }}
              className="hover:bg-(--t-bg-deep)"
            >
              <strong style={{ color: T.ink.base }}>{hit.name}</strong>
              {(hit.city || hit.country_name) && (
                <span
                  style={{
                    fontSize: "13px",
                    color: T.ink.dim,
                    marginLeft: "10px",
                  }}
                >
                  {[hit.city, hit.country_name].filter(Boolean).join(", ")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected library — show role/department fields */}
      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: T.accent.chip,
              border: "1px solid var(--t-aurora-edge)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: T.ink.base,
                }}
              >
                {selected.name}
              </p>
              {(selected.city || selected.country_name) && (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "13px",
                    color: T.ink.dim,
                  }}
                >
                  {[selected.city, selected.country_name]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                background: "none",
                border: "none",
                color: T.ink.faint,
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Change
            </button>
          </div>

          <div>
            <label style={labelStyle}>Your role</label>
            <input
              style={inputStyle}
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Reference Librarian"
            />
          </div>

          <div>
            <label style={labelStyle}>Department (optional)</label>
            <input
              style={inputStyle}
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Rare Books"
            />
          </div>

          <button
            type="button"
            disabled={claiming}
            onClick={() => void handleClaim()}
            style={{
              padding: "10px 20px",
              borderRadius: "999px",
              border: "none",
              background: T.accent.primary,
              color: "#fff",
              fontSize: "14px",
              fontFamily: T.font.sans,
              fontWeight: 600,
              cursor: claiming ? "not-allowed" : "pointer",
              opacity: claiming ? 0.7 : 1,
            }}
          >
            {claiming ? "Submitting…" : "Claim affiliation"}
          </button>
        </div>
      )}
    </div>
  )
}
