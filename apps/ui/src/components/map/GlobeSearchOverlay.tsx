"use client"

import { useEffect, useRef, useState } from "react"

import { useRouter } from "@/lib/navigation"
import { cn } from "@/lib/styles"

import type { GlobeDrillState } from "./MapGlobe"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: "continent" | "country" | "library"
  slug: string
  name: string
  subtitle?: string
  centroid?: { lat: number; lng: number }
  continentSlug?: string
  continentName?: string
  countrySlug?: string
  regionSlug?: string
}

// ── Filter state ───────────────────────────────────────────────────────────────

type LibraryTypeFilter =
  | "national"
  | "public"
  | "academic"
  | "special"
  | "government"
type StatusFilter = "open" | "temporarilyClosed" | "permanentlyClosed"

interface FilterState {
  libraryTypes: LibraryTypeFilter[]
  statuses: StatusFilter[]
}

const DEFAULT_FILTERS: FilterState = { libraryTypes: [], statuses: [] }

const LIBRARY_TYPE_LABELS: Record<LibraryTypeFilter, string> = {
  national: "National",
  public: "Public",
  academic: "Academic",
  special: "Special",
  government: "Government",
}

const _STATUS_LABELS: Record<StatusFilter, string> = {
  open: "Open",
  temporarilyClosed: "Temporarily Closed",
  permanentlyClosed: "Permanently Closed",
}

const _CENTROIDS: Record<string, { lat: number; lng: number }> = {
  africa: { lat: 2, lng: 20 },
  americas: { lat: 8, lng: -78 },
  asia: { lat: 38, lng: 88 },
  europe: { lat: 52, lng: 15 },
  oceania: { lat: -22, lng: 133 },
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])

      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)

    const q = encodeURIComponent(query)

    // Fetch continents, countries, and libraries matching query from Strapi
    Promise.all([
      fetch(
        `/api/public-proxy/api/continents?filters[name][$containsi]=${q}&fields[0]=name&fields[1]=slug&pagination[pageSize]=3&status=published`,
        { signal: ctrl.signal }
      )
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
      fetch(
        `/api/public-proxy/api/countries?filters[name][$containsi]=${q}&fields[0]=name&fields[1]=slug&pagination[pageSize]=5&status=published&populate[continent][fields][0]=name&populate[continent][fields][1]=slug&populate[mapConfig]=true`,
        { signal: ctrl.signal }
      )
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
      fetch(
        `/api/public-proxy/api/libraries?filters[name][$containsi]=${q}&fields[0]=name&fields[1]=slug&fields[2]=city&pagination[pageSize]=4&status=published&populate[continent][fields][0]=slug&populate[country][fields][0]=slug&populate[country][fields][1]=name&populate[region][fields][0]=slug`,
        { signal: ctrl.signal }
      )
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
    ])
      .then(([conts, countries, libraries]) => {
        const out: SearchResult[] = []

        for (const c of conts.data ?? []) {
          out.push({
            type: "continent",
            slug: c.slug ?? c.attributes?.slug,
            name: c.name ?? c.attributes?.name,
            centroid: _CENTROIDS[c.slug ?? c.attributes?.slug],
          })
        }

        for (const c of countries.data ?? []) {
          const slug = c.slug ?? c.attributes?.slug
          const name = c.name ?? c.attributes?.name
          const cont = c.continent ?? c.attributes?.continent
          const mc = c.mapConfig ?? c.attributes?.mapConfig
          out.push({
            type: "country",
            slug,
            name,
            subtitle: cont?.name ?? cont?.data?.attributes?.name,
            continentSlug: cont?.slug ?? cont?.data?.attributes?.slug,
            continentName: cont?.name ?? cont?.data?.attributes?.name,
            centroid:
              mc?.centerLat != null && mc?.centerLng != null
                ? { lat: mc.centerLat, lng: mc.centerLng }
                : undefined,
          })
        }

        for (const lib of libraries.data ?? []) {
          const slug = lib.slug ?? lib.attributes?.slug
          const name = lib.name ?? lib.attributes?.name
          const city = lib.city ?? lib.attributes?.city
          const cont = lib.continent ?? lib.attributes?.continent
          const country = lib.country ?? lib.attributes?.country
          const region = lib.region ?? lib.attributes?.region
          out.push({
            type: "library",
            slug,
            name,
            subtitle: [city, country?.name].filter(Boolean).join(", "),
            continentSlug: cont?.slug,
            countrySlug: country?.slug,
            regionSlug: region?.slug,
          })
        }

        setResults(out)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query])

  return { results, loading }
}

