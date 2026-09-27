"use client"

import { Navigation, Search } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { DEFAULT_FILTERS } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  type LibrarySearchHit,
  searchLibraries,
} from "@/lib/meilisearch"
import { Link, useRouter } from "@/lib/navigation"

const POPULAR_SEARCHES = [
  "British Library",
  "London",
  "Scotland",
  "National libraries",
  "Public libraries",
]

export default function HomeSearch() {
  const router = useRouter()
  const listboxId = useId()
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<LibrarySearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [locating, setLocating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([])
      setOpen(false)

      return
    }
    debounceRef.current = setTimeout(() => {
      searchLibraries({ ...DEFAULT_FILTERS, query }, { hitsPerPage: 6 })
        .then((res) => {
          setHits(res.hits)
          setActive(0)
          setOpen(true)
        })
        .catch(() => setHits([]))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  function goToIndex() {
    const q = query.trim()
    router.push(q ? `/libraries?q=${encodeURIComponent(q)}` : "/libraries")
  }

  function pickHit(hit: LibrarySearchHit) {
    setOpen(false)
    const path = buildLibraryPath(hit)
    router.push(path ?? `/libraries?q=${encodeURIComponent(hit.name)}`)
  }

  function nearMe() {
    if (!navigator.geolocation) {
      router.push("/libraries")

      return
    }
    setLocating(true)
    // Geolocation is only requested on explicit user click of "Near me"
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        router.push(
          `/libraries?lat=${pos.coords.latitude.toFixed(4)}&lng=${pos.coords.longitude.toFixed(4)}`
        )
      },
      () => {
        setLocating(false)
        router.push("/libraries")
      },
      { timeout: 8000 }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && hits.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === "ArrowUp" && hits.length > 0) {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const hit = open ? hits[active] : undefined
      if (hit) pickHit(hit)
      else goToIndex()
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const dropOpen = open && query.trim().length > 0

  return (
    <div>
      <div ref={containerRef} className="relative mt-8 max-w-[640px]">
        <label htmlFor="home-search" className="sr-only">
          Search libraries by name, city, region or country
        </label>
        <div
          className="flex items-center gap-2 rounded-full border bg-white py-1.5 pr-1.5 pl-5 shadow-[0_8px_24px_rgba(23,22,43,0.08)] transition-colors focus-within:border-(--t-accent-primary)"
          style={{ borderColor: T.border.hi }}
        >
          <Search
            aria-hidden="true"
            className="size-5 shrink-0"
            style={{ color: T.ink.dim }}
            strokeWidth={2}
          />
          <input
            id="home-search"
            role="combobox"
            aria-expanded={dropOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              dropOpen && hits[active]
                ? `${listboxId}-opt-${active}`
                : undefined
            }
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-3 text-[17px] font-medium outline-none"
            style={{ color: T.ink.base }}
            placeholder="Search libraries, cities or countries"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => hits.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            onClick={nearMe}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 py-2.5 text-[15px] font-semibold whitespace-nowrap transition-colors hover:bg-(--t-bg-muted) sm:flex"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            <Navigation aria-hidden="true" className="size-3.5" />
            {locating ? "Locating…" : "Near me"}
          </button>
          <button
            type="button"
            onClick={goToIndex}
            className="shrink-0 rounded-full px-6 py-3 text-[16px] font-semibold text-white transition-colors"
            style={{ background: T.ink.base }}
          >
            Search
          </button>
        </div>

        {dropOpen ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Search suggestions"
            className="absolute top-[calc(100%+8px)] right-0 left-0 z-30 rounded-2xl border bg-white p-2 shadow-[0_16px_40px_rgba(23,22,43,0.12)]"
            style={{ borderColor: T.border.line }}
          >
            {hits.map((hit, i) => {
              const location = [hit.city, hit.country_name]
                .filter(Boolean)
                .join(", ")

              return (
                <div
                  key={hit.documentId}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={() => pickHit(hit)}
                  onMouseEnter={() => setActive(i)}
                  className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5"
                  style={{
                    background: i === active ? T.accent.chip : "transparent",
                  }}
                >
                  <span
                    className="min-w-[54px] rounded-full px-2 py-0.5 text-center text-[13px] font-semibold"
                    style={{
                      background: "var(--tint-national-bg)",
                      color: "var(--tint-national-fg)",
                    }}
                  >
                    Library
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[16px] font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {hit.name}
                    </span>
                    {location ? (
                      <span
                        className="block truncate text-[14px]"
                        style={{ color: T.ink.dim }}
                      >
                        {location}
                      </span>
                    ) : null}
                  </span>
                </div>
              )
            })}
            {hits.length === 0 ? (
              <div
                className="px-3 py-3.5 text-[15px]"
                style={{ color: T.ink.dim }}
              >
                Nothing matches &ldquo;{query}&rdquo; yet.{" "}
                <Link href="/contribute" style={{ color: T.accent.primary }}>
                  Add a missing library
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="mr-0.5 text-[15px]" style={{ color: T.ink.dim }}>
          Popular searches:
        </span>
        {POPULAR_SEARCHES.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setQuery(label)}
            className="rounded-full border bg-white px-3.5 py-2 text-[14px] font-medium transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary-hover)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
