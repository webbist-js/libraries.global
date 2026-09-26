// apps/ui/src/components/index-page/FindLibraryPage.tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Breadcrumb, FilterDrawer } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { type LibrarySearchHitV2, searchLibrariesV2 } from "@/lib/meilisearch"
import { usePathname, useRouter } from "@/lib/navigation"

import {
  type FindState,
  DEFAULT_FIND_STATE,
  TYPE_GROUPS,
  completenessScore,
  distanceKm,
  findStateFromParams,
  findStateToParams,
  hasActiveFindFilters,
  hitNeeds,
  openStatus,
} from "./find-helpers"
import { LibraryResultCard, LibraryResultRow } from "./FindCards"
import {
  FindFilterChips,
  FindResultsControls,
  FindSearchBar,
} from "./FindControls"
import { type FindFacets, FindFilterSidebar } from "./FindFilterSidebar"
import { FindMapPanel } from "./FindMapPanel"
import { FindEmptyState, FindErrorState, FindSkeletonGrid } from "./FindStates"

const PAGE_SIZE = 24
/**
 * All fetches use one bulk request (MeiliSearch's 1000-hit ceiling) so that
 * "open now", "digital collections" and the completeness sort can be computed
 * client-side — none of them are indexed yet. Revisit once the index carries
 * a completeness score and an open-now-friendly schedule encoding.
 */
const BULK_LIMIT = 1000

interface FetchResult {
  all: LibrarySearchHitV2[]
  facets: FindFacets
}

