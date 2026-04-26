"use client"

import { useState } from "react"
import { toast } from "sonner"

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

export function LibraryClaimSearch({
  onClaimed,
}: {
  onClaimed: (
    result: ClaimResult & { libraryName: string; entityRef: string }
  ) => void
}) {
  const [countrySlug, setCountrySlug] = useState("")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<LibraryHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<LibraryHit | null>(null)
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${T.border.hi}`,
    background: "rgba(255,255,255,0.04)",
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: "Roboto, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const search = async (q: string) => {
    setQuery(q)
    if (!q.trim() && !countrySlug) {
      setHits([])

      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ q })
      if (countrySlug) params.set("country_slug", countrySlug)
      const res = await fetch(`/api/libraries/search?${params}`)
      const json = (await res.json()) as { hits: LibraryHit[] }
      setHits(json.hits)
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
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
          borderRadius: "8px",
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
      {/* Country filter */}
      <div>
        <label
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase" as const,
            color: T.ink.faint,
            display: "block",
            marginBottom: "6px",
          }}
        >
          Filter by country
        </label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={countrySlug}
          onChange={(e) => {
            setCountrySlug(e.target.value)
            void search(query)
          }}
        >
          <option value="" style={{ background: "#070b1e" }}>
            All countries
          </option>
          {COUNTRIES.map((c) => (
            <option
              key={c.code}
              value={c.code.toLowerCase()}
              style={{ background: "#070b1e" }}
            >
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Library search */}
      <div>
        <label
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase" as const,
            color: T.ink.faint,
            display: "block",
            marginBottom: "6px",
          }}
        >
          Search for your library
        </label>
        <input
          style={inputStyle}
          type="text"
          value={query}
          onChange={(e) => void search(e.target.value)}
          placeholder="British Library, Bibliothèque nationale…"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      {/* Results */}
      {searching && (
        <p
          style={{
            fontSize: "12px",
            color: T.ink.faint,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          Searching…
        </p>
      )}

      {!searching && hits.length > 0 && !selected && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
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
                fontFamily: "Roboto, sans-serif",
                cursor: "pointer",
                textAlign: "left",
              }}
              className="hover:bg-white/[0.04]"
            >
              <strong style={{ color: T.ink.base }}>{hit.name}</strong>
              {(hit.city || hit.country_name) && (
                <span
                  style={{
                    fontSize: "11px",
                    color: T.ink.faint,
                    marginLeft: "8px",
                    fontFamily: "JetBrains Mono, monospace",
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
              borderRadius: "8px",
              background: "rgba(127,223,255,0.06)",
              border: "1px solid rgba(127,223,255,0.2)",
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
                    fontSize: "11px",
                    color: T.ink.faint,
                    fontFamily: "JetBrains Mono, monospace",
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
            <label
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase" as const,
                color: T.ink.faint,
                display: "block",
                marginBottom: "6px",
              }}
            >
              Your role
            </label>
            <input
              style={inputStyle}
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Reference Librarian"
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>

          <div>
            <label
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase" as const,
                color: T.ink.faint,
                display: "block",
                marginBottom: "6px",
              }}
            >
              Department (optional)
            </label>
            <input
              style={inputStyle}
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Rare Books"
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>

          <button
            type="button"
            disabled={claiming}
            onClick={() => void handleClaim()}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid rgba(127,223,255,0.35)",
              background: "rgba(127,223,255,0.1)",
              color: T.accent.aurora,
              fontSize: "13px",
              fontFamily: "Roboto, sans-serif",
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
