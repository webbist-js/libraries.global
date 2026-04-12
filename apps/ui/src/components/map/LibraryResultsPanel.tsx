"use client"

import { useEffect, useRef, useState } from "react"

import {
  type LibrarySearchHit,
  type LibrarySearchParams,
  searchLibraries,
} from "@/lib/meilisearch"
import { cn } from "@/lib/styles"

import LibraryTile from "./LibraryTile"

interface LibraryResultsPanelProps {
  searchParams: LibrarySearchParams
  onTotalChange?: (total: number) => void
  className?: string
}

export default function LibraryResultsPanel({
  searchParams,
  onTotalChange,
  className,
}: LibraryResultsPanelProps) {
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(0)
  const paramsRef = useRef(searchParams)
  // eslint-disable-next-line react-hooks/refs
  paramsRef.current = searchParams
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset + fetch when params change
  useEffect(() => {
    setLoading(true)
    setPage(0)
    searchLibraries({ ...searchParams, page: 0, hitsPerPage: 20 })
      .then((res) => {
        const t = res.estimatedTotalHits ?? 0
        setHits(res.hits)
        setTotal(t)
        onTotalChange?.(t)
      })
      .catch(() => {
        // Meilisearch not available — show empty gracefully
        setHits([])
        setTotal(0)
        onTotalChange?.(0)
      })
      .finally(() => setLoading(false))
  }, [
    searchParams.query,
    searchParams.libraryTypes?.join(","),
    searchParams.operationalStatuses?.join(","),
  ])

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    searchLibraries({
      ...paramsRef.current,
      page: nextPage,
      hitsPerPage: 20,
    }).then((res) => setHits((prev) => [...prev, ...res.hits]))
  }

  const hasMore = hits.length < total

  return (
    <div
      className={cn(
        "flex flex-col border-t border-white/8 bg-[#060b19] transition-all duration-300",
        expanded ? "h-72" : "h-[180px]",
        className
      )}
    >
      {/* Panel header */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white"
          >
            <svg
              viewBox="0 0 10 6"
              fill="none"
              className={cn(
                "h-2.5 w-2.5 transition-transform",
                expanded ? "rotate-0" : "rotate-180"
              )}
            >
              <path
                d="M1 5l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>
              {loading
                ? "Loading…"
                : `${total.toLocaleString()} ${total === 1 ? "library" : "libraries"}`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {hasMore && (
            <button
              onClick={loadMore}
              className="rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/50 hover:border-white/24 hover:text-white"
            >
              Load more
            </button>
          )}
        </div>
      </div>

      {/* Horizontal tile scroll */}
      <div
        ref={scrollRef}
        className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading && hits.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} />)
        ) : hits.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-white/25">No libraries found</p>
          </div>
        ) : (
          hits.map((hit) => <LibraryTile key={hit.documentId} hit={hit} />)
        )}
      </div>
    </div>
  )
}

function TileSkeleton() {
  return (
    <div className="flex w-52 flex-shrink-0 animate-pulse flex-col gap-2 rounded-xl border border-white/6 bg-white/4 p-3.5">
      <div className="h-2 w-16 rounded bg-white/8" />
      <div className="h-3 w-full rounded bg-white/8" />
      <div className="h-3 w-3/4 rounded bg-white/8" />
      <div className="mt-2 h-2 w-20 rounded bg-white/6" />
    </div>
  )
}
