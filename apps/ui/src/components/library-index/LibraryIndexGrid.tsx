// apps/ui/src/components/library-index/LibraryIndexGrid.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { LibraryIndexCard } from "@/components/library-index/LibraryIndexCard"
import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { useGeoLookup } from "@/hooks/useGeoLookup"
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
  const [loading, setLoading] = useState(
    !initialHits || initialHits.length === 0
  )
  const [view, setView] = useState<"grid" | "list">("grid")
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const isFirst = useRef(true)
  const nearActive = filters.nearLat != null

  function handleFindNearby() {
    if (nearActive) {
      setGeoError(null)
      onFiltersChange({
        ...filters,
        nearLat: undefined,
        nearLng: undefined,
        page: 0,
      })

      return
    }
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser")

      return
    }
    setGeoLoading(true)
    setGeoError(null)
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false)
        onFiltersChange({
          ...filters,
          nearLat: pos.coords.latitude,
          nearLng: pos.coords.longitude,
          continentSlug: "",
          countrySlug: "",
          regionSlug: "",
          page: 0,
        })
      },
      () => {
        setGeoLoading(false)
        setGeoError("Location access denied")
      },
      { timeout: 8000 }
    )
  }

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

    searchLibraries(filters, { hitsPerPage: PAGE_SIZE })
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

  useGeoLookup(filters.nearLat != null ? "" : filters.query, (result) => {
    if (!result.continentSlug && !result.countrySlug) return
    onFiltersChange({
      ...filters,
      continentSlug: result.continentSlug ?? filters.continentSlug,
      countrySlug: result.countrySlug ?? filters.countrySlug,
      page: 0,
    })
  })

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
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative", flex: 1 }}>
          <Icon
            icon="mdi:magnify"
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "14px",
              color: T.ink.faint,
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            value={filters.query}
            onChange={(e) =>
              onFiltersChange({ ...filters, query: e.target.value, page: 0 })
            }
            placeholder="Search libraries…"
            style={{
              width: "100%",
              padding: "7px 12px 7px 30px",
              background: "rgba(255,255,255,.04)",
              border: `1px solid ${T.border.line}`,
              borderRadius: "8px",
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.dim,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Find nearby */}
        <button
          type="button"
          onClick={handleFindNearby}
          disabled={geoLoading}
          title={
            nearActive
              ? "Clear nearby search"
              : "Find libraries within 50 miles"
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: nearActive ? T.accent.aurora : T.ink.faint,
            background: nearActive
              ? "rgba(127,223,255,0.08)"
              : "rgba(255,255,255,.04)",
            border: `1px solid ${nearActive ? "rgba(127,223,255,0.25)" : T.border.line}`,
            borderRadius: "8px",
            padding: "7px 10px",
            cursor: geoLoading ? "wait" : "pointer",
            opacity: geoLoading ? 0.6 : 1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Icon
            icon={
              geoLoading
                ? "mdi:loading"
                : nearActive
                  ? "mdi:crosshairs-gps"
                  : "mdi:crosshairs"
            }
            style={{
              fontSize: "14px",
              animation: geoLoading ? "spin 1s linear infinite" : "none",
            }}
          />
          {nearActive ? "Nearby ×" : "Nearby"}
        </button>
        {geoError && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.accent.danger,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {geoError}
          </span>
        )}

        {/* Result count */}
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: 0,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {loading
            ? "Loading…"
            : total > 0
              ? `${(filters.page * PAGE_SIZE + 1).toLocaleString()}–${Math.min((filters.page + 1) * PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()}`
              : "No results"}
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
            flexShrink: 0,
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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
