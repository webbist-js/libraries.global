// apps/ui/src/components/index-page/FindLibraryPage.tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  FilterDrawer,
  FilterSidebar,
  PageHero,
  useFilterSidebar,
} from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { MobilePlaceStops } from "@/components/mobile/MobilePlaceStops"
import { NearbyMobileLibraries } from "@/components/mobile/NearbyMobileLibraries"
import { T } from "@/lib/design-tokens"
import type { FindDrive } from "@/lib/drives/find-match"
import {
  type FindResult,
  type LibrarySearchHitV2,
  FIND_MAX_REACHABLE,
  searchFind,
} from "@/lib/find-search"
import type { MobileStopHit } from "@/lib/mobile-stop-search"
import { usePathname, useRouter } from "@/lib/navigation"

import {
  type FindState,
  DEFAULT_FIND_STATE,
  activeFilterCount as countActiveFilters,
  distanceKm,
  findQueryOf,
  findStateFromParams,
  findStateToParams,
  placeName,
} from "./find-helpers"
import { LibraryResultCard, LibraryResultRow } from "./FindCards"
import { FindFilterChips, FindResultsControls } from "./FindControls"
import { FindDriveBanner } from "./FindDriveBanner"
import { type FindFacets, FindFilterSidebar } from "./FindFilterSidebar"
import { FindMapPanel } from "./FindMapPanel"
import { FindEmptyState, FindErrorState, FindSkeletonGrid } from "./FindStates"
import { LibrarySearchBox } from "./LibrarySearchBox"

