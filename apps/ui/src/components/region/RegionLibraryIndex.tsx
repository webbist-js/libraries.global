"use client"

import { Icon } from "@iconify/react"
import { hasOpeningHours, gapDefinition, type GapKey } from "@repo/shared-data"
import { useLocale } from "next-intl"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { hubHref } from "@/components/contribute/wizard.logic"
import {
  FilterDrawer,
  FilterSidebar,
  IndexPager,
  SearchField,
  useFilterSidebar,
} from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import {
  DEFAULT_FIND_STATE,
  activeFilterCount,
  findQueryOf,
  findStateToParams,
  type FindState,
} from "@/components/index-page/find-helpers"
import {
  LibraryResultCard,
  LibraryResultRow,
} from "@/components/index-page/FindCards"
import {
  FindFilterChips,
  FindResultsControls,
} from "@/components/index-page/FindControls"
import {
  FindFilterSidebar,
  type FindFacets,
} from "@/components/index-page/FindFilterSidebar"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { LibraryOpenStatusBadge } from "@/components/library/LibraryHoursTable"
import type { LocationGapKey } from "@/components/location/location-page.helpers"
import { T } from "@/lib/design-tokens"
import {
  searchFind,
  type FindResult,
  type LibrarySearchHitV2,
} from "@/lib/find-search"
import type { RegionLibrary } from "@/lib/strapi-api/content/server"

const PAGE_SIZE = 24
const ACTION_CLASS =
  "inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-3 text-[13px] font-semibold"

