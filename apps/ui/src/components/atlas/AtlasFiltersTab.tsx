"use client"

import type {
  AtlasCountsResponse,
  AtlasNetworkSelection,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useMemo, useState } from "react"

import { FilterGroup } from "@/components/ds/FilterPanel"
import { SearchField } from "@/components/ds/SearchField"
import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { SelectField } from "@/components/ds/SelectField"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { T } from "@/lib/design-tokens"

import { Chip, Icon, YearRange } from "./atlas-ui"
import {
  activeFilterCount,
  type AtlasFilters,
  type AtlasLibrary,
  countWith,
  EMPTY_FILTERS,
  facilityOptions,
  formatMinutes,
  isListed,
  OPERATOR_GROUPS,
  TYPE_GROUPS,
} from "./atlas.logic"
import { AtlasNetworkPicker } from "./AtlasNetworkPicker"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
const FACILITIES_SHOWN = 4
function featurePriority(name: string) {
  const value = name.toLowerCase().replaceAll(/[^a-z0-9]/g, "")
  if (value.includes("stepfree") || value.includes("wheelchairaccess")) return 0
  if (value.includes("accessibletoilet")) return 1
  if (value.includes("publiccomputer") || value.includes("computeraccess"))
    return 2
  if (value.includes("wifi")) return 3

  return 4
}

function toggle<V>(xs: V[], x: V): V[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]
}