// ── Filter chip ────────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-(--t-accent-primary) bg-(--t-accent-chip) text-(--t-accent-primary-hover)"
          : "border-(--t-border-hi) bg-white/92 text-(--t-ink-dim) hover:bg-white hover:text-(--t-ink-base)"
      )}
    >
      {label}
      {active && (
        <svg viewBox="0 0 8 8" className="h-2 w-2" fill="currentColor">
          <circle cx="4" cy="4" r="3" />
        </svg>
      )}
    </button>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({ r, onClick }: { r: SearchResult; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--t-bg-muted)"
    >
      <span
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase",
          r.type === "continent"
            ? "bg-[#E4ECF5] text-[#28496E]"
            : r.type === "library"
              ? "bg-(--t-accent-chip) text-(--t-accent-primary-hover)"
              : "bg-(--t-bg-muted) text-(--t-ink-dim)"
        )}
      >
        {r.type === "continent" ? "C" : r.type === "country" ? "Co" : "L"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-snug text-(--t-ink-base)">
          {r.name}
        </span>
        {r.subtitle && (
          <span className="block text-[11px] text-(--t-ink-low)">
            {r.subtitle}
          </span>
        )}
      </span>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        className="ml-auto h-3 w-3 flex-shrink-0 text-(--t-ink-faint)"
      >
        <path
          d="M2 6h8M6 2l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface GlobeSearchOverlayProps {
  settled: boolean // true once user has first interacted
  drillState: GlobeDrillState
  onDrillChange: (s: GlobeDrillState) => void
}

