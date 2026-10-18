// apps/ui/src/components/index-page/FindFilterSidebar.tsx
"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import {
  FilterGroup,
  FilterHelper,
  FilterOption,
  FilterPanelHeader,
  type FilterSidebarState,
} from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { FindLocation } from "@/lib/find-search"

import {
  type FindPlace,
  type FindState,
  type TypeGroupKey,
  NEED_KEYS,
  pickPlace,
  placeChoices,
  placePath,
  TYPE_GROUPS,
} from "./find-helpers"
import { placeSelectLabels } from "./place-select-labels"

export interface FindFacets {
  /** raw libraryType enum value → count */
  libraryType: Record<string, number>
  accessibility: Record<string, number>
  services: Record<string, number>
  /** places to choose from, with counts under the other filters */
  location?: FindLocation
  /** computed client-side when bulk data is available */
  openNowCount?: number
  hoursKnownCount?: number
  digitalCount?: number
  /** need key → records missing it */
  needs?: Record<string, number>
}

export function FindFilterSidebar({
  state,
  facets,
  onChange,
  onReset,
  sidebar,
  showLocation = true,
}: {
  state: FindState
  facets: FindFacets
  onChange: (patch: Partial<FindState>) => void
  onReset: () => void
  /** Adds the desktop Hide control to the header. */
  sidebar?: FilterSidebarState
  /** Place pages keep their scope fixed while reusing the index filters. */
  showLocation?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const groupCount = (key: TypeGroupKey) => {
    const group = TYPE_GROUPS.find((g) => g.key === key)
    if (!group) return 0

    return group.types.reduce((sum, t) => sum + (facets.libraryType[t] ?? 0), 0)
  }

  const toggleGroup = (key: TypeGroupKey) => {
    onChange({
      groups: state.groups.includes(key)
        ? state.groups.filter((g) => g !== key)
        : [...state.groups, key],
      page: 0,
    })
  }

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const accessOptions = Object.entries(facets.accessibility).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  const serviceOptions = Object.entries(facets.services).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  return (
    <div>
      <FilterPanelHeader onReset={onReset} sidebar={sidebar} />
      <fieldset className="m-0 mt-4 mb-1 space-y-2 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-3">
        <legend className="sr-only">Record options</legend>
        {[
          {
            key: "staffNow" as const,
            checked: state.staffNow ?? false,
            icon: "mdi:account-check-outline",
            title: "Staff on hand now",
            detail: "Libraries with staff available now",
          },
          {
            key: "includeInactive" as const,
            checked: Boolean(state.includeInactive),
            icon: "mdi:archive-outline",
            title: "Include closed and planned",
            detail: "Permanently closed and planned libraries",
          },
        ].map((option) => (
          <label
            key={option.key}
            className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-3 transition-colors hover:bg-(--t-bg-muted) ${option.checked ? "bg-(--t-accent-chip)" : ""}`}
          >
            <Icon
              aria-hidden="true"
              icon={option.icon}
              width={19}
              className="shrink-0 text-(--t-accent-primary)"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] leading-snug font-semibold">
                {option.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-(--t-ink-dim)">
                {option.detail}
              </span>
            </span>
            <input
              type="checkbox"
              name={option.key}
              checked={option.checked}
              onChange={(event) =>
                onChange({ [option.key]: event.target.checked, page: 0 })
              }
              className="size-[18px] shrink-0 cursor-pointer accent-(--t-accent-primary)"
            />
          </label>
        ))}
      </fieldset>

      <FilterGroup
        title={tUi("opening_status")}
        icon={
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        }
        helper={
          facets.hoursKnownCount != null
            ? `${facets.hoursKnownCount} ${facets.hoursKnownCount === 1 ? "record has" : "records have"} opening hours`
            : "Only records with recorded opening hours"
        }
      >
        <FilterOption
          type="radio"
          name="open-status"
          label={tUi("any_time")}
          checked={!state.openNow}
          onChange={() => onChange({ openNow: false, page: 0 })}
        />
        <FilterOption
          type="radio"
          name="open-status"
          label={tUi("open_now")}
          checked={state.openNow}
          count={facets.openNowCount}
          onChange={() => onChange({ openNow: true, page: 0 })}
        />
      </FilterGroup>

      <FilterGroup
        title={tUi("library_type")}
        icon={
          <>
            <path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" />
            <path d="M9 7h6M9 11h6" />
          </>
        }
        helper="Broad international groupings"
      >
        {TYPE_GROUPS.map((g) => (
          <FilterOption
            key={g.key}
            type="checkbox"
            name="library-type"
            label={g.label}
            checked={state.groups.includes(g.key)}
            count={groupCount(g.key)}
            onChange={() => toggleGroup(g.key)}
          />
        ))}
      </FilterGroup>

      {accessOptions.length > 0 ? (
        <FilterGroup
          title={tUi("accessibility")}
          icon={
            <>
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v6l4 6M12 13l-4 6M5 11h14" />
            </>
          }
          helper="Documented for some records"
        >
          {accessOptions.map(([name, count]) => (
            <FilterOption
              key={name}
              type="checkbox"
              name="accessibility"
              label={name}
              checked={state.access.includes(name)}
              count={count}
              onChange={() =>
                onChange({ access: toggleIn(state.access, name), page: 0 })
              }
            />
          ))}
        </FilterGroup>
      ) : null}

      {serviceOptions.length > 0 ? (
        <FilterGroup
          title={tUi("facilities_services")}
          defaultOpen={false}
          icon={
            <>
              <path d="M5 12a7 7 0 0 1 14 0" />
              <path d="M2 12h20M12 12v7" />
            </>
          }
          helper="Documented for some records"
        >
          {serviceOptions.map(([name, count]) => (
            <FilterOption
              key={name}
              type="checkbox"
              name="services"
              label={name}
              checked={state.services.includes(name)}
              count={count}
              onChange={() =>
                onChange({ services: toggleIn(state.services, name), page: 0 })
              }
            />
          ))}
        </FilterGroup>
      ) : null}

      <FilterGroup
        title={tUi("collections")}
        defaultOpen={false}
        icon={
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 4v16M3 9h5" />
          </>
        }
        helper="Documented for some records"
      >
        <FilterOption
          type="checkbox"
          name="digital"
          label={tUi("has_digital_collections")}
          checked={state.digital}
          count={facets.digitalCount}
          onChange={() => onChange({ digital: !state.digital, page: 0 })}
        />
      </FilterGroup>

      <FilterGroup
        title={tUi("needs_contributions")}
        defaultOpen={false}
        icon={
          <>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </>
        }
        helper="Records with gaps you can help fill"
      >
        {NEED_KEYS.map((n) => (
          <FilterOption
            key={n.key}
            type="checkbox"
            name="needs"
            label={n.label}
            checked={state.needs.includes(n.key)}
            count={facets.needs?.[n.key]}
            onChange={() =>
              onChange({
                needs: state.needs.includes(n.key)
                  ? state.needs.filter((k) => k !== n.key)
                  : [...state.needs, n.key],
                page: 0,
              })
            }
          />
        ))}
      </FilterGroup>

      {showLocation ? (
        <FilterGroup
          title={tUi("location")}
          defaultOpen={false}
          activeCount={
            (state.place ? 1 : 0) +
            (state.nearLat != null && state.radiusKm > 0 ? 1 : 0)
          }
          icon={
            <>
              <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </>
          }
        >
          <PlaceSelects
            place={state.place}
            location={facets.location}
            onChange={(place) => onChange({ place, page: 0 })}
          />
          <fieldset
            disabled={state.nearLat == null}
            className="m-0 mt-3 min-w-0 border-0 p-0"
          >
            <legend
              className="p-0 text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Distance
            </legend>
            <div
              className="mt-1 flex flex-col"
              style={{ opacity: state.nearLat == null ? 0.55 : 1 }}
            >
              {DISTANCES.map((o) => (
                <FilterOption
                  key={o.km}
                  type="radio"
                  name="distance"
                  label={o.label}
                  disabled={state.nearLat == null}
                  checked={state.radiusKm === o.km}
                  onChange={() => onChange({ radiusKm: o.km, page: 0 })}
                />
              ))}
            </div>
            {state.nearLat == null ? (
              <FilterHelper>Turn on “Use my location” to enable</FilterHelper>
            ) : null}
          </fieldset>
          <label className="mt-3 flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={state.nearIncludeMobile !== false}
              disabled={state.nearLat == null}
              onChange={(e) =>
                onChange({ nearIncludeMobile: e.target.checked })
              }
            />
            Include mobile library stops
          </label>
        </FilterGroup>
      ) : null}
    </div>
  )
}

const DISTANCES = [
  { km: 0, label: "Any distance" },
  { km: 10, label: "Within 10 km" },
  { km: 50, label: "Within 50 km" },
  { km: 200, label: "Within 200 km" },
]

/**
 * Continent, then country, then region: each select appears once the one
 * above it has a value, and lists the places there with matching libraries.
 */
function PlaceSelects({
  place,
  location,
  onChange,
}: {
  place: FindPlace | null
  location?: FindLocation
  onChange: (place: FindPlace | null) => void
}) {
  const path = placePath(place, location)
  const selects = placeSelectLabels(location)

  return (
    <div className="flex flex-col gap-3">
      {selects.map(({ level, label, all }, i) => {
        const parent = selects[i - 1]?.level
        if (parent && path[parent] === "") return null

        return (
          <label
            key={level}
            className="flex flex-col gap-1.5 text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {label}
            <select
              value={path[level]}
              onChange={(e) => onChange(pickPlace(path, level, e.target.value))}
              className="min-h-11 w-full cursor-pointer rounded-[14px] px-3 text-[15px] font-normal"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.hi}`,
                color: T.ink.base,
              }}
            >
              <option value="">{all}</option>
              {placeChoices(level, path, location).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.count == null
                    ? c.name
                    : `${c.name} (${c.count.toLocaleString("en-GB")})`}
                </option>
              ))}
            </select>
          </label>
        )
      })}
    </div>
  )
}