/** A bounded, region-scoped version of the main library index. */
export function RegionLibraryIndex({
  regionName,
  regionSlug,
  basePath,
  libraries,
  gapsBySlug,
  gapCounts,
  typeCounts,
  total,
  countsAvailable,
  findHref,
  featuredIds = [],
  nearby,
}: {
  readonly regionName: string
  readonly regionSlug: string
  readonly basePath: string
  readonly libraries: RegionLibrary[]
  readonly gapsBySlug: Record<string, LocationGapKey[]>
  readonly gapCounts?: Partial<Record<LocationGapKey, number>> | null
  readonly typeCounts?: Record<string, number>
  readonly total: number
  readonly countsAvailable: boolean
  readonly findHref: string
  readonly featuredIds?: readonly string[]
  readonly nearby?: ReactNode
}) {
  const locale = useLocale()
  const initialState = useMemo<FindState>(
    () => ({
      ...DEFAULT_FIND_STATE,
      place: { level: "region", slug: regionSlug },
      sort: "name",
    }),
    [regionSlug]
  )
  const [state, setState] = useState(initialState)
  const [result, setResult] = useState<FindResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sidebar = useFilterSidebar(`region-${regionSlug}`)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])

  const patch = (value: Partial<FindState>) => {
    const next = { ...state, ...value, place: initialState.place }
    if (
      JSON.stringify(findQueryOf(next, locale)) !==
      JSON.stringify(findQueryOf(state, locale))
    )
      setLoading(true)
    setState(next)
    if (value.page != null && value.page > 0)
      toolbarRef.current?.scrollIntoView({ block: "start" })
  }
  const reset = () => patch({ ...initialState, view: state.view })
  const query = useMemo(() => findQueryOf(state, locale), [state, locale])
  const searchKey = JSON.stringify(query)
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const next = await searchFind({
          ...JSON.parse(searchKey),
          locale,
          hitsPerPage: PAGE_SIZE,
          now: new Date(),
        })
        if (active) setResult(next)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchKey, retry, locale])

  const now = useMemo(() => new Date(), [result])
  const featured = new Set(featuredIds)
  const seedHits: LibrarySearchHitV2[] = libraries.map((library, index) => ({
    id: index,
    documentId: library.documentId,
    name: library.name,
    slug: library.slug,
    libraryType: library.libraryType,
    city: library.city ?? library.district,
    summary: library.summary,
    openingTimes: library.openingTimes,
    timezone: library.timezone,
    operationalStatus: library.operationalStatus,
    needs: gapsBySlug[library.slug],
    heroImage: library.heroImage
      ? {
          url: library.heroImage.url,
          formats: library.heroImage.formats?.small?.url
            ? { small: { url: library.heroImage.formats.small.url } }
            : undefined,
        }
      : null,
  }))
  const allHits = result?.hits ?? seedHits
  const hits = allHits
    .filter((hit) => !featured.has(hit.documentId))
    .slice(0, PAGE_SIZE)
  const featuredMatches = allHits.filter((hit) =>
    featured.has(hit.documentId)
  ).length
  const count = result?.total ?? (countsAvailable ? total : null)
  const facets: FindFacets = result
    ? {
        libraryType: result.facets.libraryType,
        accessibility: result.facets.accessibility,
        services: result.facets.services,
        needs: result.facets.needs,
        hoursKnownCount: result.facets.hoursKnown,
        digitalCount: result.facets.digital,
        openNowCount: result.facets.openNow,
      }
    : {
        libraryType: typeCounts ?? {},
        accessibility: {},
        services: {},
        needs: Object.fromEntries(
          Object.entries(gapCounts ?? {}).filter(
            ([, value]) => typeof value === "number"
          )
        ),
      }
  const fullHref = `/libraries?${findStateToParams(state)}`
  const filterBody = (
    <FindFilterSidebar
      state={state}
      facets={facets}
      onChange={patch}
      onReset={reset}
      sidebar={sidebar}
      showLocation={false}
    />
  )
  const filterCount = Math.max(0, activeFilterCount(state) - 1)

  const renderRecord = (hit: LibrarySearchHitV2) => {
    const path = `${basePath}/${hit.slug}`
    const cardHit = {
      ...hit,
      city: hit.city || regionName,
      region_name: null,
      country_name: null,
    }
    const source = libraries.find(
      (library) => library.documentId === hit.documentId
    )
    const gaps = hit.needs ?? gapsBySlug[hit.slug] ?? []
    const gap = (state.needs.find((key) => gaps.includes(key)) ?? gaps[0]) as
      | GapKey
      | undefined
    const mobile = hit.libraryType === "Mobile"
    const physical = !mobile && hit.libraryType !== "Digital"
    const category =
      gap === "hours"
        ? mobile
          ? "Stops & times"
          : "Opening hours"
        : gap === "accessibility"
          ? "Accessibility"
          : gap === "services"
            ? "Services and facilities"
            : gap === "contact"
              ? "Website or catalogue"
              : gap === "address"
                ? "Address or location"
                : "Something else"
    const action =
      gap === "accessibility"
        ? `${path}#access`
        : hubHref(
            gap === "photo" ? "photo" : "correction",
            { slug: hit.slug, name: hit.name },
            category
          )
    const hasStatus =
      hasOpeningHours(hit.openingTimes) ||
      [
        "permanently_closed",
        "temporarily_closed",
        "planned",
        "appointment_only",
      ].includes(hit.operationalStatus ?? "")
    const status = !physical ? null : source &&
      Array.isArray(source.notices) &&
      hasStatus ? (
      <LibraryOpenStatusBadge
        openingTimes={(hit.openingTimes as OpeningTimesValue | null) ?? null}
        timezone={hit.timezone ?? null}
        operationalStatus={hit.operationalStatus}
        notices={source.notices}
      />
    ) : source && !Array.isArray(source.notices) ? (
      <span className="text-[13px]" style={{ color: T.ink.dim }}>
        Current status unavailable
      </span>
    ) : undefined
    const improve = gap ? (
      <GlobalLink
        href={action}
        aria-label={`${gap === "hours" && mobile ? "Add stops and times" : `Add ${gapDefinition(gap, hit.libraryType).label.toLowerCase()}`} for ${hit.name}`}
        className={ACTION_CLASS}
        style={{ background: T.accent.chip, color: T.accent.primary }}
      >
        <Icon aria-hidden="true" icon="mdi:plus" width={15} height={15} />
        {gap === "hours" && mobile
          ? "Add stops and times"
          : `Add ${gapDefinition(gap, hit.libraryType).label.toLowerCase()}`}
      </GlobalLink>
    ) : null

    if (state.view === "list")
      return (
        <LibraryResultRow
          key={hit.documentId}
          hit={cardHit}
          href={path}
          now={now}
          statusBadge={status}
        >
          {improve}
        </LibraryResultRow>
      )

    return (
      <li key={hit.documentId} className="flex flex-col">
        <LibraryResultCard
          hit={cardHit}
          href={path}
          now={now}
          statusBadge={status}
        >
          {improve || mobile ? (
            <div
              className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3"
              style={{ borderColor: T.border.divider }}
            >
              {improve}
              {mobile ? (
                <GlobalLink
                  href={`${path}#stops`}
                  className="inline-flex min-h-11 items-center text-[13px] underline"
                >
                  Stops and times
                </GlobalLink>
              ) : null}
            </div>
          ) : null}
        </LibraryResultCard>
      </li>
    )
  }

  return (
    <div>
      <SearchField
        id={`region-search-${regionSlug}`}
        placeholder={`Library name or town in ${regionName}`}
        label={`Search the library index in ${regionName}`}
        className="mb-5"
        onClear={() => patch({ q: "", page: 0 })}
        inputProps={{
          value: state.q,
          onChange: (event) => patch({ q: event.target.value, page: 0 }),
        }}
      />
      <div className="flex items-start gap-7">
        <FilterSidebar sidebar={sidebar}>
          {filterBody}
          {nearby ? <div className="mt-6">{nearby}</div> : null}
        </FilterSidebar>
        <div className="min-w-0 flex-1 space-y-4">
          <div ref={toolbarRef} className="scroll-mt-24">
            <FindResultsControls
              state={state}
              total={count}
              loading={loading}
              onChange={patch}
              onOpenFilters={() => setFiltersOpen(true)}
              activeFilterCount={filterCount}
              sidebar={sidebar}
              availableViews={["grid", "list"]}
            />
          </div>
          <FindFilterChips
            state={{ ...state, place: null }}
            onChange={patch}
            onClearAll={reset}
          />
          {featuredMatches > 0 ? (
            <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
              {featuredMatches === 1
                ? "One matching national library is"
                : `${featuredMatches} matching national libraries are`}{" "}
              featured above.
            </p>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border p-5"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <p className="m-0">Couldn’t load these results.</p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-3 min-h-11 font-semibold underline"
              >
                Try again
              </button>
              {" · "}
              <GlobalLink href={fullHref} className="font-semibold underline">
                Open the full index
              </GlobalLink>
            </div>
          ) : hits.length > 0 ? (
            <ul
              aria-busy={loading}
              aria-label={`Library results in ${regionName}`}
              className={
                state.view === "list"
                  ? "m-0 list-none overflow-hidden rounded-2xl border bg-white p-0"
                  : "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3"
              }
              style={{ borderColor: T.border.line }}
            >
              {hits.map(renderRecord)}
            </ul>
          ) : (
            <div
              className="rounded-2xl border p-6"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <p className="m-0">
                {featuredMatches > 0
                  ? "The matching libraries are featured above."
                  : !result && !countsAvailable
                    ? "Results are temporarily unavailable."
                    : "No libraries match this search yet."}
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-3 min-h-11 font-semibold underline"
              >
                Clear the search and filters
              </button>
            </div>
          )}
          {result && !error ? (
            <IndexPager
              page={state.page + 1}
              totalPages={result.pageCount}
              onPageChange={(page) => patch({ page: page - 1 })}
            />
          ) : null}
          <GlobalLink
            href={result ? fullHref : findHref}
            className="inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold underline underline-offset-3"
            style={{ color: T.accent.primary }}
          >
            Open in the full library index <span aria-hidden="true">→</span>
          </GlobalLink>
        </div>
      </div>
      {nearby ? <div className="mt-6 lg:hidden">{nearby}</div> : null}
      <FilterDrawer
        open={filtersOpen}
        onClose={closeFilters}
        showLabel={
          count === null
            ? "Show results"
            : `Show ${count.toLocaleString("en-GB")} results`
        }
      >
        {filterBody}
      </FilterDrawer>
    </div>
  )
}