export default function GlobeSearchOverlay({
  settled,
  drillState: _drillState,
  onDrillChange,
}: GlobeSearchOverlayProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  // Triggers intro animations on the next paint so CSS transitions have a defined start state
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { results, loading } = useSearch(query)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)

    return () => clearTimeout(t)
  }, [])

  const showDropdown = focused && query.trim().length > 0

  // Shared spring-like easing matching the Google experiment aesthetic
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)"

  function handleResultClick(r: SearchResult) {
    setQuery("")
    setFocused(false)

    if (r.type === "continent") {
      onDrillChange({
        level: "continent",
        continent: {
          slug: r.slug,
          name: r.name,
          centroid: r.centroid ?? { lat: 0, lng: 0 },
        },
      })
    } else if (r.type === "country" && r.continentSlug && r.continentName) {
      onDrillChange({
        level: "country",
        continent: {
          slug: r.continentSlug,
          name: r.continentName,
          centroid: _CENTROIDS[r.continentSlug] ?? { lat: 0, lng: 0 },
        },
        country: {
          slug: r.slug,
          name: r.name,
          centroid: r.centroid ?? { lat: 0, lng: 0 },
        },
      })
    } else if (
      r.type === "library" &&
      r.continentSlug &&
      r.countrySlug &&
      r.regionSlug
    ) {
      router.push(
        `/${r.continentSlug}/${r.countrySlug}/${r.regionSlug}/${r.slug}`
      )
    }
  }

  function toggleType(t: LibraryTypeFilter) {
    setFilters((f) => ({
      ...f,
      libraryTypes: f.libraryTypes.includes(t)
        ? f.libraryTypes.filter((x) => x !== t)
        : [...f.libraryTypes, t],
    }))
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center px-4 transition-all duration-700 ease-out",
        settled ? "top-8" : "top-1/2 -translate-y-[calc(50%+80px)]"
      )}
    >
      {/* ── Hero intro — collapses smoothly when user first interacts ──────── */}
      <div
        aria-hidden
        className="pointer-events-none w-full max-w-3xl overflow-hidden text-center"
        style={{
          maxHeight: settled ? "0px" : "280px",
          marginBottom: settled ? "0px" : "2.75rem",
          transition: `max-height 0.6s ${ease}, margin-bottom 0.6s ${ease}`,
        }}
      >
        {/* Eyebrow */}
        <p
          className="mb-4 text-[11px] font-semibold tracking-[0.22em] text-[#B9B4F5] uppercase"
          style={{
            opacity: mounted && !settled ? 1 : 0,
            transform:
              mounted && !settled ? "translateY(0)" : "translateY(14px)",
            transition: `opacity 0.75s ${ease}, transform 0.75s ${ease}`,
            transitionDelay: !settled && mounted ? "60ms" : "0ms",
          }}
        >
          Global Library Discovery
        </p>

        {/* Headline */}
        <h1
          className="mb-5 text-5xl leading-[1.08] font-bold tracking-tight text-white"
          style={{
            opacity: mounted && !settled ? 1 : 0,
            transform:
              mounted && !settled ? "translateY(0)" : "translateY(18px)",
            transition: `opacity 0.85s ${ease}, transform 0.85s ${ease}`,
            transitionDelay: !settled && mounted ? "140ms" : "0ms",
            textShadow:
              "0 2px 24px rgba(2,6,18,0.9), 0 8px 48px rgba(2,6,18,0.7)",
          }}
        >
          Explore the world&apos;s{" "}
          <span className="text-white/75">libraries</span>
        </h1>

        {/* Subtitle */}
        <p
          className="mx-auto max-w-[460px] text-[15px] leading-relaxed text-white/48"
          style={{
            opacity: mounted && !settled ? 1 : 0,
            transform:
              mounted && !settled ? "translateY(0)" : "translateY(14px)",
            transition: `opacity 0.8s ${ease}, transform 0.8s ${ease}`,
            transitionDelay: !settled && mounted ? "260ms" : "0ms",
            textShadow: "0 1px 10px rgba(2,6,18,0.95)",
          }}
        >
          Browse and discover thousands of libraries across every continent,
          country and region on earth.
        </p>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-auto relative w-full max-w-2xl"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(12px)",
          transition: `opacity 0.8s ${ease}, transform 0.8s ${ease}`,
          transitionDelay: mounted && !settled ? "360ms" : "0ms",
        }}
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-full border bg-white/95 px-4 py-3 shadow-xl backdrop-blur-xl transition-colors",
            focused ? "border-(--t-accent-primary)" : "border-(--t-border-hi)"
          )}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 flex-shrink-0 text-(--t-ink-low)"
          >
            <circle
              cx="9"
              cy="9"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M14 14l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search for a continent, country or library…"
            className="flex-1 bg-transparent text-sm text-(--t-ink-base) placeholder-(--t-ink-faint) outline-none"
          />

          {query && (
            <button
              onClick={() => {
                setQuery("")
                inputRef.current?.focus()
              }}
              className="flex-shrink-0 text-(--t-ink-faint) transition-colors hover:text-(--t-ink-dim)"
              aria-label="Clear"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full right-0 left-0 mt-1.5 overflow-hidden rounded-2xl border border-(--t-border-line) bg-white/98 shadow-2xl backdrop-blur-xl">
            {loading && (
              <div className="py-4 text-center text-sm text-(--t-ink-low)">
                Searching…
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="py-4 text-center text-sm text-(--t-ink-low)">
                No results found
              </div>
            )}
            {!loading && results.length > 0 && (
              <div className="p-1.5">
                {results.map((r) => (
                  <ResultRow
                    key={`${r.type}-${r.slug}`}
                    r={r}
                    onClick={() => handleResultClick(r)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filter chips ─────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 overflow-hidden"
        style={{
          opacity: mounted ? 1 : 0,
          maxHeight: mounted ? "60px" : "0px",
          marginTop: "0.75rem",
          transition: `opacity 0.4s ${ease}, max-height 0.5s ${ease}`,
          transitionDelay: mounted && !settled ? "460ms" : "0ms",
        }}
      >
        {(Object.keys(LIBRARY_TYPE_LABELS) as LibraryTypeFilter[]).map((t) => (
          <FilterChip
            key={t}
            label={LIBRARY_TYPE_LABELS[t]}
            active={filters.libraryTypes.includes(t)}
            onClick={() => toggleType(t)}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-white/30" />
        <FilterChip
          label="Open now"
          active={filters.statuses.includes("open")}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              statuses: f.statuses.includes("open")
                ? f.statuses.filter((s) => s !== "open")
                : [...f.statuses, "open"],
            }))
          }
        />
      </div>
    </div>
  )
}
