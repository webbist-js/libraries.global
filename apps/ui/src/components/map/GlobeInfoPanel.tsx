"use client"

import { useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
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
  featured?: boolean | null
}

interface SubItem {
  name: string
  slug: string
  centroid?: { lat: number; lng: number }
  boundaryUrl?: string | null
}

interface CountryFacts {
  summary?: string | null
  capitalCity?: string | null
  population?: string | null
  languages?: string | null
  heroImageUrl?: string | null
  systemDescription?: string | null
  budget?: string | null
  employees?: string | null
  volunteers?: string | null
  visitsPerYear?: string | null
  iso2?: string | null
}

interface PanelData {
  libraryCount: number
  libraries: LibraryPin[]
  subItems?: SubItem[]
  subLabel?: string
  pageUrl?: string
  countryFacts?: CountryFacts
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
    "fields[5]": "featured",
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
      "fields[2]": "boundaryUrl",
      "sort[0]": "name:asc",
      "pagination[pageSize]": "60",
      "populate[mapConfig][fields][0]": "centerLat",
      "populate[mapConfig][fields][1]": "centerLng",
    })
    subFetch = fetch(`/api/public-proxy/api/regions?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }

  // ── Country details fetch (summary, capital, population, languages, image) ──
  let countryDetailFetch: Promise<any> = Promise.resolve(null)
  if (state.level === "country" && state.country?.slug) {
    const p = new URLSearchParams({
      "filters[slug][$eq]": state.country.slug,
      status: "published",
      "fields[0]": "name",
      "fields[1]": "summary",
      "fields[2]": "capitalCity",
      "fields[3]": "population",
      "fields[4]": "languages",
      "fields[5]": "systemDescription",
      "fields[6]": "budget",
      "fields[7]": "employees",
      "fields[8]": "volunteers",
      "fields[9]": "visitsPerYear",
      "fields[10]": "iso2",
      "populate[heroImage][fields][0]": "url",
    })
    countryDetailFetch = fetch(`/api/public-proxy/api/countries?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }

  const [libData, subData, countryDetail] = await Promise.all([
    libFetch,
    subFetch,
    countryDetailFetch,
  ])

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
      const boundaryUrl =
        item.boundaryUrl ?? item.attributes?.boundaryUrl ?? null

      return {
        slug,
        name,
        boundaryUrl,
        centroid:
          mc?.centerLat != null && mc?.centerLng != null
            ? { lat: mc.centerLat as number, lng: mc.centerLng as number }
            : undefined,
      }
    })
    result.subLabel = state.level === "continent" ? "Countries" : "Regions"
  }

  // Country facts
  if (countryDetail?.data?.length) {
    const cd = countryDetail.data[0]
    const imgUrl =
      cd?.heroImage?.url ??
      cd?.attributes?.heroImage?.data?.attributes?.url ??
      null
    result.countryFacts = {
      summary: cd?.summary ?? cd?.attributes?.summary ?? null,
      capitalCity: cd?.capitalCity ?? cd?.attributes?.capitalCity ?? null,
      population: cd?.population ?? cd?.attributes?.population ?? null,
      languages: cd?.languages ?? cd?.attributes?.languages ?? null,
      heroImageUrl: imgUrl
        ? imgUrl.startsWith("http")
          ? imgUrl
          : `${process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"}${imgUrl}`
        : null,
      systemDescription:
        cd?.systemDescription ?? cd?.attributes?.systemDescription ?? null,
      budget: cd?.budget ?? cd?.attributes?.budget ?? null,
      employees: cd?.employees ?? cd?.attributes?.employees ?? null,
      volunteers: cd?.volunteers ?? cd?.attributes?.volunteers ?? null,
      visitsPerYear: cd?.visitsPerYear ?? cd?.attributes?.visitsPerYear ?? null,
      iso2: cd?.iso2 ?? cd?.attributes?.iso2 ?? null,
    }
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
      label: state.continent.name.toUpperCase(),
      onClick:
        state.level !== "continent" ? () => onNavigate("continent") : undefined,
    })
  }
  if (state.country) {
    crumbs.push({
      label: state.country.name.toUpperCase(),
      onClick:
        state.level !== "country" ? () => onNavigate("country") : undefined,
    })
  }
  if (state.region) {
    crumbs.push({ label: state.region.name.toUpperCase() })
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 text-[11px] tracking-widest">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/30">›</span>}
          {c.onClick ? (
            <button
              onClick={c.onClick}
              className="text-white/45 transition-colors hover:text-white/80"
            >
              {c.label}
            </button>
          ) : (
            <span className="font-semibold text-white/90">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ── Stat block ────────────────────────────────────────────────────────────────

function StatBlock({
  value,
  label,
}: {
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 py-1">
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "38px",
          lineHeight: 1,
          color: T.ink.base,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9.5px",
          letterSpacing: ".2em",
          color: "rgba(255,255,255,.38)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  )
}

function StatDivider() {
  return (
    <div
      style={{
        width: "1px",
        alignSelf: "stretch",
        background: "rgba(255,255,255,.09)",
        flexShrink: 0,
      }}
    />
  )
}

// ── Library type badge ─────────────────────────────────────────────────────────

function TypeBadge({
  type,
  featured,
}: {
  type?: string | null
  featured?: boolean | null
}) {
  if (!type && !featured) return null

  return (
    <span className="flex items-center gap-1">
      {featured && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "4px",
            border: "1px solid rgba(127,223,255,.3)",
            color: T.accent.aurora,
            background: "rgba(127,223,255,.08)",
          }}
        >
          Pillar
        </span>
      )}
      {type && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "rgba(255,255,255,.07)",
            color: "rgba(255,255,255,.45)",
          }}
        >
          {type}
        </span>
      )}
    </span>
  )
}

