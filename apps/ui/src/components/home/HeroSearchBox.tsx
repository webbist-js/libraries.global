"use client"

import { Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { DEFAULT_FILTERS } from "@/components/library-index/types"
import {
  buildLibraryPath,
  type LibrarySearchHit,
  searchLibraries,
} from "@/lib/meilisearch"
import { useRouter } from "@/lib/navigation"
import { cn } from "@/lib/styles"

// ── Result item ───────────────────────────────────────────────────────────────

function ResultItem({
  hit,
  onSelect,
}: {
  hit: LibrarySearchHit
  onSelect: () => void
}) {
  const router = useRouter()
  const path = buildLibraryPath(hit)

  function handleClick() {
    if (path) router.push(path)
    onSelect()
  }

  const location = [hit.city, hit.country_name].filter(Boolean).join(", ")

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
        <Search className="size-3.5 text-indigo-300" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/90">{hit.name}</p>
        {location && (
          <p className="truncate text-xs text-white/42">{location}</p>
        )}
      </div>
      {hit.libraryType && (
        <span className="ml-auto shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/35">
          {hit.libraryType}
        </span>
      )}
    </button>
  )
}

// ── Suggestion pills ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Alexandria's Musaeum",
  "Sanskrit manuscripts",
  "open after 22:00",
  "rare maps · Europe",
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function HeroSearchBox() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([])

      setOpen(false)

      return
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true)
      searchLibraries({ ...DEFAULT_FILTERS, query }, { hitsPerPage: 6 })
        .then((res) => {
          setHits(res.hits)
          setOpen(res.hits.length > 0)
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  function navigateToMap() {
    const q = query.trim()
    router.push(q ? `/map?q=${encodeURIComponent(q)}` : "/map")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      setOpen(false)
      navigateToMap()
    }
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="mt-10 max-w-[560px]">
      <div ref={containerRef} className="relative" id="search">
        <label className="sr-only" htmlFor="library-search">
          Search libraries
        </label>

        {/* Input row */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 backdrop-blur-2xl transition-colors duration-300 focus-within:border-white/18",
            open && "rounded-b-none border-b-white/5"
          )}
        >
          <Search
            className={cn(
              "size-4 shrink-0 transition-colors",
              loading ? "text-indigo-400" : "text-white/36"
            )}
            strokeWidth={1.8}
          />
          <input
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-1 text-[15px] text-white/90 outline-none placeholder:text-white/36"
            id="library-search"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => hits.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search for a library, city, or country..."
            type="text"
            value={query}
          />
          <button
            className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#030511] transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
            onClick={() => {
              setOpen(false)
              navigateToMap()
            }}
            type="button"
          >
            Search
          </button>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 left-0 z-50 overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-[#0a0f2a]/95 shadow-2xl backdrop-blur-2xl">
            <div className="divide-y divide-white/[0.04]">
              {hits.map((hit) => (
                <ResultItem
                  key={hit.documentId}
                  hit={hit}
                  onSelect={() => {
                    setOpen(false)
                    setQuery("")
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                setOpen(false)
                navigateToMap()
              }}
              className="flex w-full items-center gap-2 border-t border-white/[0.06] px-4 py-3 text-sm text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/70"
            >
              <Search className="size-3.5" strokeWidth={1.8} />
              See all results for &ldquo;{query}&rdquo;
            </button>
          </div>
        )}
      </div>

      {/* Suggestion pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuery(s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/45 transition-colors hover:border-white/18 hover:bg-white/[0.07] hover:text-white/70"
          >
            <span className="font-mono text-[10px] text-white/25">try</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
