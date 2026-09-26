"use client"

import { useId, useMemo } from "react"

import { T } from "@/lib/design-tokens"

import { Icon, PinGlyph } from "./atlas-ui"
import {
  type AtlasFilters,
  type AtlasLibrary,
  countWith,
  facilityOptions,
  hasStepFree,
  typeGroupOf,
} from "./atlas.logic"

export interface Place {
  key: string
  label: string
  sub: string
  kind: "region" | "country" | "city"
  libraries: AtlasLibrary[]
}

export interface RecentItem {
  kind: "library" | "place"
  key: string
  label: string
  sub: string
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
}) {
  const inputId = useId()
  const q = norm(query.trim())

  const results = useMemo(() => {
    if (q.length < 2) return null
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
  }, [q, places, libraries])

  // Presets that apply real filters, shown only when they'd find something.
  const presets = useMemo(() => {
    const stepFree = facilityOptions(libraries).find((f) =>
      hasStepFree({ access: [f.name] } as AtlasLibrary)
    )
    const all: Preset[] = [
      { label: "Open now", patch: { opening: "now" } },
      {
        label: "Open on Sundays",
        patch: { opening: "at", atDay: 6, atMinutes: 12 * 60 },
      },
      { label: "Community-run libraries", patch: { operators: ["community"] } },
      ...(stepFree
        ? [
            {
              label: "Step-free access",
              patch: { facilities: [stepFree.name] },
            },
          ]
        : []),
      { label: "Live catalogue", patch: { catalogue: true } },
      { label: "Monastic libraries", patch: { types: ["monastic"] } },
      { label: "Academic libraries", patch: { types: ["academic"] } },
    ]

    return all
      .filter((p) => countWith(libraries, filters, p.patch, now) > 0)
      .slice(0, 5)
  }, [libraries, filters, now])

  const placeByKey = useMemo(
    () => new Map(places.map((p) => [p.key, p])),
    [places]
  )
  const libById = useMemo(
    () => new Map(libraries.map((l) => [l.id, l])),
    [libraries]
  )

  return (
    <div className="flex min-h-full flex-col gap-[18px]">
      <label
        htmlFor={inputId}
        className="flex h-12 items-center gap-2.5 rounded-[14px] border px-3.5 focus-within:border-(--t-accent-primary) focus-within:shadow-[0_0_0_3px_var(--t-accent-chip)]"
        style={{ borderColor: T.border.hi, background: "#fff" }}
      >
        <Icon name="search" size={20} color={T.ink.base} />
        <span className="sr-only">Search libraries and places</span>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Library or place"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-(--t-ink-dim)"
          style={{ color: T.ink.base }}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQuery("")}
            className="flex size-8 items-center justify-center rounded-full"
            style={{ color: T.ink.dim }}
          >
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </label>

      {results ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          {results.placeHits.length + results.libHits.length === 0 ? (
            <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
              Nothing in the atlas matches “{query.trim()}”. Try a town, region
              or library name.
            </p>
          ) : null}
          {results.placeHits.length > 0 ? (
            <ResultGroup title="Places">
              {results.placeHits.map((p) => (
                <ResultRow
                  key={p.key}
                  icon="pin"
                  title={p.label}
                  sub={`${p.sub} · ${p.libraries.length} ${p.libraries.length === 1 ? "library" : "libraries"}`}
                  onClick={() => onPickPlace(p)}
                />
              ))}
            </ResultGroup>
          ) : null}
          {results.libHits.length > 0 ? (
            <ResultGroup title="Libraries">
              {results.libHits.map((l) => (
                <ResultRow
                  key={l.id}
                  glyph={<PinGlyph group={typeGroupOf(l.type)} />}
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
            <ResultGroup title="Recent">
              {recent.map((r) => {
                const lib =
                  r.kind === "library" ? libById.get(r.key) : undefined
                const place =
                  r.kind === "place" ? placeByKey.get(r.key) : undefined
                if (!lib && !place) return null

                return (
                  <ResultRow
                    key={`${r.kind}:${r.key}`}
                    icon={r.kind === "library" ? "book" : "pin"}
                    title={r.label}
                    sub={r.sub}
                    trailing="hist"
                    onClick={() =>
                      lib ? onPickLibrary(lib) : onPickPlace(place!)
                    }
                  />
                )
              })}
            </ResultGroup>
          ) : null}
          {presets.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-[14px] font-bold">Try</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onPreset(p.patch)}
                    className="inline-flex h-9 items-center rounded-full border bg-white px-3 text-[14px] font-semibold whitespace-nowrap hover:border-(--t-accent-primary)"
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

      <button
        type="button"
        onClick={onGoLayers}
        className="mt-auto flex items-start gap-3 rounded-[18px] border px-4 py-3.5 text-left"
        style={{ background: T.bg.surface, borderColor: T.border.divider }}
      >
        <span className="mt-0.5" style={{ color: T.accent.primary }}>
          <Icon name="layers" size={20} />
        </span>
        <span className="text-[14px] leading-normal">
          <strong className="block text-[15px]">Add context to the map</strong>
          Density, opening hours and more live in the Layers tab.
        </span>
      </button>
    </div>
  )
}

function ResultGroup({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 mb-1 text-[14px] font-bold">{title}</p>
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </div>
  )
}

function ResultRow({
  icon,
  glyph,
  title,
  sub,
  trailing,
  onClick,
}: {
  readonly icon?: "pin" | "book"
  readonly glyph?: React.ReactNode
  readonly title: string
  readonly sub: string
  readonly trailing?: "hist"
  readonly onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="-mx-2.5 flex w-[calc(100%+20px)] items-center gap-3 rounded-[14px] px-2.5 py-2 text-left hover:bg-(--t-bg-surface)"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: T.bg.muted, color: T.ink.dim }}
        >
          {glyph ?? <Icon name={icon ?? "pin"} size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate font-semibold"
            style={{ color: T.ink.base }}
          >
            {title}
          </span>
          <span
            className="block truncate text-[14px]"
            style={{ color: T.ink.dim }}
          >
            {sub}
          </span>
        </span>
        {trailing ? <Icon name="hist" size={16} color="#8A8799" /> : null}
      </button>
    </li>
  )
}