// ── Region row ────────────────────────────────────────────────────────────────

function RegionRow({ item, onClick }: { item: SubItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-3 py-3 text-left transition-colors hover:border-white/12 hover:bg-white/6"
    >
      {/* Boundary SVG thumbnail */}
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          flexShrink: 0,
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {item.boundaryUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.boundaryUrl}
            alt=""
            aria-hidden
            style={{
              width: "32px",
              height: "32px",
              objectFit: "contain",
              filter: "invert(1) brightness(0.55)",
            }}
          />
        ) : (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            style={{ width: "16px", height: "16px", opacity: 0.25 }}
          >
            <rect
              x="3"
              y="3"
              width="14"
              height="14"
              rx="2"
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug font-medium text-white/85 transition-colors group-hover:text-white">
          {item.name}
        </p>
      </div>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        className="h-3 w-3 flex-shrink-0 text-white/25 transition-colors group-hover:text-white/55"
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

// ── Country Facts card ─────────────────────────────────────────────────────────

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "12px",
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,.05)",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9.5px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.35)",
          flexShrink: 0,
          width: "64px",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "14px", color: T.ink.base, lineHeight: 1.4 }}>
        {value}
      </span>
    </div>
  )
}

function CountryFactsCard({ facts }: { facts: CountryFacts }) {
  const rows: { label: string; value: string }[] = []
  if (facts.capitalCity)
    rows.push({ label: "Capital", value: facts.capitalCity })
  if (facts.population) rows.push({ label: "Pop.", value: facts.population })
  if (facts.languages) rows.push({ label: "Langs", value: facts.languages })
  if (facts.visitsPerYear)
    rows.push({ label: "Visits / yr", value: facts.visitsPerYear })
  if (facts.employees) rows.push({ label: "Staff", value: facts.employees })
  if (facts.volunteers)
    rows.push({ label: "Volunteers", value: facts.volunteers })
  if (facts.budget) rows.push({ label: "Budget", value: facts.budget })
  if (facts.iso2) rows.push({ label: "ISO", value: facts.iso2 })
  if (!rows.length) return null

  return (
    <div
      style={{
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.025)",
        padding: "14px 16px",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.35)",
          marginBottom: "4px",
        }}
      >
        Country Facts
      </p>
      <div>
        {rows.map((r) => (
          <FactRow key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.35)",
        }}
      >
        {label}
      </span>
      {meta && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".1em",
            color: "rgba(255,255,255,.25)",
          }}
        >
          {meta}
        </span>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface GlobeInfoPanelProps {
  state: GlobeDrillState
  onDrillChange: (s: GlobeDrillState) => void
  onClose: () => void
  onOpenMap?: () => void
  onBackToGlobe?: () => void
}

