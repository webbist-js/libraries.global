// apps/ui/src/components/library-index/LibraryIndexPage.tsx
"use client"

import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Container } from "@/components/elementary/Container"
import { LibraryBrowseElsewhere } from "@/components/library-index/LibraryBrowseElsewhere"
import { LibraryIndexGeoFilterBar } from "@/components/library-index/LibraryIndexGeoFilterBar"
import { LibraryIndexGrid } from "@/components/library-index/LibraryIndexGrid"
import { LibraryIndexHero } from "@/components/library-index/LibraryIndexHero"
import { LibraryIndexSidebar } from "@/components/library-index/LibraryIndexSidebar"
import {
  filtersFromParams,
  filtersToParams,
  type LibraryIndexFilterState,
  type LibraryIndexStats,
} from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import type { LibrarySearchHit } from "@/lib/meilisearch"
import { usePathname, useRouter } from "@/lib/navigation"

interface LibraryIndexPageProps {
  readonly stats: LibraryIndexStats
  readonly initialHits: LibrarySearchHit[]
  readonly initialTotal: number
}

export function LibraryIndexPage({
  stats,
  initialHits,
  initialTotal,
}: LibraryIndexPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<LibraryIndexFilterState>(() =>
    filtersFromParams(searchParams)
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resultCount, setResultCount] = useState(initialTotal)
  const isMount = useRef(true)

  // Sync URL when filters change (skip on first mount to avoid double-render)
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false

      return
    }
    const qs = filtersToParams(filters).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltersChange(next: LibraryIndexFilterState) {
    setFilters(next)
  }

  return (
    <main className="relative z-10 flex-1">
      {/* Hero */}
      <LibraryIndexHero stats={stats} />

      {/* Sticky geo filter bar */}
      <LibraryIndexGeoFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        resultCount={resultCount}
      />

      {/* Main layout: sidebar + grid */}
      <Container className="py-8 sm:py-10">
        {/* Mobile filter toggle */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.4rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            The{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>index.</em>
          </h2>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              borderColor: sidebarOpen
                ? "rgba(127,223,255,0.3)"
                : T.border.line,
              background: sidebarOpen
                ? "rgba(127,223,255,0.08)"
                : "transparent",
              color: sidebarOpen ? T.accent.aurora : T.ink.dim,
            }}
          >
            <Icon icon="mdi:tune" className="size-3.5" />
            Filters
          </button>
        </div>

        {/* Mobile sidebar drawer */}
        {sidebarOpen && (
          <div className="mb-6 lg:hidden">
            <LibraryIndexSidebar
              filters={filters}
              onChange={handleFiltersChange}
            />
          </div>
        )}

        {/* Desktop layout */}
        <div
          className="lib-index-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: "40px",
          }}
        >
          {/* Sidebar (desktop) */}
          <div
            className="sticky hidden lg:block"
            style={{ top: "calc(56px + 54px + 16px)", alignSelf: "start" }}
          >
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 8rem)", paddingRight: "4px" }}
            >
              <LibraryIndexSidebar
                filters={filters}
                onChange={handleFiltersChange}
              />
            </div>
          </div>

          {/* Grid */}
          <div>
            <LibraryIndexGrid
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onResultCount={setResultCount}
              initialHits={initialHits}
              initialTotal={initialTotal}
            />
          </div>
        </div>
      </Container>

      {/* Browse elsewhere */}
      <div style={{ borderTop: `1px solid ${T.border.line}` }}>
        <Container>
          <LibraryBrowseElsewhere
            filters={filters}
            onFiltersChange={handleFiltersChange}
            totalLibraries={stats.totalLibraries}
          />
        </Container>
      </div>
    </main>
  )
}
