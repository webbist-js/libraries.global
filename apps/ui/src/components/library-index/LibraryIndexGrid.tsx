// apps/ui/src/components/library-index/LibraryIndexGrid.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { LibraryIndexCard } from "@/components/library-index/LibraryIndexCard"
import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import { searchLibraries, type LibrarySearchHit } from "@/lib/meilisearch"

const PAGE_SIZE = 24

interface LibraryIndexGridProps {
  readonly filters: LibraryIndexFilterState
  readonly onFiltersChange: (next: LibraryIndexFilterState) => void
  readonly onResultCount?: (count: number) => void
  /** Initial hits from SSR to avoid flash on first load */
  readonly initialHits?: LibrarySearchHit[]
  readonly initialTotal?: number
}

export function LibraryIndexGrid({
  filters,
  onFiltersChange,
  onResultCount,
  initialHits,
  initialTotal = 0,
}: LibraryIndexGridProps) {
  const [hits, setHits] = useState<LibrarySearchHit[]>(initialHits ?? [])
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(!initialHits)
  const [view, setView] = useState<"grid" | "list">("grid")
  const gridRef = useRef<HTMLDivElement>(null)
  const isFirst = useRef(true)

  useEffect(() => {
    // Skip the first render if we already have SSR data with results
    if (isFirst.current && initialHits && initialHits.length > 0) {
      isFirst.current = false

      return
    }
    isFirst.current = false

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    searchLibraries({
      query: filters.query,
      libraryTypes: filters.libraryTypes,
      operationalStatuses: filters.statuses,
      continentSlugs: filters.continentSlug ? [filters.continentSlug] : [],
      countrySlugs: filters.countrySlug ? [filters.countrySlug] : [],
      regionSlugs: filters.regionSlug ? [filters.regionSlug] : [],
      areaSlugs: filters.areaSlug ? [filters.areaSlug] : [],
      featured: filters.featured || undefined,
      sort: filters.sort,
      page: filters.page,
      hitsPerPage: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return
        setHits(result.hits)
        const t = result.estimatedTotalHits ?? 0
        setTotal(t)
        onResultCount?.(t)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setHits([])
        setTotal(0)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handlePageChange = (p: number) => {
    onFiltersChange({ ...filters, page: p - 1 }) // IndexPager is 1-based
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={gridRef}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          minHeight: "28px",
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: 0,
          }}
        >
          {loading
            ? "Loading…"
            : total > 0
              ? `${(filters.page * PAGE_SIZE + 1).toLocaleString()}–${Math.min((filters.page + 1) * PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()}`
              : "No libraries found"}
        </p>

        {/* View toggle */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
            padding: "2px",
          }}
        >
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "24px",
                borderRadius: "6px",
                border: "none",
                background:
                  view === v ? "rgba(127,223,255,0.12)" : "transparent",
                color: view === v ? T.accent.aurora : T.ink.faint,
                cursor: "pointer",
                transition: "background 150ms, color 150ms",
              }}
            >
              <Icon
                icon={
                  v === "grid"
                    ? "mdi:view-grid-outline"
                    : "mdi:view-list-outline"
                }
                style={{ fontSize: "15px" }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Searching…
        </div>
      ) : hits.length === 0 ? (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
            fontFamily: T.font.serif,
            fontSize: "1.1rem",
            fontStyle: "italic",
            color: T.ink.faint,
            border: `1px solid ${T.border.line}`,
            borderRadius: "16px",
          }}
        >
          No libraries match your filters.
        </div>
      ) : (
        <div
          className="lib-grid"
          style={{
            display: "grid",
            gridTemplateColumns: view === "list" ? "1fr" : "repeat(2, 1fr)",
            gap: view === "list" ? "8px" : "16px",
          }}
        >
          {hits.map((hit) => (
            <LibraryIndexCard key={hit.documentId} hit={hit} view={view} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <IndexPager
          page={filters.page + 1}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

      <style>{`
        @media (max-width: 640px) {
          .lib-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