export function AtlasFiltersTab({
  filters,
  networkSelection,
  onChange,
  libraries,
  matchCount,
  now,
  onShowResults,
  showResultsLabel = "Show",
  mobileEnabled = false,
  onEnableMobile,
  mobileCount = 0,
  mobileSharesLiveCount = 0,
  serverCounts,
  onFacilitySearch,
  onAccessibility,
  onMoreFacilities,
}: {
  readonly networkSelection?: AtlasNetworkSelection | null
  readonly filters: AtlasFilters
  readonly onChange: (f: AtlasFilters) => void
  readonly libraries: AtlasLibrary[]
  readonly matchCount: number
  readonly now: Date
  readonly onShowResults: () => void
  readonly showResultsLabel?: string
  readonly mobileEnabled?: boolean
  readonly onEnableMobile?: () => void
  readonly mobileCount?: number
  readonly mobileSharesLiveCount?: number
  readonly serverCounts?: AtlasCountsResponse
  readonly onAccessibility?: () => void
  readonly onFacilitySearch?: (query: string) => void
  readonly onMoreFacilities?: () => void
}) {
  const t = useUiTranslations("atlasFilters")
  const tUi = useUiTranslations("ui")
  const tNetwork = useUiTranslations("atlasNetwork")

  const featureSearchId = useId()
  const [featureQuery, setFeatureQuery] = useState("")
  const [allFacilities, setAllFacilities] = useState(false)
  const set = (patch: Partial<AtlasFilters>) =>
    onChange({ ...filters, ...patch })
  const active = activeFilterCount(filters)

  // Facet counts: how many libraries each option would give, keeping the other filters.
  const typeCounts = useMemo(
    () =>
      new Map(
        TYPE_GROUPS.map((g) => [
          g.key,
          serverCounts
            ? (serverCounts.typeGroups[g.key] ?? 0)
            : countWith(libraries, filters, { types: [g.key] }, now),
        ])
      ),
    [libraries, filters, now, serverCounts]
  )
  const operatorCounts = useMemo(
    () =>
      new Map(
        OPERATOR_GROUPS.map((g) => [
          g.key,
          serverCounts
            ? (serverCounts.operatorGroups[
                g.key as keyof AtlasCountsResponse["operatorGroups"]
              ] ?? 0)
            : countWith(libraries, filters, { operators: [g.key] }, now),
        ])
      ),
    [libraries, filters, now, serverCounts]
  )
  const facilities = useMemo(
    () =>
      serverCounts?.facilities ?? facilityOptions(libraries.filter(isListed)),
    [libraries, serverCounts]
  )
  const rankedFacilities = [...facilities].sort(
    (a, b) => featurePriority(a.name) - featurePriority(b.name)
  )
  const facilityCount = (name: string) =>
    serverCounts
      ? (serverCounts.facilities.find((option) => option.name === name)
          ?.count ?? 0)
      : countWith(
          libraries,
          filters,
          {
            facilities: filters.facilities.includes(name)
              ? filters.facilities
              : [...filters.facilities, name],
          },
          now
        )
  const years = useMemo(() => {
    if (serverCounts) return serverCounts.foundedRange
    const ys = libraries
      .map((l) => l.founded)
      .filter((y): y is number => y !== null)

    return ys.length > 0
      ? ([Math.min(...ys), new Date().getFullYear()] as [number, number])
      : null
  }, [libraries, serverCounts])

  // Show groups that exist in the data, plus any that are selected.
  const typeOptions = TYPE_GROUPS.filter(
    (g) =>
      g.key === "mobile" ||
      filters.types.includes(g.key) ||
      (serverCounts && Object.hasOwn(serverCounts.typeGroups, g.key)) ||
      libraries.some(
        (l) =>
          isListed(l) &&
          TYPE_GROUPS.find((x) => x.key === g.key)!.types.includes(l.type)
      )
  )
  const operatorOptions = OPERATOR_GROUPS.filter(
    (g) =>
      filters.operators.includes(g.key) ||
      (serverCounts && Object.hasOwn(serverCounts.operatorGroups, g.key)) ||
      libraries.some((l) => l.operator && g.values.includes(l.operator))
  )
  const facilityShown = allFacilities
    ? rankedFacilities
    : [
        ...rankedFacilities.slice(0, FACILITIES_SHOWN),
        ...rankedFacilities
          .slice(FACILITIES_SHOWN)
          .filter((f) => filters.facilities.includes(f.name)),
      ]

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col gap-2 pb-1">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h2 className="type-h2 m-0">{tUi("filters")}</h2>
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="min-h-11 text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {tUi("reset")}
          </button>
        </div>
        <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
          {active
            ? tNetwork("filtersActive", { count: active })
            : tNetwork("filterHint")}
        </p>
      </div>
      <Group legend={t("service")} activeCount={filters.networks?.length ?? 0}>
        <AtlasNetworkPicker
          compact
          value={filters.networks?.[0] ?? ""}
          selected={networkSelection ?? null}
          onChange={(id) => set({ networks: id ? [id] : [] })}
        />
        {networkSelection ? (
          <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
            {t("serviceSummary", {
              area: networkSelection.areaName,
              count: networkSelection.eligibleLibraries,
            })}
          </p>
        ) : null}
      </Group>
      <Group legend="Library type" activeCount={filters.types.length}>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((g) => {
            const on = filters.types.includes(g.key)

            return (
              <Chip
                key={g.key}
                on={on}
                onClick={() => {
                  set({ types: toggle(filters.types, g.key) })
                  if (g.key === "mobile" && !on) onEnableMobile?.()
                }}
                preserveGlyph
              >
                {g.label}
                <span className="sr-only">
                  , {typeCounts.get(g.key)} libraries
                </span>
              </Chip>
            )
          })}
        </div>
      </Group>

      <Group
        legend="Opening"
        activeCount={filters.opening === "any" ? 0 : 1}
        headerAside={
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("openingHelp")}
                className="flex size-7 items-center justify-center rounded-full border border-(--t-border-hi) text-xs text-(--t-ink-dim)"
              >
                i
              </button>
            </PopoverTrigger>
            <PopoverContent
              aria-label={t("openingHelp")}
              className="z-[90] w-[min(320px,calc(100vw-32px))] rounded-xl text-xs leading-relaxed text-(--t-ink-dim)"
            >
              {t("openingExplanation")}
            </PopoverContent>
          </Popover>
        }
      >
        <SegmentedControl
          layout="equal"
          size="sm"
          label={tUi("opening")}
          value={filters.opening}
          onChange={(opening) => set({ opening })}
          options={[
            { value: "any", label: tUi("any_time") },
            { value: "now", label: tUi("open_now") },
            { value: "staff_now", label: t("staffNow") },
            { value: "at", label: t("openAt") },
          ]}
        />
        {filters.opening === "at" ? (
          <div className="flex gap-2">
            <label
              className="flex flex-1 flex-col gap-1 text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              Day
              <SelectField
                label="Day"
                value={String(filters.atDay)}
                onValueChange={(value) => set({ atDay: Number(value) })}
                options={DAYS.map((day, index) => ({
                  value: String(index),
                  label: day,
                }))}
              />
            </label>
            <label
              className="flex w-32 flex-col gap-1 text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              Time
              <input
                type="time"
                step={900}
                value={formatMinutes(filters.atMinutes)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number)
                  if (Number.isFinite(h) && Number.isFinite(m))
                    set({ atMinutes: h! * 60 + m! })
                }}
                className="h-11 rounded-[14px] border bg-white px-3 text-base font-medium"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              />
            </label>
          </div>
        ) : null}
      </Group>

      <Group
        legend="Services & accessibility"
        activeCount={
          filters.facilities.length +
          Number(filters.events) +
          Number(filters.catalogue)
        }
      >
        {onFacilitySearch && allFacilities ? (
          <SearchField
            id={featureSearchId}
            size="sm"
            label={tUi("search_services_and_accessibility")}
            placeholder={tUi("find_a_feature")}
            inputProps={{
              value: featureQuery,
              maxLength: 80,
              onChange: (event) => {
                setFeatureQuery(event.target.value)
                onFacilitySearch(event.target.value)
                setAllFacilities(true)
              },
            }}
            onClear={() => {
              setFeatureQuery("")
              onFacilitySearch("")
            }}
          />
        ) : null}
        <div className="flex flex-col gap-0.5">
          {facilityShown.map((f) => (
            <Check
              key={f.name}
              label={f.name}
              checked={filters.facilities.includes(f.name)}
              count={facilityCount(f.name)}
              onChange={() =>
                set({ facilities: toggle(filters.facilities, f.name) })
              }
            />
          ))}
        </div>
        {facilities.length > FACILITIES_SHOWN ? (
          <button
            type="button"
            aria-expanded={allFacilities}
            onClick={() => {
              setAllFacilities((value) => !value)
              if (allFacilities && featureQuery) {
                setFeatureQuery("")
                onFacilitySearch?.("")
              }
            }}
            className="min-h-11 self-start text-sm font-semibold underline underline-offset-4"
            style={{ color: "#3730A3" }}
          >
            {allFacilities
              ? "Show fewer"
              : `Show ${facilities.length - FACILITIES_SHOWN} more`}
          </button>
        ) : null}
        {allFacilities &&
        serverCounts?.facilitiesHasMore &&
        onMoreFacilities ? (
          <button
            type="button"
            onClick={onMoreFacilities}
            className="text-sm underline"
          >
            Next features
          </button>
        ) : null}
      </Group>

      <p className="m-0 pb-4 text-xs leading-relaxed text-(--t-ink-dim)">
        {t("featureExplanation")}{" "}
        {onAccessibility ? (
          <>
            {t("featureLayerHint")}{" "}
            <button
              type="button"
              onClick={onAccessibility}
              className="min-h-8 font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              {t("accessibilityLayer")}
            </button>
            .
          </>
        ) : null}
      </p>
      <Group
        legend={t("moreFilters")}
        collapsible
        defaultOpen={Boolean(
          filters.operators.length ||
          filters.events ||
          filters.catalogue ||
          filters.founded ||
          filters.mobileFrequency?.length ||
          filters.mobileSharesLive
        )}
        activeCount={
          filters.operators.length +
          Number(filters.events) +
          Number(filters.catalogue) +
          Number(Boolean(filters.founded)) +
          (filters.mobileFrequency?.length ?? 0) +
          Number(filters.mobileSharesLive ?? false)
        }
      >
        <Check
          label={tUi("has_upcoming_events")}
          checked={filters.events}
          count={
            serverCounts?.events ??
            countWith(libraries, filters, { events: true }, now)
          }
          onChange={() => set({ events: !filters.events })}
        />
        <Check
          label={tUi("live_catalogue_link")}
          checked={filters.catalogue}
          count={
            serverCounts?.catalogue ??
            countWith(libraries, filters, { catalogue: true }, now)
          }
          onChange={() => set({ catalogue: !filters.catalogue })}
        />
        {operatorOptions.length > 0 ? (
          <Group
            collapsible
            legend="Operated by"
            activeCount={filters.operators.length}
            defaultOpen={filters.operators.length > 0}
          >
            <div className="flex flex-wrap gap-2">
              {operatorOptions.map((g) => (
                <Chip
                  key={g.key}
                  on={filters.operators.includes(g.key)}
                  onClick={() =>
                    set({ operators: toggle(filters.operators, g.key) })
                  }
                >
                  {g.label}
                  <span className="sr-only">
                    , {operatorCounts.get(g.key)} libraries
                  </span>
                </Chip>
              ))}
            </div>
          </Group>
        ) : null}

        {years ? (
          <Group
            collapsible
            legend="Founded"
            activeCount={filters.founded ? 1 : 0}
            defaultOpen={Boolean(filters.founded)}
            aside={
              filters.founded
                ? `${filters.founded[0]} – ${filters.founded[1]}`
                : "Any year"
            }
          >
            <YearRange
              min={years[0]}
              max={years[1]}
              value={filters.founded ?? years}
              onChange={(v) =>
                set({
                  founded: v[0] === years[0] && v[1] === years[1] ? null : v,
                })
              }
            />
            <div
              className="flex justify-between text-sm"
              style={{ color: T.ink.dim }}
            >
              <span>{years[0]}</span>
              <span>Today</span>
            </div>
            <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
              Only libraries with a recorded founding year are shown when this
              is set.
            </p>
          </Group>
        ) : null}

        <Group
          collapsible
          legend={tUi("mobile_library_stops")}
          activeCount={
            (filters.mobileFrequency?.length ?? 0) +
            Number(filters.mobileSharesLive ?? false)
          }
          defaultOpen={Boolean(
            filters.mobileFrequency?.length || filters.mobileSharesLive
          )}
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["weekly", "Weekly"],
                ["fortnightly", "Every 2 weeks"],
                ["monthly", "Monthly"],
              ] as const
            ).map(([frequency, label]) => (
              <Chip
                key={frequency}
                on={filters.mobileFrequency?.includes(frequency) ?? false}
                onClick={() => {
                  set({
                    mobileFrequency: toggle(
                      filters.mobileFrequency ?? [],
                      frequency
                    ),
                  })
                  onEnableMobile?.()
                }}
              >
                {label}
              </Chip>
            ))}
          </div>
          <Check
            label={tUi("shares_live_updates")}
            checked={filters.mobileSharesLive ?? false}
            count={mobileSharesLiveCount}
            onChange={() => {
              set({ mobileSharesLive: !filters.mobileSharesLive })
              onEnableMobile?.()
            }}
          />
          {!mobileEnabled ? (
            <button
              type="button"
              onClick={onEnableMobile}
              className="min-h-9 self-start font-semibold underline"
              style={{ color: T.accent.primary }}
            >
              Show mobile stops on the map
            </button>
          ) : null}
        </Group>
      </Group>

      <div className="sticky bottom-0 -mx-5 mt-auto flex items-center gap-3 border-t border-(--t-border-line) bg-white px-5 py-4">
        <p
          className="m-0 min-w-0 flex-1 text-xs leading-5 text-(--t-ink-dim)"
          aria-live="polite"
        >
          <strong className="font-semibold text-(--t-ink-base)">
            {t("libraries", { count: matchCount })}
          </strong>{" "}
          · {t("stops", { count: mobileCount })}
        </p>
        <button
          type="button"
          onClick={onShowResults}
          disabled={matchCount + mobileCount === 0}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-sm font-semibold text-white hover:bg-(--t-accent-primary-hover) disabled:opacity-50"
        >
          {showResultsLabel} results
        </button>
      </div>
    </div>
  )
}

