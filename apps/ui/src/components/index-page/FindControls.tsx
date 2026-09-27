// apps/ui/src/components/index-page/FindControls.tsx
"use client"

import { FilterToggleButton, SearchField } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import {
  type FindState,
  type SortKey,
  type ViewMode,
  NEED_KEYS,
  TYPE_GROUPS,
} from "./find-helpers"

// ── Search bar + near-me ────────────────────────────────────────────────────

export function FindSearchBar({
  state,
  onQuery,
  onNearMe,
  locating,
}: {
  state: FindState
  onQuery: (q: string) => void
  onNearMe: () => void
  locating: boolean
}) {
  const nearActive = state.nearLat != null

  return (
    <div className="flex flex-wrap gap-3">
      <SearchField
        id="find-q"
        className="min-w-[280px] flex-3"
        label="Search by library name, city, region or country"
        placeholder="Library name, city, region or country"
        onClear={() => onQuery("")}
        inputProps={{
          value: state.q,
          onChange: (e) => onQuery(e.target.value),
          autoComplete: "off",
        }}
      />

      <button
        type="button"
        onClick={onNearMe}
        aria-pressed={nearActive}
        className="flex min-w-[190px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-[16px] font-semibold transition-colors"
        style={{
          background: nearActive ? T.ink.base : T.bg.deep,
          color: nearActive ? "#fff" : T.ink.base,
          border: `1px solid ${nearActive ? T.ink.base : T.border.hi}`,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
        {locating
          ? "Locating…"
          : nearActive
            ? "Near you · turn off"
            : "Use my location"}
      </button>
    </div>
  )
}

// ── Active filter chips ─────────────────────────────────────────────────────

export function FindFilterChips({
  state,
  onChange,
  onClearAll,
}: {
  state: FindState
  onChange: (patch: Partial<FindState>) => void
  onClearAll: () => void
}) {
  const chips: { label: string; onRemove: () => void }[] = []

  for (const key of state.groups) {
    const group = TYPE_GROUPS.find((g) => g.key === key)
    if (group) {
      chips.push({
        label: group.label,
        onRemove: () =>
          onChange({
            groups: state.groups.filter((g) => g !== key),
            page: 0,
          }),
      })
    }
  }
  for (const name of state.access) {
    chips.push({
      label: name,
      onRemove: () =>
        onChange({ access: state.access.filter((a) => a !== name), page: 0 }),
    })
  }
  for (const name of state.services) {
    chips.push({
      label: name,
      onRemove: () =>
        onChange({
          services: state.services.filter((s) => s !== name),
          page: 0,
        }),
    })
  }
  if (state.openNow) {
    chips.push({
      label: "Open now",
      onRemove: () => onChange({ openNow: false, page: 0 }),
    })
  }
  if (state.digital) {
    chips.push({
      label: "Digital collections",
      onRemove: () => onChange({ digital: false, page: 0 }),
    })
  }
  for (const need of state.needs) {
    chips.push({
      label: NEED_KEYS.find((n) => n.key === need)?.label ?? need,
      onRemove: () =>
        onChange({ needs: state.needs.filter((n) => n !== need), page: 0 }),
    })
  }
  if (state.nearLat != null) {
    chips.push({
      label: state.radiusKm > 0 ? `Within ${state.radiusKm} km` : "Near you",
      onRemove: () =>
        onChange({
          nearLat: undefined,
          nearLng: undefined,
          radiusKm: 0,
          sort: state.sort === "near" ? "complete" : state.sort,
          page: 0,
        }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="flex items-center gap-2 rounded-full py-2 pr-2 pl-3.5 text-[14px] font-semibold"
          style={{
            background: T.accent.chip,
            color: T.accent.primaryHover,
          }}
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.onRemove}
            className="flex size-5 cursor-pointer items-center justify-center rounded-full border-0 text-[13px]"
            style={{ background: "#fff", color: T.ink.dim }}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="cursor-pointer border-0 bg-transparent px-1 text-[14px] font-semibold underline"
        style={{ color: T.ink.dim, textUnderlineOffset: 3 }}
      >
        Clear all
      </button>
    </div>
  )
}

// ── Results controls: count, sort, view toggle ──────────────────────────────

const VIEWS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    key: "grid",
    label: "Grid view",
    icon: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
  },
  {
    key: "list",
    label: "List view",
    icon: <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />,
  },
  {
    key: "map",
    label: "Map view",
    icon: (
      <>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
  },
]

export function FindResultsControls({
  state,
  total,
  loading,
  onChange,
  onOpenFilters,
  activeFilterCount,
}: {
  state: FindState
  total: number
  loading: boolean
  onChange: (patch: Partial<FindState>) => void
  onOpenFilters: () => void
  activeFilterCount: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterToggleButton
        onClick={onOpenFilters}
        activeCount={activeFilterCount}
      />

      <p
        aria-live="polite"
        className="m-0 flex-1 text-[15px] font-semibold"
        style={{ color: T.ink.dim }}
      >
        {loading
          ? "Searching…"
          : `${total.toLocaleString("en-GB")} ${total === 1 ? "library" : "libraries"}`}
      </p>

      <label className="flex items-center gap-2 text-[15px] font-semibold">
        <span className="sr-only">Sort results</span>
        <select
          value={state.sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as SortKey, page: 0 })
          }
          className="cursor-pointer rounded-[10px] px-3 py-2.5 text-[15px] font-semibold"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.hi}`,
            color: T.ink.base,
          }}
        >
          <option value="complete">Most complete first</option>
          <option value="gaps">Most gaps first</option>
          <option value="name">Name A–Z</option>
          {state.nearLat != null ? <option value="near">Nearest</option> : null}
        </select>
      </label>

      <div
        role="radiogroup"
        aria-label="Results view"
        className="flex gap-1 rounded-[12px] p-1"
        style={{ background: T.bg.muted2 }}
      >
        {VIEWS.map((v) => {
          const active = state.view === v.key

          return (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={v.label}
              onClick={() => onChange({ view: v.key })}
              className="flex size-9 cursor-pointer items-center justify-center rounded-full border-0"
              style={{
                background: active ? T.ink.base : "transparent",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? "#fff" : T.ink.dim}
                strokeWidth="1.7"
                aria-hidden="true"
              >
                {v.icon}
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
