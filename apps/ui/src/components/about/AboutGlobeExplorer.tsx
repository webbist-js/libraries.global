"use client"

import { atlasLocalGeography, atlasPopulationBaseline } from "@repo/shared-data"
import { ArrowUpRight, ChevronLeft, ChevronRight, Pin, X } from "lucide-react"
import dynamic from "next/dynamic"
import { useLocale } from "next-intl"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import {
  withUkCountries,
  type CountryBoundaries,
  type LocalBoundaries,
} from "@/components/about/about-globe-geography"
import type {
  AboutGlobeCountry,
  AboutGlobeRecord,
  GlobeHover,
} from "@/components/about/about-globe.types"
import type { GlobeProjectionRefs } from "@/components/about/AboutGlobePickingLayer"
import GlobalLink from "@/components/global/GlobalLink"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import type { GlobeView } from "@/components/home/KnowledgeGlobeCanvas"
import { tintForLibraryType } from "@/lib/design-tokens"

const AboutGlobePickingLayer = dynamic(
  () =>
    import("@/components/about/AboutGlobePickingLayer").then(
      (module) => module.AboutGlobePickingLayer
    ),
  { ssr: false }
)

type CountryHover = Extract<GlobeHover, { kind: "country" }>
type RecordResult = { data: AboutGlobeRecord } | { error: true }