function Group({
  legend,
  aside,
  children,
  defaultOpen = true,
  activeCount = 0,
  collapsible = false,
  headerAside,
}: {
  readonly legend: string
  readonly aside?: string
  readonly children: React.ReactNode
  readonly defaultOpen?: boolean
  readonly activeCount?: number
  readonly collapsible?: boolean
  readonly headerAside?: React.ReactNode
}) {
  if (!collapsible)
    return (
      <fieldset className="m-0 min-w-0 border-0 p-0 pt-5 pb-3">
        <legend className="float-left mb-3 flex min-h-7 w-full items-center justify-between gap-3 p-0 text-sm font-semibold">
          {legend}
          {headerAside}
        </legend>
        <div className="clear-both flex min-w-0 flex-col gap-3">{children}</div>
      </fieldset>
    )

  return (
    <FilterGroup
      title={legend}
      spacing="comfortable"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {aside ? (
          <p className="m-0 text-xs text-(--t-ink-dim)">{aside}</p>
        ) : null}
        {children}
      </div>
    </FilterGroup>
  )
}

function Check({
  label,
  checked,
  count,
  onChange,
}: {
  readonly label: string
  readonly checked: boolean
  readonly count: number
  readonly onChange: () => void
}) {
  return (
    <label className="-mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-(--t-bg-surface) has-checked:bg-(--t-bg-selected)">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--t-accent-primary)"
        style={
          checked
            ? { background: T.accent.primary, borderColor: T.accent.primary }
            : { background: "#fff", borderColor: "#8A8799" }
        }
      >
        {checked ? (
          <Icon name="check" size={14} color="#fff" stroke={2.6} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 leading-5">{label}</span>
      <span
        className="shrink-0 text-xs tabular-nums"
        style={{ color: T.ink.dim }}
      >
        {count.toLocaleString()}
      </span>
    </label>
  )
}
