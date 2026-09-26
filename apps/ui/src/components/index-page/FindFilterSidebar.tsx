// apps/ui/src/components/index-page/FindFilterSidebar.tsx
"use client"

import { FilterGroup, FilterOption, FilterPanelHeader } from "@/components/ds"

import {
  type FindState,
  type TypeGroupKey,
  NEED_KEYS,
  TYPE_GROUPS,
} from "./find-helpers"

export interface FindFacets {
  /** raw libraryType enum value → count */
  libraryType: Record<string, number>
  accessibility: Record<string, number>
  services: Record<string, number>
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
}: {
  state: FindState
  facets: FindFacets
  onChange: (patch: Partial<FindState>) => void
  onReset: () => void
}) {
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
      <FilterPanelHeader onReset={onReset} />

      <FilterGroup
        title="Opening status"
        icon={
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        }
        helper={
          facets.hoursKnownCount != null
            ? `${facets.hoursKnownCount} records have checked hours`
            : "Only records with checked hours"
        }
      >
        <FilterOption
          type="radio"
          name="open-status"
          label="Any time"
          checked={!state.openNow}
          onChange={() => onChange({ openNow: false, page: 0 })}
        />
        <FilterOption
          type="radio"
          name="open-status"
          label="Open now"
          checked={state.openNow}
          count={facets.openNowCount}
          onChange={() => onChange({ openNow: true, page: 0 })}
        />
      </FilterGroup>

      <FilterGroup
        title="Library type"
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
          title="Accessibility"
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
          title="Facilities & services"
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
        title="Collections"
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
          label="Has digital collections"
          checked={state.digital}
          count={facets.digitalCount}
          onChange={() => onChange({ digital: !state.digital, page: 0 })}
        />
      </FilterGroup>

      <FilterGroup
        title="Needs contributions"
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

      <FilterGroup
        title="Distance"
        dimmed={state.nearLat == null}
        icon={
          <>
            <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </>
        }
        helper={
          state.nearLat == null
            ? "Turn on “Use my location” to enable"
            : undefined
        }
      >
        {[
          { km: 0, label: "Any distance" },
          { km: 10, label: "Within 10 km" },
          { km: 50, label: "Within 50 km" },
          { km: 200, label: "Within 200 km" },
        ].map((o) => (
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
      </FilterGroup>
    </div>
  )
}
