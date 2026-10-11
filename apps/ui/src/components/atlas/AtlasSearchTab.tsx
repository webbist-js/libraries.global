"use client"

import {
  localDateTime,
  visitRunsOn,
  type PublicLiveState,
  type AtlasScope,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { type ReactNode, useId, useMemo, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { MobileStopHit, MobileVisitFilter } from "@/lib/mobile-stop-search"

import { Icon, PinGlyph } from "./atlas-ui"
import {
  type AtlasFilters,
  type AtlasLibrary,
  countWith,
  typeGroupOf,
} from "./atlas.logic"
import { AtlasMobileSearch, type MobileSearchStatus } from "./AtlasMobileSearch"
import { ResultGroup, ResultRow } from "./AtlasSearchResults"
import { isFreshLive } from "./useMobileAtlas"

export interface Place {
  scope?: AtlasScope["place"]
  exactTotal?: number
  key: string
  label: string
  sub: string
  kind: "region" | "country" | "city"
  libraries: AtlasLibrary[]
}

export interface RecentItem {
  kind: "library" | "place" | "stop"
  key: string
  label: string
  sub: string
  stop?: MobileStopHit
}

const norm = (s: string) =>
  s.normalize("NFKD").replaceAll(/[̀-ͯ]/g, "").toLowerCase()

export function buildPlaces(libs: AtlasLibrary[]): Place[] {
  const map = new Map<string, Place>()
  const add = (kind: Place["kind"], label: string | null, sub: string) => {
    if (!label) return null
    const key = `${kind}:${label}:${sub}`
    let p = map.get(key)
    if (!p) {
      p = { key, label, sub, kind, libraries: [] }
      map.set(key, p)
    }

    return p
  }
  for (const l of libs) {
    add("country", l.country, "Country")?.libraries.push(l)
    add(
      "region",
      l.region,
      `Region · ${l.country ?? ""}`.replace(/ · $/, "")
    )?.libraries.push(l)
    if (l.city && l.city !== l.region)
      add(
        "city",
        l.city,
        `Place · ${l.region ?? l.country ?? ""}`.replace(/ · $/, "")
      )?.libraries.push(l)
  }

  return [...map.values()]
}

function rank(name: string, q: string): number {
  const n = norm(name)
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (n.split(/\s+/).some((w) => w.startsWith(q))) return 2

  return n.includes(q) ? 3 : -1
}

interface Preset {
  label: string
  patch: Partial<AtlasFilters>
}

export function AtlasSearchTab({
  query,
  onQuery,
  libraries,
  places,
  filters,
  now,
  recent,
  onPickLibrary,
  onPickPlace,
  onPreset,
  onGoLayers,
  contributePrompt,
  onPickStop,
  onMobilePreset,
  mobileLive = {},
  serverResults,
  serverPresets,
  onPickRecent,
}: {
  readonly query: string
  readonly onQuery: (q: string) => void
  readonly libraries: AtlasLibrary[]
  readonly places: Place[]
  readonly filters: AtlasFilters
  readonly now: Date
  readonly recent: RecentItem[]
  readonly onPickLibrary: (lib: AtlasLibrary) => void
  readonly onPickPlace: (place: Place) => void
  readonly onPreset: (patch: Partial<AtlasFilters>) => void
  readonly onGoLayers: () => void
  /** The invitation to contribute, under the Layers hint. */
  readonly contributePrompt?: ReactNode
  readonly onPickStop?: (stop: MobileStopHit) => void
  readonly onMobilePreset?: (mode: MobileVisitFilter) => void
  readonly mobileLive?: Record<string, PublicLiveState>
  readonly serverResults?: { libraries: AtlasLibrary[]; places: Place[] }
  readonly serverPresets?: Preset[]
  readonly onPickRecent?: (item: RecentItem) => void
}) {
  const tUi = useUiTranslations("ui")

  const inputId = useId()
  const [mobileStatus, setMobileStatus] = useState<MobileSearchStatus | null>(
    null
  )
  const q = norm(query.trim())

  const results = useMemo(() => {
    if (q.length < 2) return null
    if (serverResults)
      return {
        placeHits: serverResults.places.slice(0, 4),
        libHits: serverResults.libraries.slice(0, 8),
      }
    const placeHits = places
      .map((p) => ({ p, r: rank(p.label, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || b.p.libraries.length - a.p.libraries.length)
      .slice(0, 4)
      .map((x) => x.p)
    const libHits = libraries
      .map((l) => ({
        l,
        r: Math.min(
          ...[l.name, l.city ?? ""]
            .map((s) => rank(s, q))
            .map((r) => (r < 0 ? 9 : r))
        ),
      }))
      .filter((x) => x.r < 9)
      .sort((a, b) => a.r - b.r || a.l.name.localeCompare(b.l.name))
      .slice(0, 8)
      .map((x) => x.l)

    return { placeHits, libHits }
  }, [q, places, libraries, serverResults])

  // Presets that apply real filters, shown only when they'd find something.
  const presets = useMemo(() => {
    if (serverPresets) return serverPresets
    const all: Preset[] = [
      { label: tUi("open_now"), patch: { opening: "now" } },
      {
        label: "Open on Sundays",
        patch: { opening: "at", atDay: 6, atMinutes: 12 * 60 },
      },
      { label: "Community-run libraries", patch: { operators: ["community"] } },
      { label: "Live catalogue", patch: { catalogue: true } },
      { label: "Monastic libraries", patch: { types: ["monastic"] } },
      { label: "Academic libraries", patch: { types: ["academic"] } },
    ]

    return all
      .filter((p) => countWith(libraries, filters, p.patch, now) > 0)
      .slice(0, 5)
  }, [libraries, filters, now, serverPresets, tUi])

  const placeByKey = useMemo(
    () => new Map(places.map((p) => [p.key, p])),
    [places]
  )
  const libById = useMemo(
    () => new Map(libraries.map((l) => [l.id, l])),
    [libraries]
  )
  const libraryIds = useMemo(
    () => new Set((results?.libHits ?? []).map((library) => library.id)),
    [results]
  )

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-[18px]">
      <label
        htmlFor={inputId}
        className="flex h-14 items-center gap-2.5 rounded-[16px] border px-3.5 focus-within:border-(--t-accent-primary) focus-within:shadow-[0_0_0_3px_var(--t-accent-chip)]"
        style={{ borderColor: T.border.hi, background: "#fff" }}
      >
        <Icon name="search" size={20} color={T.ink.base} />
        <span className="sr-only">Search libraries, stops and places</span>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={tUi("library_stop_or_place")}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-(--t-ink-dim)"
          style={{ color: T.ink.base }}
        />
        {query ? (
          <button
            type="button"
            aria-label={tUi("clear_search")}
            onClick={() => onQuery("")}
            className="flex size-8 items-center justify-center rounded-full"
            style={{ color: T.ink.dim }}
          >
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </label>

      {onPickStop ? (
        <AtlasMobileSearch
          query={query}
          onPick={onPickStop}
          onStatus={setMobileStatus}
          libraryIds={libraryIds}
        />
      ) : null}

      {results ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          {results.placeHits.length + results.libHits.length === 0 &&
          (!onPickStop ||
            (mobileStatus?.query === query.trim() &&
              !mobileStatus.pending &&
              !mobileStatus.failed &&
              mobileStatus.count === 0)) ? (
            <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
              Nothing in the atlas matches “{query.trim()}”. Try a town, region,
              stop or library name.
            </p>
          ) : null}
          {results.placeHits.length > 0 ? (
            <ResultGroup title={tUi("places")}>
              {results.placeHits.map((p) => (
                <ResultRow
                  key={p.key}
                  icon="pin"
                  title={p.label}
                  sub={`${p.sub} · ${p.exactTotal ?? p.libraries.length} ${(p.exactTotal ?? p.libraries.length) === 1 ? "library" : "libraries"}`}
                  onClick={() => onPickPlace(p)}
                />
              ))}
            </ResultGroup>
          ) : null}
          {results.libHits.length > 0 ? (
            <ResultGroup title={tUi("libraries")}>
              {results.libHits.map((l) => (
                <ResultRow
                  key={l.id}
                  glyph={
                    l.type === "Mobile" ? undefined : (
                      <PinGlyph group={typeGroupOf(l.type)} />
                    )
                  }
                  icon={l.type === "Mobile" ? "bus" : "book"}
                  title={l.name}
                  sub={[l.city, l.region, l.country].filter(Boolean).join(", ")}
                  onClick={() => onPickLibrary(l)}
                />
              ))}
            </ResultGroup>
          ) : null}
        </div>
      ) : (
        <>
          {recent.length > 0 ? (
            <ResultGroup title={tUi("recent")}>
              {recent.map((r) => {
                const lib =
                  r.kind === "library" ? libById.get(r.key) : undefined
                const place =
                  r.kind === "place" ? placeByKey.get(r.key) : undefined
                const stop = r.kind === "stop" ? r.stop : undefined
                if (stop && onPickStop) {
                  const date = localDateTime(now, stop.timezone).date
                  const visitsToday =
                    !stop.cancelled_dates.includes(date) &&
                    stop.visits.some((visit) =>
                      visitRunsOn(
                        {
                          version: 1,
                          cycle: stop.cycle,
                          stops: [],
                          visits: stop.visits,
                        },
                        visit,
                        date
                      )
                    )

                  return (
                    <ResultRow
                      key={`stop:${r.key}`}
                      icon="bus"
                      title={r.label}
                      sub={r.sub}
                      badge={
                        isFreshLive(mobileLive[stop.library_document_id])
                          ? tUi("live_now")
                          : visitsToday
                            ? "Visit today"
                            : undefined
                      }
                      onClick={() => onPickStop(stop)}
                    />
                  )
                }
                if (!lib && !place && onPickRecent && r.kind !== "stop")
                  return (
                    <ResultRow
                      key={`${r.kind}:${r.key}`}
                      icon={r.kind === "library" ? "book" : "pin"}
                      title={r.label}
                      sub={r.sub}
                      trailing="hist"
                      onClick={() => onPickRecent(r)}
                    />
                  )
                if (!lib && !place) return null

                return (
                  <ResultRow
                    key={`${r.kind}:${r.key}`}
                    icon={
                      lib?.type === "Mobile"
                        ? "bus"
                        : r.kind === "library"
                          ? "book"
                          : "pin"
                    }
                    title={r.label}
                    sub={r.sub}
                    trailing="hist"
                    badge={
                      lib?.type === "Mobile" && isFreshLive(mobileLive[lib.id])
                        ? tUi("live_now")
                        : undefined
                    }
                    onClick={() =>
                      lib ? onPickLibrary(lib) : onPickPlace(place!)
                    }
                  />
                )
              })}
            </ResultGroup>
          ) : null}
          {presets.length > 0 || onMobilePreset ? (
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-[14px] font-bold">Try</p>
              <div className="flex flex-wrap gap-2">
                {onMobilePreset ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onMobilePreset("today")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-[14px] font-semibold"
                      style={{ borderColor: T.border.hi }}
                    >
                      <Icon name="bus" size={16} color={T.map.stopRing} />
                      Stops visited today
                    </button>
                    <button
                      type="button"
                      onClick={() => onMobilePreset("live")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-[14px] font-semibold"
                      style={{ borderColor: T.border.hi }}
                    >
                      <Icon name="bus" size={16} color={T.map.stopRing} />
                      {tUi("live_now")}
                    </button>
                  </>
                ) : null}
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onPreset(p.patch)}
                    className="inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-[14px] font-semibold whitespace-nowrap hover:border-(--t-accent-primary)"
                    style={{ borderColor: T.border.hi }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          onClick={onGoLayers}
          className="flex items-start gap-3 rounded-[18px] border px-4 py-3.5 text-left"
          style={{ background: T.bg.surface, borderColor: T.border.divider }}
        >
          <span className="mt-0.5" style={{ color: T.accent.primary }}>
            <Icon name="layers" size={20} />
          </span>
          <span className="text-[14px] leading-normal">
            <strong className="block text-[15px]">
              Add context to the map
            </strong>
            Density, opening hours and more live in the Layers tab.
          </span>
        </button>
        {contributePrompt}
      </div>
    </div>
  )
}