export default function GlobeInfoPanel({
  state,
  onDrillChange,
  onClose,
  onOpenMap,
  onBackToGlobe,
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

  const heroImageUrl = panelData?.countryFacts?.heroImageUrl ?? null
  const summary = panelData?.countryFacts?.summary ?? null
  const countryFacts = panelData?.countryFacts ?? null
  const pillarCount = panelData?.libraries.filter((l) => l.featured).length ?? 0

  return (
    <div
      className={cn(
        "absolute top-4 left-4 z-20 flex flex-col gap-2 transition-all duration-500 ease-out",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
      style={{ maxHeight: "calc(100% - 2rem)" }}
    >
      {/* Back / Exit button — label and action adapt to current drill level */}
      {onBackToGlobe && (
        <button
          onClick={() => {
            if (state.level === "region" && state.country) {
              // Navigate to country level within the map shelf
              onDrillChange({
                level: "country",
                continent: state.continent,
                country: state.country,
              })
            } else {
              onBackToGlobe()
            }
          }}
          className="flex flex-shrink-0 items-center gap-2 self-start rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {state.level === "region" && state.country?.name
            ? state.country.name
            : "Back to Globe"}
        </button>
      )}

      {/* Main panel */}
      <div
        className="flex min-h-0 w-[340px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{ background: "var(--t-bg-deep)" }}
      >
        {/* ── Hero image header ─────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            height: heroImageUrl ? "140px" : "0px",
            flexShrink: 0,
            overflow: "hidden",
            transition: "height 300ms ease",
          }}
        >
          {heroImageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt={entityName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(7,13,30,.25) 0%, rgba(7,13,30,.7) 70%, var(--t-bg-deep) 100%)",
                }}
              />
              {/* Breadcrumb overlaid on image */}
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "16px",
                  right: "48px",
                }}
              >
                <Breadcrumb state={state} onNavigate={handleNavigate} />
              </div>
            </>
          )}
          {/* Close button always in top-right */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
            }}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/50 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white/80"
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

        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Header block */}
          <div style={{ padding: "16px 16px 0" }}>
            {/* Breadcrumb (when no hero image) */}
            {!heroImageUrl && (
              <div className="mb-3 flex items-center justify-between">
                <Breadcrumb state={state} onNavigate={handleNavigate} />
                <button
                  onClick={onClose}
                  className="ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
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
            )}

            {/* Level label + system description */}
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                marginBottom: "6px",
                opacity: 0.7,
              }}
            >
              {levelLabel}
              {countryFacts?.systemDescription
                ? ` · ${countryFacts.systemDescription}`
                : ""}
            </p>

            {/* Entity name */}
            <h2
              style={{
                fontFamily: T.font.serif,
                fontWeight: 400,
                fontSize: "38px",
                lineHeight: 1.05,
                color: T.ink.base,
                letterSpacing: "-.02em",
                margin: "0 0 10px",
              }}
            >
              {entityName}.
            </h2>

            {/* Summary */}
            {summary ? (
              <p
                style={{
                  fontSize: "13.5px",
                  lineHeight: "1.55",
                  color: "rgba(255,255,255,.55)",
                  marginBottom: "16px",
                }}
              >
                {summary}
              </p>
            ) : null}

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                marginBottom: "14px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,.07)",
                background: "rgba(255,255,255,.03)",
                overflow: "hidden",
              }}
            >
              {loading ? (
                <div
                  className="h-16 w-full animate-pulse"
                  style={{ background: "rgba(255,255,255,.04)" }}
                />
              ) : (
                <>
                  <StatBlock
                    value={panelData?.libraryCount ?? "—"}
                    label={
                      panelData?.libraryCount === 1 ? "Library" : "Libraries"
                    }
                  />
                  {panelData?.subItems && panelData.subItems.length > 0 && (
                    <>
                      <StatDivider />
                      <StatBlock
                        value={panelData.subItems.length}
                        label={panelData.subLabel ?? "Areas"}
                      />
                    </>
                  )}
                  {pillarCount > 0 && (
                    <>
                      <StatDivider />
                      <StatBlock value={pillarCount} label="Pillars" />
                    </>
                  )}
                </>
              )}
            </div>

            {/* Explore CTA */}
            {!loading && panelData?.pageUrl && (
              <a
                href={panelData.pageUrl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(127,223,255,.25)",
                  background: "rgba(127,223,255,.07)",
                  marginBottom: "20px",
                  transition: "background 150ms, border-color 150ms",
                }}
                className="hover:border-[rgba(127,223,255,.45)] hover:bg-[rgba(127,223,255,.12)]"
              >
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontWeight: 500,
                    fontSize: "14px",
                    color: T.accent.aurora,
                  }}
                >
                  Explore {entityName}
                </span>
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    border: "1px solid rgba(127,223,255,.25)",
                    background: "rgba(127,223,255,.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ width: "12px", height: "12px" }}
                  >
                    <path
                      d="M2 10L10 2M10 2H4M10 2v6"
                      stroke={T.accent.aurora}
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </a>
            )}

            {/* View on Map secondary link */}
            {onOpenMap && !loading && (
              <button
                onClick={onOpenMap}
                style={{ display: "none" }} // hidden — kept for future use
              />
            )}
          </div>

          {/* ── Scrollable list content ───────────────────────────── */}
          <div
            style={{
              padding: "0 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* Sub-items (Regions / Countries) */}
            {loading && !panelData?.subItems?.length && (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[58px] animate-pulse rounded-xl bg-white/4"
                  />
                ))}
              </div>
            )}

            {!loading &&
              panelData?.subItems &&
              panelData.subItems.length > 0 && (
                <div>
                  <SectionHeader
                    label={panelData.subLabel ?? "Areas"}
                    meta={String(panelData.subItems.length).padStart(2, "0")}
                  />
                  <div className="flex flex-col gap-2">
                    {panelData.subItems.map((item) => (
                      <RegionRow
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

            {/* Libraries */}
            {(loading || (panelData?.libraryCount ?? 0) > 0) && (
              <div>
                {!loading && (panelData?.libraryCount ?? 0) > 0 && (
                  <SectionHeader
                    label="Libraries"
                    meta={String(panelData!.libraryCount).padStart(
                      Math.max(2, String(panelData!.libraryCount).length),
                      "0"
                    )}
                  />
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
                  <ul className="flex flex-col gap-0.5">
                    {panelData.libraries.map((lib) => (
                      <li key={lib.documentId}>
                        <a
                          href={`/en/library/${lib.slug}`}
                          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] leading-snug font-medium text-white/85 transition-colors group-hover:text-white">
                              {lib.name}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              {lib.city && (
                                <span
                                  style={{
                                    fontFamily: T.font.mono,
                                    fontSize: "10px",
                                    letterSpacing: ".1em",
                                    textTransform: "uppercase",
                                    color: "rgba(255,255,255,.3)",
                                  }}
                                >
                                  {lib.city}
                                </span>
                              )}
                              <TypeBadge
                                type={lib.libraryType}
                                featured={lib.featured}
                              />
                            </div>
                          </div>
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            className="h-3 w-3 flex-shrink-0 text-white/20 transition-colors group-hover:text-white/50"
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
                      <li className="pt-1 text-center text-[11px] text-white/25">
                        +{panelData.libraryCount - panelData.libraries.length}{" "}
                        more libraries
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {!loading && panelData && panelData.libraryCount === 0 && (
              <div
                style={{
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,.06)",
                  background: "rgba(255,255,255,.02)",
                  padding: "32px 16px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,.3)" }}>
                  No libraries yet
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,.18)",
                    marginTop: "4px",
                  }}
                >
                  Check back as we grow the catalogue
                </p>
              </div>
            )}

            {/* Country Facts */}
            {!loading && countryFacts && (
              <CountryFactsCard facts={countryFacts} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Continents that have a GeoJSON file with country boundaries
function _countryFeaturesAvailable(slug?: string) {
  if (!slug) return false

  return ["europe"].includes(slug)
}