export function AboutGlobeExplorer({
  enabled,
  countries,
  markers,
  allowRotation,
  children,
}: {
  readonly enabled: boolean
  readonly allowRotation: boolean
  readonly countries: readonly AboutGlobeCountry[]
  readonly markers: readonly LibraryMarker[]
  readonly children: (props: {
    layer: ReactNode
    inspecting: boolean
    view?: GlobeView
  }) => ReactNode
}) {
  const locale = useLocale()
  const [boundaries, setBoundaries] = useState<CountryBoundaries | null>(null)
  const [hover, setHover] = useState<GlobeHover>(null)
  const [pinned, setPinned] = useState<CountryHover | null>(null)
  const [view, setView] = useState<GlobeView>()
  const [records, setRecords] = useState<Record<string, RecordResult>>({})
  const [retry, setRetry] = useState(0)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ring = useRef<HTMLDivElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const endpointA = useRef<HTMLDivElement>(null)
  const endpointB = useRef<HTMLDivElement>(null)
  const connector = useRef<SVGPathElement>(null)
  const select = useRef<HTMLSelectElement>(null)
  const projections: GlobeProjectionRefs = {
    ring,
    tooltip,
    endpoints: [endpointA, endpointB],
    connector,
  }
  const [lastShown, setLastShown] = useState<CountryHover | null>(null)
  const shown = pinned ?? (hover?.kind === "country" ? hover : null)
  if (shown && lastShown !== shown) setLastShown(shown)
  const country = (shown ?? lastShown)?.country
  const recordKey = country ? `${locale}/${country.slug}` : ""
  const result = records[recordKey]
  const data = result && "data" in result ? result.data : null

  const keepOpen = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = null
  }, [])
  const updateHover = useCallback(
    (target: GlobeHover) => {
      keepOpen()
      if (target) setHover(target)
      else clearTimer.current = setTimeout(() => setHover(null), 220)
    },
    [keepOpen]
  )
  const close = useCallback(() => {
    keepOpen()
    setHover(null)
    setPinned(null)
  }, [keepOpen])

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current)
    },
    []
  )
  useEffect(() => {
    if (shown || !lastShown) return
    const timer = setTimeout(() => setLastShown(null), 120)

    return () => clearTimeout(timer)
  }, [shown, lastShown])

  useEffect(() => {
    if (!enabled || boundaries || !countries.length) return
    const controller = new AbortController()
    const read = async (url: string) => {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error("Country boundaries unavailable")

      return response.json()
    }
    const hasUkCountries = countries.some((entry) =>
      ["ENG", "SCT", "WLS", "NIR"].includes(entry.iso3)
    )
    Promise.all([
      read(atlasPopulationBaseline.geometryUrl) as Promise<CountryBoundaries>,
      hasUkCountries
        ? (read(atlasLocalGeography.geometryUrl).catch(
            () => null
          ) as Promise<LocalBoundaries | null>)
        : Promise.resolve(null),
    ])
      .then(([world, local]) => {
        if (!controller.signal.aborted)
          setBoundaries(local ? withUkCountries(world, local) : world)
      })
      .catch(() => {
        /* The country selector remains usable without boundaries. */
      })

    return () => controller.abort()
  }, [enabled, boundaries, countries.length])

  useEffect(() => {
    if (!enabled || !shown || !country || result) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(
        `/api/about/countries/${encodeURIComponent(country.slug)}?locale=${encodeURIComponent(locale)}`,
        { signal: controller.signal }
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Country unavailable")

          return response.json() as Promise<{ data: AboutGlobeRecord }>
        })
        .then(({ data: record }) => {
          if (!controller.signal.aborted)
            setRecords((previous) => ({
              ...previous,
              [recordKey]: { data: record },
            }))
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setRecords((previous) => ({
              ...previous,
              [recordKey]: { error: true },
            }))
        })
    }, 120)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [country, enabled, locale, recordKey, result, retry, shown])

  // Discard inspection state as the reveal leaves view, before painting.
  if (!enabled && (hover || pinned)) {
    setHover(null)
    setPinned(null)
  }
  useEffect(() => {
    if (!enabled) keepOpen()
  }, [enabled, keepOpen])
  useEffect(() => {
    if (!enabled) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (pinned || hover)) {
        close()
        select.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener("keydown", escape)

    return () => window.removeEventListener("keydown", escape)
  }, [enabled, pinned, hover, close])

  const choose = (next: AboutGlobeCountry) => {
    close()
    const center =
      next.center ??
      atlasPopulationBaseline.countries.find(
        (entry) => entry.iso3 === next.iso3
      )?.bounds
    const point =
      center && "lat" in center
        ? center
        : center
          ? {
              lat: (center.north + center.south) / 2,
              lng: (center.east + center.west) / 2,
            }
          : { lat: 0, lng: 0 }
    setPinned({ kind: "country", country: next, ...point })
    setView(point)
  }
  const step = (direction: number) => {
    const index = countries.findIndex((entry) => entry.slug === country?.slug)
    const next =
      countries[(index + direction + countries.length) % countries.length]
    if (next) choose(next)
  }
  const count = data?.libraryCount ?? null
  const typeTotal =
    data?.libraryTypeCounts?.reduce((sum, entry) => sum + entry.count, 0) ?? 0
  const preview =
    pinned &&
    hover?.kind === "country" &&
    hover.country.slug !== pinned.country.slug
      ? hover.country
      : null

  return (
    <div
      className="about-globe-explorer"
      data-inspecting={
        enabled && Boolean(shown || hover?.kind === "connection")
      }
    >
      {children({
        layer:
          enabled && boundaries ? (
            <AboutGlobePickingLayer
              countries={countries}
              boundaries={boundaries}
              markers={markers}
              selected={shown}
              hover={hover}
              projections={projections}
              onHover={updateHover}
              onPin={setPinned}
              allowRotation={allowRotation}
            />
          ) : null,
        inspecting: enabled && Boolean(shown || hover?.kind === "connection"),
        view,
      })}
      {enabled ? (
        <>
          <div className="about-country-picker">
            <label htmlFor="about-country-picker">Explore a country</label>
            <select
              id="about-country-picker"
              ref={select}
              value={pinned?.country.slug ?? ""}
              onChange={(event) => {
                const next = countries.find(
                  (entry) => entry.slug === event.target.value
                )
                if (next) choose(next)
                else close()
              }}
            >
              <option value="">Choose a country</option>
              {countries.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <p className="sr-only" role="status">
            {hover?.kind === "connection" ? hover.names.join(" · ") : ""}
          </p>
          <div className="about-globe-annotations" aria-hidden="true">
            {shown ? (
              <>
                <svg className="about-country-connector">
                  <path ref={connector} />
                </svg>
                <div ref={ring} className="about-country-anchor">
                  <span />
                </div>
              </>
            ) : null}
            {preview ? (
              <div ref={tooltip} className="about-country-preview">
                <span>{preview.iso2}</span>
                <h3>{preview.name}</h3>
                <p>
                  {preview.libraryCount === null
                    ? "Explore the country's record"
                    : `${preview.libraryCount.toLocaleString(locale)} libraries recorded`}
                </p>
                <small>Click to pin this country</small>
              </div>
            ) : null}
            {hover?.kind === "connection"
              ? hover.names.map((name, index) => (
                  <div
                    key={`${hover.index}-${index}`}
                    ref={index === 0 ? endpointA : endpointB}
                    className="about-connection-label"
                  >
                    <span>{name}</span>
                  </div>
                ))
              : null}
          </div>
          {country ? (
            <aside
              className="about-country-panel"
              aria-label={`${country.name} library record`}
              aria-hidden={!shown}
              inert={!shown ? true : undefined}
              data-open={Boolean(shown)}
              onPointerEnter={keepOpen}
              onPointerLeave={() => {
                if (!pinned) updateHover(null)
              }}
              onFocus={keepOpen}
              onBlur={(event) => {
                if (
                  !pinned &&
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  updateHover(null)
              }}
            >
              <div className="about-country-heading">
                <p className="about-eyebrow">
                  Country{country.iso2 ? ` · ${country.iso2}` : ""}
                </p>
                <div className="about-country-actions">
                  <button
                    type="button"
                    aria-label="Previous country"
                    onClick={() => step(-1)}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next country"
                    onClick={() => step(1)}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Close country details"
                    onClick={() => {
                      close()
                      select.current?.focus({ preventScroll: true })
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <h2>{country.name}</h2>
              <div className="about-country-status">
                {pinned ? (
                  <>
                    <Pin size={12} aria-hidden="true" /> Pinned to the globe
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (shown) setPinned(shown)
                    }}
                  >
                    <Pin size={12} aria-hidden="true" /> Pin this country
                  </button>
                )}
              </div>
              <p className="about-country-count">
                {count === null || count === undefined ? (
                  <span>—</span>
                ) : (
                  <span>{count.toLocaleString(locale)}</span>
                )}
                <small>
                  {count === null || count === undefined
                    ? !result
                      ? "Loading library count…"
                      : "Library count unavailable"
                    : "libraries recorded"}
                </small>
              </p>
              {data?.summary ? (
                <p className="about-country-summary">{data.summary}</p>
              ) : null}
              {data?.capitalCity ? (
                <p className="about-country-capital">
                  Capital · {data.capitalCity}
                </p>
              ) : null}
              {!result ? (
                <p className="about-country-message" role="status">
                  Loading the country’s record…
                </p>
              ) : "error" in result ? (
                <div className="about-country-message" role="status">
                  Details are temporarily unavailable.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setRecords((previous) => {
                        const next = { ...previous }
                        delete next[recordKey]

                        return next
                      })
                      setRetry((value) => value + 1)
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : null}
              {data?.libraryTypeCounts?.length ? (
                <div className="about-country-types">
                  <h3>By type</h3>
                  <div className="about-country-type-bar" aria-hidden="true">
                    {data.libraryTypeCounts.map((entry) => (
                      <span
                        key={entry.type}
                        style={{
                          flexGrow: entry.count,
                          background: tintForLibraryType(entry.type).fg,
                        }}
                      />
                    ))}
                  </div>
                  <ul>
                    {data.libraryTypeCounts.map((entry) => (
                      <li key={entry.type}>
                        <i
                          style={{
                            background: tintForLibraryType(entry.type).fg,
                          }}
                          aria-hidden="true"
                        />
                        <span>{entry.type}</span>
                        <strong>{entry.count.toLocaleString(locale)}</strong>
                      </li>
                    ))}
                  </ul>
                  {typeTotal && count !== null && typeTotal !== count ? (
                    <p className="about-country-message">
                      Type totals cover records with a recorded library type.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {data?.featuredLibraries.length ? (
                <div className="about-country-featured">
                  <h3>Featured libraries</h3>
                  <ul>
                    {data.featuredLibraries.map((library) => (
                      <li key={library.href ?? library.name}>
                        {library.href ? (
                          <GlobalLink href={library.href}>
                            <i aria-hidden="true" />
                            <span>
                              <strong>{library.name}</strong>
                              <small>
                                {[library.place, library.type]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            </span>
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </GlobalLink>
                        ) : (
                          <span>{library.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="about-country-links">
                <GlobalLink
                  href={
                    country.center
                      ? `/map?v=${country.center.lat},${country.center.lng},5`
                      : `/map?q=${encodeURIComponent(country.name)}`
                  }
                  className="about-button"
                >
                  Open in the atlas
                </GlobalLink>
                <GlobalLink
                  href={`/${country.continent}/${country.slug}`}
                  className="about-button about-button-secondary"
                >
                  Country page
                </GlobalLink>
              </div>
              <p className="about-country-footer">
                Published records from the index.{" "}
                <GlobalLink
                  href={`/contribute?country=${encodeURIComponent(country.slug)}`}
                >
                  Add local knowledge
                </GlobalLink>
              </p>
            </aside>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
