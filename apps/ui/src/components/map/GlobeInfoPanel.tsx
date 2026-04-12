"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/styles"

import type { GlobeDrillState } from "./MapGlobe"

// ── Types ──────────────────────────────────────────────────────────────────────

interface LibraryPin {
  documentId: string
  name: string
  slug: string
  city?: string | null
  libraryType?: string | null
  operationalStatus?: string | null
}

interface SubItem {
  name: string
  slug: string
  centroid?: { lat: number; lng: number }
}

interface PanelData {
  libraryCount: number
  libraries: LibraryPin[]
  subItems?: SubItem[]
  subLabel?: string // "Countries" | "Regions"
  pageUrl?: string
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function fetchPanelData(state: GlobeDrillState): Promise<PanelData> {
  // ── Library fetch ───────────────────────────────────────────────────────────
  const libParams = new URLSearchParams({
    status: "published",
    "pagination[pageSize]": "40",
    "fields[0]": "name",
    "fields[1]": "slug",
    "fields[2]": "libraryType",
    "fields[3]": "operationalStatus",
    "fields[4]": "city",
  })

  if (state.region?.slug) {
    libParams.set("filters[region][slug][$eq]", state.region.slug)
  } else if (state.country?.slug) {
    libParams.set("filters[country][slug][$eq]", state.country.slug)
  } else if (state.continent?.slug) {
    libParams.set("filters[continent][slug][$eq]", state.continent.slug)
  }

  const libFetch = fetch(`/api/public-proxy/api/libraries?${libParams}`)
    .then((r) =>
      r.ok ? r.json() : { data: [], meta: { pagination: { total: 0 } } }
    )
    .catch(() => ({ data: [], meta: { pagination: { total: 0 } } }))

  // ── Contextual sub-items fetch (countries for continent, regions for country)
  let subFetch: Promise<any> = Promise.resolve(null)

  if (state.level === "continent" && state.continent?.slug) {
    const p = new URLSearchParams({
      "filters[continent][slug][$eq]": state.continent.slug,
      status: "published",
      "fields[0]": "name",
      "fields[1]": "slug",
      "sort[0]": "name:asc",
      "pagination[pageSize]": "80",
      "populate[mapConfig][fields][0]": "centerLat",
      "populate[mapConfig][fields][1]": "centerLng",
    })
    subFetch = fetch(`/api/public-proxy/api/countries?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  } else if (state.level === "country" && state.country?.slug) {
    const p = new URLSearchParams({
      "filters[country][slug][$eq]": state.country.slug,
      status: "published",
      "fields[0]": "name",
      "fields[1]": "slug",
      "sort[0]": "name:asc",
      "pagination[pageSize]": "60",
      "populate[mapConfig][fields][0]": "centerLat",
      "populate[mapConfig][fields][1]": "centerLng",
    })
    subFetch = fetch(`/api/public-proxy/api/regions?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }

  const [libData, subData] = await Promise.all([libFetch, subFetch])

  const total =
    libData.meta?.pagination?.total ??
    libData.meta?.total ??
    libData.data?.length ??
    0

  const result: PanelData = {
    libraryCount: total,
    libraries: libData.data ?? [],
  }

  if (subData?.data?.length) {
    result.subItems = (subData.data as any[]).map((item: any) => {
      const slug = item.slug ?? item.attributes?.slug
      const name = item.name ?? item.attributes?.name
      const mc = item.mapConfig ?? item.attributes?.mapConfig

      return {
        slug,
        name,
        centroid:
          mc?.centerLat != null && mc?.centerLng != null
            ? { lat: mc.centerLat as number, lng: mc.centerLng as number }
            : undefined,
      }
    })
    result.subLabel = state.level === "continent" ? "Countries" : "Regions"
  }

  // Page URL for linking to the entity's detail page
  const loc = "en"
  if (state.level === "continent" && state.continent?.slug)
    result.pageUrl = `/${loc}/${state.continent.slug}`
  if (state.level === "country" && state.continent?.slug && state.country?.slug)
    result.pageUrl = `/${loc}/${state.continent.slug}/${state.country.slug}`
  if (
    state.level === "region" &&
    state.continent?.slug &&
    state.country?.slug &&
    state.region?.slug
  )
    result.pageUrl = `/${loc}/${state.continent.slug}/${state.country.slug}/${state.region.slug}`

  return result
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({
  state,
  onNavigate,
}: {
  state: GlobeDrillState
  onNavigate: (level: "world" | "continent" | "country") => void
}) {
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: "World", onClick: () => onNavigate("world") },
  ]
  if (state.continent) {
    crumbs.push({
      label: state.continent.name,
      onClick:
        state.level !== "continent" ? () => onNavigate("continent") : undefined,
    })
  }
  if (state.country) {
    crumbs.push({
      label: state.country.name,
      onClick:
        state.level !== "country" ? () => onNavigate("country") : undefined,
    })
  }
  if (state.region) {
    crumbs.push({ label: state.region.name })
  }

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-white/40">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/20">›</span>}
          {c.onClick ? (
            <button
              onClick={c.onClick}
              className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-white/70"
            >
              {c.label}
            </button>
          ) : (
            <span className={i === crumbs.length - 1 ? "text-white/70" : ""}>
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ── Library type badge ─────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  national: "National",
  public: "Public",
  academic: "Academic",
  special: "Special",
  government: "Government",
  school: "School",
  digital: "Digital",
  preservation: "Preservation",
}

function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return null

  return (
    <span className="inline-block rounded-sm bg-white/8 px-1.5 py-0.5 text-[10px] leading-none text-white/50">
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ── Sub-item row (country or region) ──────────────────────────────────────────

function SubItemRow({ item, onClick }: { item: SubItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-white/65 transition-colors hover:bg-white/6 hover:text-white/90"
    >
      <span className="flex-1 leading-snug">{item.name}</span>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        className="h-2.5 w-2.5 flex-shrink-0 text-white/20 transition-colors group-hover:text-white/50"
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

// ── Panel ─────────────────────────────────────────────────────────────────────

interface GlobeInfoPanelProps {
  state: GlobeDrillState
  onDrillChange: (s: GlobeDrillState) => void
  onClose: () => void
  onOpenMap?: () => void
}

export default function GlobeInfoPanel({
  state,
  onDrillChange,
  onClose,
  onOpenMap,
}: GlobeInfoPanelProps) {
  const [panelData, setPanelData] = useState<PanelData | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchKey = useRef("")

  const isVisible = state.level !== "world"

  const entityName =
    state.region?.name ?? state.country?.name ?? state.continent?.name ?? ""
  const levelLabel =
    state.level === "region"
      ? "Region"
      : state.level === "country"
        ? "Country"
        : "Continent"

  useEffect(() => {
    if (!isVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelData(null)

      return
    }
    const key = `${state.level}|${state.continent?.slug ?? ""}|${state.country?.slug ?? ""}|${state.region?.slug ?? ""}`
    if (key === fetchKey.current) return
    fetchKey.current = key
    setLoading(true)
    setPanelData(null)
    fetchPanelData(state)
      .then((d) => {
        if (fetchKey.current === key) setPanelData(d)
      })
      .catch(() => {
        if (fetchKey.current === key)
          setPanelData({ libraryCount: 0, libraries: [] })
      })
      .finally(() => {
        if (fetchKey.current === key) setLoading(false)
      })
  }, [state, isVisible])

  function handleNavigate(level: "world" | "continent" | "country") {
    switch (level) {
      case "world":
        onClose()

        break

      case "continent":
        onDrillChange({ level: "continent", continent: state.continent })

        break

      case "country":
        onDrillChange({
          level: "country",
          continent: state.continent,
          country: state.country,
        })

        break

      // No default
    }
  }

  function handleCountryClick(item: SubItem) {
    if (!state.continent) return
    onDrillChange({
      level: "country",
      continent: state.continent,
      country: {
        slug: item.slug,
        name: item.name,
        centroid: item.centroid ?? { lat: 0, lng: 0 },
      },
    })
  }

  function handleRegionClick(item: SubItem) {
    if (!state.continent || !state.country) return
    onDrillChange({
      level: "region",
      continent: state.continent,
      country: state.country,
      region: {
        slug: item.slug,
        name: item.name,
        centroid: item.centroid ?? { lat: 0, lng: 0 },
      },
    })
  }

  const hasSubItems = !!panelData?.subItems?.length

  return (
    <div
      className={cn(
        "absolute top-4 left-4 z-20 flex max-h-[calc(100%-2rem)] w-[380px] flex-col rounded-2xl border border-white/10 bg-[#050c1a]/92 shadow-2xl backdrop-blur-xl transition-all duration-500 ease-out",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      {/* Content */}
      <div className="relative flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-0">
          <div className="min-w-0 flex-1">
            <Breadcrumb state={state} onNavigate={handleNavigate} />
            <p className="mb-1 text-[11px] tracking-widest text-cyan-400/60 uppercase">
              {levelLabel}
            </p>
            <h2 className="truncate text-2xl leading-tight font-semibold text-white">
              {entityName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mt-1 ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
            aria-label="Close panel"
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
        </div>

        {/* Stats + View on Map */}
        <div className="mx-4 mt-3 mb-3 flex items-center gap-4 rounded-lg border border-white/8 bg-white/4 px-4 py-3">
          {loading ? (
            <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          ) : (
            <>
              <div className="text-center">
                <p className="text-xl font-semibold text-white tabular-nums">
                  {panelData?.libraryCount ?? "—"}
                </p>
                <p className="mt-0.5 text-[10px] tracking-wider text-white/40 uppercase">
                  Libraries
                </p>
              </div>
              {panelData?.subItems && (
                <div className="text-center">
                  <p className="text-xl font-semibold text-white tabular-nums">
                    {panelData.subItems.length}
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-wider text-white/40 uppercase">
                    {panelData.subLabel}
                  </p>
                </div>
              )}
              {onOpenMap && (
                <button
                  onClick={onOpenMap}
                  className="ml-auto flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[12px] font-medium text-cyan-300 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/18 hover:text-cyan-200"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                    <rect
                      x="1"
                      y="1"
                      width="6"
                      height="6"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="9"
                      y="1"
                      width="6"
                      height="6"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="1"
                      y="9"
                      width="6"
                      height="6"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M9 12h6M12 9v6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  View on Map
                </button>
              )}
            </>
          )}
        </div>

        {/* Page link */}
        {!loading && panelData?.pageUrl && (
          <a
            href={panelData.pageUrl}
            className="mx-4 mb-3 inline-flex items-center gap-1.5 text-[12px] text-cyan-400/65 transition-colors hover:text-cyan-300"
          >
            Explore {entityName}
            <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
              <path
                d="M2 2h8v8M2 10l8-8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}

        {/* Hint text */}
        {state.level === "continent" &&
          countryFeaturesAvailable(state.continent?.slug) && (
            <p className="mx-4 mb-2 text-[11px] text-white/30">
              Click a country on the globe to explore further.
            </p>
          )}
        {state.level === "continent" &&
          !countryFeaturesAvailable(state.continent?.slug) && (
            <p className="mx-4 mb-2 text-[11px] text-white/30">
              Select a country below or click &ldquo;View on Map&rdquo; to
              explore.
            </p>
          )}
        {state.level === "country" && (
          <p className="mx-4 mb-2 text-[11px] text-white/30">
            Select a region below or click a marker on the globe to drill in
            further.
          </p>
        )}
        {state.level === "region" && (
          <p className="mx-4 mb-2 text-[11px] text-white/30">
            Click &ldquo;View on Map&rdquo; to explore areas and library pins.
          </p>
        )}

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {/* ── Sub-items (Countries / Regions) ─────────────────────────── */}
          {loading && hasSubItems === false && (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-md bg-white/4"
                />
              ))}
            </div>
          )}

          {!loading && panelData?.subItems && panelData.subItems.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] tracking-widest text-white/35 uppercase">
                {panelData.subLabel}
              </p>
              <div className="space-y-0.5">
                {panelData.subItems.map((item) => (
                  <SubItemRow
                    key={item.slug}
                    item={item}
                    onClick={() =>
                      state.level === "continent"
                        ? handleCountryClick(item)
                        : handleRegionClick(item)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Library list ────────────────────────────────────────────── */}
          {(panelData?.libraryCount ?? 0) > 0 || loading ? (
            <div>
              {(panelData?.libraryCount ?? 0) > 0 && (
                <p className="mb-1.5 text-[10px] tracking-widest text-white/35 uppercase">
                  Libraries
                </p>
              )}

              {loading && (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-lg bg-white/4"
                    />
                  ))}
                </div>
              )}

              {!loading && panelData && panelData.libraries.length > 0 && (
                <ul className="space-y-1.5">
                  {panelData.libraries.map((lib) => (
                    <li key={lib.documentId}>
                      <a
                        href={`/en/library/${lib.slug}`}
                        className="group flex items-start gap-3 rounded-lg border border-transparent bg-white/4 px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/8"
                      >
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400/60 transition-colors group-hover:bg-cyan-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug text-white/80 transition-colors group-hover:text-white">
                            {lib.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {lib.city && (
                              <span className="text-[11px] text-white/35">
                                {lib.city}
                              </span>
                            )}
                            <TypeBadge type={lib.libraryType} />
                          </span>
                        </span>
                        <svg
                          viewBox="0 0 12 12"
                          fill="none"
                          className="mt-1 h-3 w-3 flex-shrink-0 text-white/20 transition-colors group-hover:text-white/50"
                        >
                          <path
                            d="M2 6h8M6 2l4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    </li>
                  ))}

                  {panelData.libraryCount > panelData.libraries.length && (
                    <li className="pt-1 text-center text-[11px] text-white/30">
                      +{panelData.libraryCount - panelData.libraries.length}{" "}
                      more · use &ldquo;View on Map&rdquo; to see all
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : (
            !loading &&
            panelData && (
              <div className="py-8 text-center">
                <p className="text-sm text-white/30">
                  No libraries recorded yet
                </p>
                {entityName && (
                  <p className="mt-1 text-[11px] text-white/20">
                    for {entityName}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// Continents that have a GeoJSON file with country boundaries
function countryFeaturesAvailable(slug?: string) {
  if (!slug) return false

  return ["europe"].includes(slug)
}
