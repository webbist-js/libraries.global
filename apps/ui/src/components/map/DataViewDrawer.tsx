"use client"

import { useEffect, useRef, useState } from "react"

import {
  type LibrarySearchHit,
  type LibrarySearchParams,
  searchLibrariesByParams,
} from "@/lib/meilisearch"
import { cn } from "@/lib/styles"

import LibraryTile from "./LibraryTile"

type DataView = "list" | "byType" | "featured"

interface DataViewDrawerProps {
  open: boolean
  onClose: () => void
  searchParams: LibrarySearchParams
  totalCount?: number
}

const VIEWS: { id: DataView; label: string; icon: string }[] = [
  { id: "list", label: "All Libraries", icon: "≡" },
  { id: "byType", label: "By Type", icon: "◫" },
  { id: "featured", label: "Featured", icon: "★" },
]

const TYPE_GROUPS = [
  { label: "Public & Municipal", types: ["Public", "Municipal", "State"] },
  { label: "Academic", types: ["Academic", "University"] },
  { label: "National & Parliamentary", types: ["National", "Parliamentary"] },
  {
    label: "Specialist",
    types: ["Special", "Archive", "Cultural", "Digital", "Mobile"],
  },
  { label: "Other", types: ["Monastic", "Private", "Other"] },
]

function useLibrarySearch(params: LibrarySearchParams, enabled: boolean) {
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const paramsRef = useRef(params)
  // eslint-disable-next-line react-hooks/refs
  paramsRef.current = params

  useEffect(() => {
    if (!enabled) return

    setLoading(true)
    setPage(0)
    searchLibrariesByParams({ ...params, page: 0 })
      .then((res) => {
        setHits(res.hits)
        setTotal(res.estimatedTotalHits ?? 0)
      })
      .finally(() => setLoading(false))
  }, [
    enabled,
    params.query,
    params.libraryTypes?.join(","),
    params.operationalStatuses?.join(","),
    params.continentSlugs?.join(","),
  ])

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    searchLibrariesByParams({ ...paramsRef.current, page: nextPage }).then(
      (res) => {
        setHits((prev) => [...prev, ...res.hits])
      }
    )
  }

  return { hits, total, loading, loadMore, hasMore: hits.length < total }
}

export default function DataViewDrawer({
  open,
  onClose,
  searchParams,
  totalCount,
}: DataViewDrawerProps) {
  const [activeView, setActiveView] = useState<DataView>("list")

  const listSearch = useLibrarySearch(
    searchParams,
    open && activeView === "list"
  )
  const featuredSearch = useLibrarySearch(
    { ...searchParams, libraryTypes: [] },
    open && activeView === "featured"
  )

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="absolute inset-0 z-30 bg-black/40" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "absolute top-0 right-0 bottom-0 z-40 flex w-80 flex-col bg-[#080d1c]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Explore</h2>
            {totalCount != null && (
              <p className="text-[11px] text-white/40">
                {totalCount.toLocaleString()} libraries worldwide
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:bg-white/8 hover:text-white"
          >
            <svg viewBox="0 0 14 14" fill="none" className="h-4 w-4">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 border-b border-white/8 px-4 py-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeView === v.id
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "text-white/50 hover:bg-white/6 hover:text-white/80"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeView === "list" && (
            <ListPane
              hits={listSearch.hits}
              loading={listSearch.loading}
              total={listSearch.total}
              hasMore={listSearch.hasMore}
              onLoadMore={listSearch.loadMore}
            />
          )}

          {activeView === "byType" && (
            <ByTypePane searchParams={searchParams} />
          )}

          {activeView === "featured" && (
            <ListPane
              hits={featuredSearch.hits.filter((h) => h.featured)}
              loading={featuredSearch.loading}
              total={featuredSearch.hits.filter((h) => h.featured).length}
              hasMore={false}
              onLoadMore={() => {}}
              emptyLabel="No featured libraries yet"
            />
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-panes ──────────────────────────────────────────────────────────────────

function ListPane({
  hits,
  loading,
  total,
  hasMore,
  onLoadMore,
  emptyLabel = "No libraries found",
}: {
  hits: LibrarySearchHit[]
  loading: boolean
  total: number
  hasMore: boolean
  onLoadMore: () => void
  emptyLabel?: string
}) {
  return (
    <div className="p-4">
      {loading && hits.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : hits.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/30">{emptyLabel}</p>
      ) : (
        <>
          <p className="mb-3 text-[11px] text-white/35">
            {total.toLocaleString()} result{total !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-col gap-2">
            {hits.map((hit) => (
              <LibraryTile key={hit.documentId} hit={hit} className="w-full" />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={onLoadMore}
              className="mt-4 w-full rounded-lg border border-white/12 py-2 text-sm text-white/60 hover:border-white/24 hover:text-white"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ByTypePane({ searchParams }: { searchParams: LibrarySearchParams }) {
  return (
    <div className="p-4">
      {TYPE_GROUPS.map((group) => (
        <TypeGroupRow
          key={group.label}
          group={group}
          baseParams={searchParams}
        />
      ))}
    </div>
  )
}

function TypeGroupRow({
  group,
  baseParams,
}: {
  group: { label: string; types: string[] }
  baseParams: LibrarySearchParams
}) {
  const [expanded, setExpanded] = useState(false)
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch count only
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    searchLibrariesByParams({
      ...baseParams,
      libraryTypes: group.types,
      hitsPerPage: 0,
    })
      .then((res) => setTotal(res.estimatedTotalHits ?? 0))
      .finally(() => setLoading(false))
  }, [baseParams.query, baseParams.operationalStatuses?.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleExpand() {
    if (!expanded && hits.length === 0) {
      searchLibrariesByParams({
        ...baseParams,
        libraryTypes: group.types,
        hitsPerPage: 20,
      }).then((res) => setHits(res.hits))
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-white/8">
      <button
        onClick={handleExpand}
        className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-white/4"
      >
        <span className="text-sm font-medium text-white/80">{group.label}</span>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-white/30">…</span>
          ) : total != null ? (
            <span className="text-xs text-white/40">{total}</span>
          ) : null}
          <svg
            viewBox="0 0 10 6"
            fill="none"
            className={cn(
              "h-2.5 w-2.5 text-white/40 transition-transform",
              expanded && "rotate-180"
            )}
          >
            <path
              d="M1 1l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </button>
      {expanded && hits.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-white/6 p-2">
          {hits.map((hit) => (
            <LibraryTile key={hit.documentId} hit={hit} className="w-full" />
          ))}
        </div>
      )}
    </div>
  )
}