export function FindLibraryPage({
  initialHits,
  initialFacetDistribution,
  statsTotal,
}: {
  initialHits: LibrarySearchHitV2[] | null
  initialFacetDistribution: Record<string, Record<string, number>> | null
  statsTotal: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [state, setState] = useState<FindState>(() =>
    findStateFromParams(new URLSearchParams(searchParams.toString()))
  )
  const [result, setResult] = useState<FetchResult | null>(() =>
    initialHits
      ? {
          all: initialHits,
          facets: facetsFrom(initialFacetDistribution, initialHits),
        }
      : null
  )
  const [loading, setLoading] = useState(initialHits === null)
  const [error, setError] = useState(false)
  const [locating, setLocating] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const fetchSeq = useRef(0)
  const didMount = useRef(false)

  const patch = useCallback((p: Partial<FindState>) => {
    setState((s) => ({ ...s, ...p }))
  }, [])

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!didMount.current) return
    const qs = findStateToParams(state).toString()
    router.replace((qs ? `${pathname}?${qs}` : pathname) as never, {
      scroll: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // ── Data fetching (debounced) ─────────────────────────────────────────────
  const searchKey = useMemo(() => {
    const { view: _view, page: _page, sort: _sort, ...rest } = state

    return JSON.stringify(rest)
  }, [state])

  const runFetch = useCallback(async (s: FindState) => {
    const seq = ++fetchSeq.current
    setLoading(true)
    setError(false)
    try {
      const res = await searchLibrariesV2({
        query: s.q,
        libraryTypes: s.groups.flatMap(
          (key) => TYPE_GROUPS.find((g) => g.key === key)?.types ?? []
        ),
        accessibilityNames: s.access,
        serviceNames: s.services,
        nearLat: s.nearLat,
        nearLng: s.nearLng,
        nearRadius:
          s.nearLat != null && s.radiusKm > 0 ? s.radiusKm * 1000 : undefined,
        sortByDistance: s.sort === "near" && s.nearLat != null,
        bulkLimit: BULK_LIMIT,
        withFacets: true,
      })
      if (seq !== fetchSeq.current) return
      setResult({
        all: res.hits,
        facets: facetsFrom(
          (res.facetDistribution ?? null) as Record<
            string,
            Record<string, number>
          > | null,
          res.hits
        ),
      })
    } catch {
      if (seq !== fetchSeq.current) return
      setError(true)
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      // Server provided matching initial data only for the default state
      if (result && !hasActiveFindFilters(state)) return
    }
    const t = setTimeout(() => runFetch(state), 250)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey])

  // ── Client-side refinement (open now / digital / sort / pagination) ──────
  const now = useMemo(() => new Date(), [searchKey])

  const refined = useMemo(() => {
    if (!result) return []
    let hits = result.all
    if (state.openNow) {
      hits = hits.filter((h) => {
        const st = openStatus(h.openingTimes, h.timezone, now)

        return st.known && st.open
      })
    }
    if (state.digital) {
      hits = hits.filter((h) => Boolean(h.iiifEndpoint))
    }
    if (state.needs.length > 0) {
      hits = hits.filter((h) =>
        hitNeeds(h).some((need) => state.needs.includes(need))
      )
    }
    if (state.sort === "complete" || state.sort === "gaps") {
      const dir = state.sort === "gaps" ? -1 : 1
      hits = [...hits].sort(
        (a, b) =>
          dir * (completenessScore(b) - completenessScore(a)) ||
          (a.name ?? "").localeCompare(b.name ?? "")
      )
    } else if (state.sort === "name") {
      hits = [...hits].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "")
      )
    }
    // sort === "near": server already ordered by distance

    return hits
  }, [result, state.openNow, state.digital, state.needs, state.sort, now])

  const pageCount = Math.max(1, Math.ceil(refined.length / PAGE_SIZE))
  const page = Math.min(state.page, pageCount - 1)
  const pageHits = refined.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const activeFilterCount =
    state.groups.length +
    state.access.length +
    state.services.length +
    (state.openNow ? 1 : 0) +
    (state.digital ? 1 : 0) +
    state.needs.length +
    (state.nearLat != null ? 1 : 0)

  const clearAll = useCallback(() => {
    setState((s) => ({
      ...DEFAULT_FIND_STATE,
      q: s.q,
      view: s.view,
    }))
  }, [])

  const handleNearMe = useCallback(() => {
    if (state.nearLat != null) {
      patch({
        nearLat: undefined,
        nearLng: undefined,
        radiusKm: 0,
        sort: state.sort === "near" ? "complete" : state.sort,
        page: 0,
      })

      return
    }
    if (!navigator.geolocation) return
    setLocating(true)
    // Only requested on an explicit "Use my location" click.
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        patch({
          nearLat: pos.coords.latitude,
          nearLng: pos.coords.longitude,
          radiusKm: 50,
          sort: "near",
          page: 0,
        })
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }, [state.nearLat, state.sort, patch])

  const sidebar = (
    <FindFilterSidebar
      state={state}
      facets={
        result?.facets ?? { libraryType: {}, accessibility: {}, services: {} }
      }
      onChange={patch}
      onReset={clearAll}
    />
  )

  return (
    <div
      className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-[88px] sm:px-8"
      style={{ color: T.ink.base }}
    >
      {/* Breadcrumb */}
      <Breadcrumb
        className="pt-6 sm:pt-10"
        items={[{ label: "Home", href: "/" }, { label: "Find libraries" }]}
      />

      {/* Hero */}
      <header className="mt-4 max-w-[760px]">
        <h1
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(40px, 5vw, 64px)",
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          Find a library
        </h1>
        <p
          className="mt-3 mb-0 text-[18px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          Search {statsTotal.toLocaleString("en-GB")} published records by name,
          place, type and facilities. The index grows as contributors document
          more libraries.
        </p>
      </header>

      <div className="mt-6">
        <FindSearchBar
          state={state}
          onQuery={(q) => patch({ q, page: 0 })}
          onNearMe={handleNearMe}
          locating={locating}
        />
      </div>

      {/* Main two-column area */}
      <div className="mt-8 flex items-start gap-8">
        {/* Sidebar — static on desktop */}
        <aside
          aria-label="Filters"
          className="sticky top-[90px] hidden w-[290px] shrink-0 lg:block"
        >
          {sidebar}
        </aside>

        {/* Sidebar — drawer on mobile */}
        <FilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          showLabel={`Show ${refined.length.toLocaleString("en-GB")} results`}
        >
          {sidebar}
        </FilterDrawer>

        {/* Results */}
        <section aria-label="Results" className="min-w-0 flex-1">
          <FindResultsControls
            state={state}
            total={refined.length}
            loading={loading}
            onChange={patch}
            onOpenFilters={() => setFiltersOpen(true)}
            activeFilterCount={activeFilterCount}
          />

          <div className="mt-4">
            <FindFilterChips
              state={state}
              onChange={patch}
              onClearAll={clearAll}
            />
          </div>

          <div className="mt-5">
            {error ? (
              <FindErrorState onRetry={() => runFetch(state)} />
            ) : loading && !result ? (
              <FindSkeletonGrid />
            ) : refined.length === 0 ? (
              <FindEmptyState onClear={clearAll} />
            ) : state.view === "list" ? (
              <ul
                className="m-0 list-none overflow-hidden p-0"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                  borderRadius: 20,
                }}
              >
                {pageHits.map((hit) => (
                  <LibraryResultRow
                    key={hit.documentId}
                    hit={hit}
                    now={now}
                    distanceKmValue={hitDistance(hit, state)}
                  />
                ))}
              </ul>
            ) : state.view === "map" ? (
              <div className="flex flex-col gap-[18px] xl:flex-row">
                <ul
                  className="m-0 min-w-0 list-none overflow-hidden p-0 xl:flex-1"
                  style={{
                    background: T.bg.deep,
                    border: `1px solid ${T.border.line}`,
                    borderRadius: 20,
                  }}
                >
                  {pageHits.map((hit) => (
                    <LibraryResultRow
                      key={hit.documentId}
                      hit={hit}
                      now={now}
                      distanceKmValue={hitDistance(hit, state)}
                    />
                  ))}
                </ul>
                <div className="xl:w-[420px] xl:shrink-0">
                  <FindMapPanel hits={refined} />
                </div>
              </div>
            ) : (
              <div
                className="grid gap-[18px]"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 270px), 1fr))",
                }}
              >
                {pageHits.map((hit) => (
                  <LibraryResultCard
                    key={hit.documentId}
                    hit={hit}
                    now={now}
                    distanceKmValue={hitDistance(hit, state)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pager */}
          {refined.length > PAGE_SIZE ? (
            <nav
              aria-label="Results pages"
              className="mt-7 flex items-center justify-center gap-4"
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => patch({ page: page - 1 })}
                className="cursor-pointer rounded-full px-4 py-2 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.hi}`,
                  color: T.ink.base,
                }}
              >
                ← Previous
              </button>
              <span className="text-[15px]" style={{ color: T.ink.dim }}>
                Page {page + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => patch({ page: page + 1 })}
                className="cursor-pointer rounded-full px-4 py-2 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.hi}`,
                  color: T.ink.base,
                }}
              >
                Next →
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────────

function facetsFrom(
  dist: Record<string, Record<string, number>> | null,
  hits: LibrarySearchHitV2[]
): FindFacets {
  const nowDate = new Date()
  let openNowCount = 0
  let hoursKnownCount = 0
  let digitalCount = 0
  const needCounts: Record<string, number> = {}
  for (const h of hits) {
    for (const need of hitNeeds(h))
      needCounts[need] = (needCounts[need] ?? 0) + 1
    const st = openStatus(h.openingTimes, h.timezone, nowDate)
    if (st.known) hoursKnownCount += 1
    if (st.known && st.open) openNowCount += 1
    if (h.iiifEndpoint) digitalCount += 1
  }

  return {
    libraryType: dist?.libraryType ?? {},
    accessibility: dist?.accessibility_names ?? {},
    services: dist?.service_names ?? {},
    openNowCount,
    hoursKnownCount,
    digitalCount,
    needs: needCounts,
  }
}

function hitDistance(
  hit: LibrarySearchHitV2,
  state: FindState
): number | undefined {
  if (state.nearLat == null || state.nearLng == null || !hit._geo) {
    return undefined
  }

  return distanceKm(state.nearLat, state.nearLng, hit._geo.lat, hit._geo.lng)
}
