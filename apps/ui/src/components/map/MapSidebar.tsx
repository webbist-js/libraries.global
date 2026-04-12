"use client"

import { useEffect, useRef, useState } from "react"

import {
  LIBRARY_TYPES,
  type LibrarySearchHit,
  type LibrarySearchParams,
  OPERATIONAL_STATUSES,
  searchLibraries,
} from "@/lib/meilisearch"
import { cn } from "@/lib/styles"

import { DEFAULT_FILTER_STATE, type MapFilterState } from "./FilterDrawer"
import LibraryTile from "./LibraryTile"

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
      {children}
    </h3>
  )
}

// ── Check row ─────────────────────────────────────────────────────────────────

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2.5 py-0.5 text-sm text-white/65 hover:text-white"
      onClick={onChange}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-indigo-500 bg-indigo-500"
            : "border-white/20 bg-transparent"
        )}
      >
        {checked && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2 w-2">
            <path
              d="M1 4l3 3 5-6"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </label>
  )
}

// ── Library results list ───────────────────────────────────────────────────────

function ResultsList({ searchParams }: { searchParams: LibrarySearchParams }) {
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const paramsRef = useRef(searchParams)
  paramsRef.current = searchParams

  useEffect(() => {
    setLoading(true)
    setPage(0)
    searchLibraries({ ...searchParams, page: 0, hitsPerPage: 20 })
      .then((res) => {
        setHits(res.hits)
        setTotal(res.estimatedTotalHits ?? 0)
      })
      .catch(() => {
        setHits([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams.query,
    searchParams.libraryTypes?.join(","),
    searchParams.operationalStatuses?.join(","),
    searchParams.continentSlugs?.join(","),
  ])

  function loadMore() {
    const next = page + 1
    setPage(next)
    searchLibraries({ ...paramsRef.current, page: next, hitsPerPage: 20 }).then(
      (res) => setHits((prev) => [...prev, ...res.hits])
    )
  }

  if (loading && hits.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!loading && hits.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-white/25">
        No libraries found
      </p>
    )
  }

  return (
    <div>
      <p className="mb-3 text-[11px] text-white/35">
        {total.toLocaleString()} result{total !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-2">
        {hits.map((hit) => (
          <LibraryTile key={hit.documentId} hit={hit} className="w-full" />
        ))}
      </div>
      {hits.length < total && (
        <button
          onClick={loadMore}
          className="mt-4 w-full rounded-lg border border-white/12 py-2 text-sm text-white/55 hover:border-white/24 hover:text-white"
        >
          Load more
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface MapSidebarProps {
  open: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  filters: MapFilterState
  onFiltersChange: (f: MapFilterState) => void
  searchParams: LibrarySearchParams
  totalCount?: number
}

export default function MapSidebar({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  searchParams,
  totalCount,
}: MapSidebarProps) {
  const [tab, setTab] = useState<"filters" | "results">("results")

  const activeFilterCount =
    filters.libraryTypes.length +
    filters.operationalStatuses.length +
    filters.continentSlugs.length

  function toggle<K extends keyof MapFilterState>(key: K, value: string) {
    const current = filters[key] as string[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [key]: next })
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/30" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 bottom-0 left-0 z-30 flex w-80 flex-col bg-[#07091a]/96 shadow-2xl backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Explore Libraries
            </h2>
            {totalCount != null && (
              <p className="text-[11px] text-white/35">
                {totalCount.toLocaleString()} worldwide
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/8 hover:text-white"
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

        {/* Search input */}
        <div className="flex-shrink-0 border-b border-white/8 px-4 py-3">
          <div className="relative">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/35"
            >
              <circle
                cx="7"
                cy="7"
                r="5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M11 11l3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              placeholder="Search libraries, cities…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/6 py-2 pr-3 pl-8 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <svg viewBox="0 0 10 10" fill="none" className="h-3 w-3">
                  <path
                    d="M1 1l8 8M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 gap-1 border-b border-white/8 px-4 py-2">
          <button
            onClick={() => setTab("results")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "results"
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-white/45 hover:bg-white/6 hover:text-white/80"
            )}
          >
            Results
          </button>
          <button
            onClick={() => setTab("filters")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "filters"
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-white/45 hover:bg-white/6 hover:text-white/80"
            )}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] leading-none font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "results" ? (
            <div className="p-4">
              <ResultsList searchParams={searchParams} />
            </div>
          ) : (
            <div className="p-4">
              {/* Library Type */}
              <div className="mb-5">
                <SectionHeading>Library Type</SectionHeading>
                {LIBRARY_TYPES.map((type) => (
                  <CheckRow
                    key={type}
                    label={type}
                    checked={filters.libraryTypes.includes(type)}
                    onChange={() => toggle("libraryTypes", type)}
                  />
                ))}
              </div>

              {/* Operational Status */}
              <div className="mb-5">
                <SectionHeading>Status</SectionHeading>
                {OPERATIONAL_STATUSES.map(({ value, label }) => (
                  <CheckRow
                    key={value}
                    label={label}
                    checked={filters.operationalStatuses.includes(value)}
                    onChange={() => toggle("operationalStatuses", value)}
                  />
                ))}
              </div>

              {/* Clear */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => onFiltersChange(DEFAULT_FILTER_STATE)}
                  className="w-full rounded-lg border border-white/12 py-2 text-sm text-white/50 hover:border-white/24 hover:text-white"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
