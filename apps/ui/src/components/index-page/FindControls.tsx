// apps/ui/src/components/index-page/FindControls.tsx
"use client"

import { useTranslations as useUiTranslations } from "next-intl"

import {
  FilterShowButton,
  type FilterSidebarState,
  FilterToggleButton,
} from "@/components/ds"
import { T } from "@/lib/design-tokens"

import {
  type FindState,
  type SortKey,
  type ViewMode,
  NEED_KEYS,
  TYPE_GROUPS,
} from "./find-helpers"

// ── Active filter chips ─────────────────────────────────────────────────────

export function FindFilterChips({
  state,
  placeName,
  onChange,
  onClearAll,
}: {
  state: FindState
  /** Display name for `state.place`, e.g. "England". */
  placeName?: string | null
  onChange: (patch: Partial<FindState>) => void
  onClearAll: () => void
}) {
  const tUi = useUiTranslations("ui")

  const chips: { label: string; onRemove: () => void }[] = []

  if (state.place) {
    chips.push({
      label: `In ${placeName ?? state.place.slug}`,
      onRemove: () => onChange({ place: null, page: 0 }),
    })
  }

  for (const type of state.rawTypes ?? [])
    chips.push({
      label: `${type} libraries`,
      onRemove: () =>
        onChange({
          rawTypes: state.rawTypes?.filter((item) => item !== type),
          page: 0,
        }),
    })
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
  if (state.includeInactive)
    chips.push({
      label: "Closed and planned included",
      onRemove: () => onChange({ includeInactive: false, page: 0 }),
    })
  if (state.staffNow)
    chips.push({
      label: "Staff on hand now",
      onRemove: () => onChange({ staffNow: false, page: 0 }),
    })
  if (state.openNow) {
    chips.push({
      label: tUi("open_now"),
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
  if (state.source) {
    chips.push({
      label: `Source: ${state.source}`,
      onRemove: () => onChange({ source: null, page: 0 }),
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
      aria-label={tUi("active_filters")}
    >
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="flex items-center gap-2 rounded-full py-2 pr-2 pl-3.5 text-sm font-semibold"
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
            className="flex size-5 cursor-pointer items-center justify-center rounded-full border-0 text-sm"
            style={{ background: "var(--t-bg-deep)", color: T.ink.dim }}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="cursor-pointer border-0 bg-transparent px-1 text-sm font-semibold underline"
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
  sidebar,
  availableViews = ["grid", "list", "map"],
}: {
  state: FindState
  total: number | null
  loading: boolean
  onChange: (patch: Partial<FindState>) => void
  onOpenFilters: () => void
  activeFilterCount: number
  sidebar: FilterSidebarState
  availableViews?: readonly ViewMode[]
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3">
      <FilterToggleButton
        onClick={onOpenFilters}
        activeCount={activeFilterCount}
      />
      <FilterShowButton sidebar={sidebar} activeCount={activeFilterCount} />

      <p
        aria-live="polite"
        className="m-0 flex-1 text-base font-semibold"
        style={{ color: T.ink.dim }}
      >
        {loading
          ? "Searching…"
          : total === null
            ? "Library results"
            : `${total.toLocaleString("en-GB")} ${total === 1 ? "library" : "libraries"}`}
      </p>

      <label className="flex items-center gap-2 text-base font-semibold">
        <span className="sr-only">Sort results</span>
        <select
          value={state.sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as SortKey, page: 0 })
          }
          className="cursor-pointer rounded-[10px] px-3 py-2.5 text-base font-semibold"
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
        aria-label={tUi("results_view")}
        className="flex gap-1 rounded-[12px] p-1"
        style={{ background: T.bg.muted2 }}
      >
        {VIEWS.filter((view) => availableViews.includes(view.key)).map((v) => {
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
                background: active ? T.bg.inverse : "transparent",
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
