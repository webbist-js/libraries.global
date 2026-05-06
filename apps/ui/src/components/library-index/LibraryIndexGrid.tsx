// apps/ui/src/components/library-index/LibraryIndexGrid.tsx
"use client"

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
  const gridRef = useRef<HTMLDivElement>(null)
  const isFirst = useRef(true)

  useEffect(() => {
    // Skip the first render if we already have SSR data
    if (isFirst.current && initialHits) {
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
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          {hits.map((hit) => (
            <LibraryIndexCard key={hit.documentId} hit={hit} />
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