export function FindLibraryPage({
  initial,
  statsTotal,
  contributeBand,
  drives,
}: {
  /** The server's search for this URL's own state; null when it failed. */
  initial: FindResult | null
  statsTotal: number
  /** Rendered between the hero and the results. */
  contributeBand?: ReactNode
  /** Open drives, for "There's a drive for this search". */
  drives?: readonly FindDrive[]
}) {
  const tUi = useUiTranslations("ui")

  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [state, setState] = useState<FindState>(() =>
    findStateFromParams(new URLSearchParams(searchParams.toString()))
  )
  const [result, setResult] = useState<FindResult | null>(initial)
  const [loading, setLoading] = useState(initial === null)
  const [error, setError] = useState(false)
  const [locating, setLocating] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [nearbyStops, setNearbyStops] = useState<MobileStopHit[]>([])
  const filterSidebar = useFilterSidebar("find")
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
  // Every filter, sort and page is answered by Meilisearch; only the view
  // (grid, list, map) stays in the browser.
  const searchKey = useMemo(() => {
    const { view: _view, ...rest } = state

    return JSON.stringify(rest)
  }, [state])

  const runFetch = useCallback(
    async (s: FindState) => {
      const seq = ++fetchSeq.current
      setLoading(true)
      setError(false)
      try {
        const res = await searchFind({
          ...findQueryOf(s, locale),
          now: new Date(),
        })
        if (seq !== fetchSeq.current) return
        setResult(res)
      } catch {
        if (seq !== fetchSeq.current) return
        setError(true)
      } finally {
        if (seq === fetchSeq.current) setLoading(false)
      }
    },
    [locale]
  )

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      // The server already searched this URL's state.
      if (result) return
    }
    const t = setTimeout(() => runFetch(state), 250)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey])

  // The open badges' clock, fixed per search so cards don't flicker.
  const now = useMemo(() => new Date(), [searchKey])

  const pageHits = result?.hits ?? []
  const total = result?.total ?? 0
  const pageCount = result?.pageCount ?? 1
  const page = Math.min(state.page, pageCount - 1)

  // "In England"
  const chosenPlaceName = state.place
    ? placeName(state.place, result?.location)
    : null

  const activeFilterCount = countActiveFilters(state)

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

  const facets: FindFacets = result
    ? {
        libraryType: result.facets.libraryType,
        accessibility: result.facets.accessibility,
        services: result.facets.services,
        openNowCount: result.facets.openNow,
        hoursKnownCount: result.facets.hoursKnown,
        digitalCount: result.facets.digital,
        needs: result.facets.needs,
        location: result.location,
      }
    : { libraryType: {}, accessibility: {}, services: {} }

  return (
    <>
      <PageHero
        breadcrumb={[
          { label: tUi("home"), href: "/" },
          { label: tUi("find_libraries") },
        ]}
        eyebrow="Library index"
        eyebrowIcon="mdi:map-search-outline"
        lead={`Search ${statsTotal.toLocaleString("en-GB")} published records by name, place, type and facilities. The index grows as contributors document more libraries.`}
        title="Find a library, *anywhere.*"
      >
        <LibrarySearchBox
          id="find-q"
          placeholder={tUi("library_town_or_country")}
          defaultQuery={state.q}
          onSubmit={(q) => patch({ q, page: 0 })}
          onClear={() => patch({ q: "", page: 0 })}
          onNearMe={handleNearMe}
          nearActive={state.nearLat != null}
          locating={locating}
        />
      </PageHero>

      {contributeBand}

      {/* Main two-column area */}
      <Container className="flex flex-1 items-start gap-8 pt-8 pb-[88px]">
        {/* Sidebar — sticky on desktop, can be hidden */}
        <FilterSidebar sidebar={filterSidebar}>
          <FindFilterSidebar
            state={state}
            facets={facets}
            onChange={patch}
            onReset={clearAll}
            sidebar={filterSidebar}
          />
        </FilterSidebar>

        {/* Sidebar — drawer on mobile */}
        <FilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          showLabel={`Show ${total.toLocaleString("en-GB")} results`}
        >
          <FindFilterSidebar
            state={state}
            facets={facets}
            onChange={patch}
            onReset={clearAll}
          />
        </FilterDrawer>

        {/* Results */}
        <section aria-label={tUi("results")} className="min-w-0 flex-1">
          <FindResultsControls
            state={state}
            total={total}
            loading={loading}
            onChange={patch}
            onOpenFilters={() => setFiltersOpen(true)}
            activeFilterCount={activeFilterCount}
            sidebar={filterSidebar}
          />

          <div className="mt-4">
            <FindFilterChips
              state={state}
              placeName={chosenPlaceName}
              onChange={patch}
              onClearAll={clearAll}
            />
          </div>

          <div className="mt-4">
            <FindDriveBanner drives={drives} state={state} />
          </div>

          <div className="mt-5">
            {state.nearLat != null &&
              state.nearLng != null &&
              state.nearIncludeMobile !== false && (
                <NearbyMobileLibraries
                  lat={state.nearLat}
                  lng={state.nearLng}
                  radiusKm={state.radiusKm}
                  onStops={setNearbyStops}
                />
              )}
            {state.place?.level === "area" && (
              <div className="mb-8">
                <MobilePlaceStops
                  slug={state.place.slug}
                  name={chosenPlaceName ?? state.place.slug}
                />
              </div>
            )}
            {error ? (
              <FindErrorState onRetry={() => runFetch(state)} />
            ) : loading && !result ? (
              <FindSkeletonGrid />
            ) : total === 0 ? (
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
                  <FindMapPanel
                    hits={pageHits}
                    stops={
                      state.nearLat != null &&
                      state.nearLng != null &&
                      state.nearIncludeMobile !== false
                        ? nearbyStops
                        : []
                    }
                  />
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
          {pageCount > 1 ? (
            <nav
              aria-label={tUi("results_pages")}
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
          {total > FIND_MAX_REACHABLE ? (
            <p
              role="status"
              className="mt-3 text-center text-[14.5px]"
              style={{ color: T.ink.dim }}
            >
              Showing the first {FIND_MAX_REACHABLE.toLocaleString("en-GB")} of{" "}
              {total.toLocaleString("en-GB")}. Add a search term or a filter to
              reach the rest.
            </p>
          ) : null}
        </section>
      </Container>
    </>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────────

function hitDistance(
  hit: LibrarySearchHitV2,
  state: FindState
): number | undefined {
  if (state.nearLat == null || state.nearLng == null || !hit._geo) {
    return undefined
  }

  return distanceKm(state.nearLat, state.nearLng, hit._geo.lat, hit._geo.lng)
}
