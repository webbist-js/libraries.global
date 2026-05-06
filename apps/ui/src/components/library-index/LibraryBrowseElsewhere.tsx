// apps/ui/src/components/library-index/LibraryBrowseElsewhere.tsx
"use client"

import { useEffect, useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { CONTINENTS } from "@/lib/data/continents"
import { T } from "@/lib/design-tokens"
import { meiliClient } from "@/lib/meilisearch"

interface ContinentCount {
  slug: string
  name: string
  count: number
}

async function fetchContinentCounts(): Promise<ContinentCount[]> {
  try {
    const result = await meiliClient.index("library").search("", {
      facets: ["continent_slug"],
      hitsPerPage: 0,
    })
    const dist =
      (
        result.facetDistribution as
          | Record<string, Record<string, number>>
          | undefined
      )?.continent_slug ?? {}

    return CONTINENTS.map((c) => ({
      slug: c.slug,
      name: c.name,
      count: dist[c.slug] ?? 0,
    }))
  } catch {
    return CONTINENTS.map((c) => ({ slug: c.slug, name: c.name, count: 0 }))
  }
}

interface LibraryBrowseElsewhereProps {
  readonly filters: LibraryIndexFilterState
  readonly onFiltersChange: (next: LibraryIndexFilterState) => void
  readonly totalLibraries?: number
}

export function LibraryBrowseElsewhere({
  filters,
  onFiltersChange,
  totalLibraries = 0,
}: LibraryBrowseElsewhereProps) {
  const [counts, setCounts] = useState<ContinentCount[]>([])

  useEffect(() => {
    fetchContinentCounts().then(setCounts)
  }, [])

  function selectContinent(slug: string) {
    onFiltersChange({
      ...filters,
      continentSlug: slug === filters.continentSlug ? "" : slug,
      countrySlug: "",
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
    // Scroll to top of page to show grid
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div style={{ padding: "clamp(40px, 6vw, 80px) 0" }}>
      {/* Heading */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)",
            fontWeight: 400,
            letterSpacing: "-.025em",
            color: T.ink.base,
            margin: 0,
          }}
        >
          Browse libraries{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            elsewhere.
          </em>
        </h2>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {totalLibraries.toLocaleString()} total
        </span>
      </div>

      {/* Continent list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {counts.map((c) => {
          const active = filters.continentSlug === c.slug

          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => selectContinent(c.slug)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "16px 18px",
                background: active
                  ? "rgba(127,223,255,0.07)"
                  : "rgba(255,255,255,0.02)",
                border: "none",
                borderRight: `1px solid ${T.border.line}`,
                borderBottom: `1px solid ${T.border.line}`,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "15px",
                  fontWeight: 400,
                  color: active ? T.accent.aurora : T.ink.base,
                  letterSpacing: "-.01em",
                }}
              >
                {c.name}
              </span>
              {c.count > 0 && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    color: T.ink.faint,
                    letterSpacing: ".10em",
                  }}
                >
                  {c.count.toLocaleString()}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
