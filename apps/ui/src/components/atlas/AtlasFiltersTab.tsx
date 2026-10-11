"use client"

import type { AtlasCountsResponse } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { T } from "@/lib/design-tokens"

import {
  Chip,
  Icon,
  PinGlyph,
  Segmented,
  tintOfGroup,
  YearRange,
} from "./atlas-ui"
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
  type TypeGroupKey,
} from "./atlas.logic"

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

function toggle<V>(xs: V[], x: V): V[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]
}

export function AtlasFiltersTab({
  filters,
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
  onMoreFacilities,
}: {
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
  readonly onFacilitySearch?: (query: string) => void
  readonly onMoreFacilities?: () => void
}) {
  const tUi = useUiTranslations("ui")

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
    ? facilities
    : [
        ...facilities.slice(0, FACILITIES_SHOWN),
        ...facilities
          .slice(FACILITIES_SHOWN)
          .filter((f) => filters.facilities.includes(f.name)),
      ]

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="m-0 text-[15px] font-bold">
          {active === 0
            ? "No filters"
            : `${active} ${active === 1 ? "filter" : "filters"} active`}
        </p>
        {active > 0 ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: "#3730A3" }}
          >
            Clear all
          </button>
        ) : null}
      </div>

      <Group legend="Library type">
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((g) => {
            const on = filters.types.includes(g.key)

            return (
              <Chip
                key={g.key}
                on={on}
                tint={tintOfGroup(g.key as TypeGroupKey)}
                onClick={() => {
                  set({ types: toggle(filters.types, g.key) })
                  if (g.key === "mobile" && !on) onEnableMobile?.()
                }}
                preserveGlyph
              >
                <PinGlyph group={g.key} size={12} />
                {g.label}
                <span className="sr-only">
                  , {typeCounts.get(g.key)} libraries
                </span>
              </Chip>
            )
          })}
        </div>
      </Group>

      <Group legend="Opening">
        <Segmented
          label={tUi("opening")}
          value={filters.opening}
          onChange={(opening) => set({ opening })}
          className="w-full rounded-[16px] [&>button]:min-h-11 [&>button]:px-2"
          options={[
            { value: "any", label: tUi("any_time") },
            { value: "now", label: tUi("open_now"), icon: "clock" },
            { value: "staff_now", label: "Staff on hand now", icon: "clock" },
            { value: "at", label: "Open at…" },
          ]}
        />
        {filters.opening === "at" ? (
          <div className="flex gap-2">
            <label
              className="flex flex-1 flex-col gap-1 text-[13px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Day
              <select
                value={filters.atDay}
                onChange={(e) => set({ atDay: Number(e.target.value) })}
                className="h-11 rounded-[14px] border bg-white px-3 text-[15px] font-medium"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="flex w-32 flex-col gap-1 text-[13px] font-semibold"
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
                className="h-11 rounded-[14px] border bg-white px-3 text-[15px] font-medium"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              />
            </label>
          </div>
        ) : null}
        <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
          Libraries without recorded hours are left out. For mobile libraries,
          open means a vehicle is at the stop, from live updates or its
          timetable.
        </p>
      </Group>

      <fieldset
        className="m-0 flex min-w-0 flex-col gap-3 rounded-[18px] border px-3.5 pt-2 pb-4"
        style={{ background: T.bg.surface, borderColor: T.border.line }}
      >
        <legend className="flex items-center gap-2 px-2 text-[15px] font-bold">
          <Icon name="bus" size={18} color={T.map.stopRing} />
          {tUi("mobile_library_stops")}
        </legend>
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
        <label
          className="flex min-h-11 items-center gap-2.5 text-[15px]"
          style={{ color: T.ink.dim }}
        >
          <input type="checkbox" disabled className="size-5" />
          Step-free stop
          <span className="ml-auto text-[12px]">Not recorded yet</span>
        </label>
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
      </fieldset>

      {operatorOptions.length > 0 ? (
        <Group legend="Operated by">
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

      <Group legend="Services & accessibility">
        {onFacilitySearch ? (
          <input
            type="search"
            aria-label={tUi("search_services_and_accessibility")}
            placeholder={tUi("find_a_feature")}
            maxLength={80}
            onChange={(event) => {
              onFacilitySearch(event.target.value)
              setAllFacilities(true)
            }}
            className="h-10 rounded-xl border px-3"
          />
        ) : null}
        <div className="flex flex-col">
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
        </div>
        {facilities.length > FACILITIES_SHOWN ? (
          <button
            type="button"
            aria-expanded={allFacilities}
            onClick={() => setAllFacilities((v) => !v)}
            className="self-start text-[14px] font-semibold underline underline-offset-[3px]"
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

      {years ? (
        <Group
          legend="Founded"
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
            className="flex justify-between text-[14px]"
            style={{ color: T.ink.dim }}
          >
            <span>{years[0]}</span>
            <span>Today</span>
          </div>
          <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
            Only libraries with a recorded founding year are shown when this is
            set.
          </p>
        </Group>
      ) : null}

      <div
        className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-2.5 border-t bg-white px-4 pt-3 pb-1 md:-mx-5 md:px-5"
        style={{ borderColor: T.border.divider }}
      >
        <p className="m-0 flex-1 text-[15px]" aria-live="polite">
          <strong
            className="text-[22px] font-medium"
            style={{ fontFamily: T.font.serif }}
          >
            {(matchCount + mobileCount).toLocaleString()}
          </strong>{" "}
          matches
          {mobileCount ? ` · ${mobileCount.toLocaleString()} mobile stops` : ""}
        </p>
        <button
          type="button"
          onClick={onShowResults}
          disabled={matchCount + mobileCount === 0}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white hover:bg-(--t-accent-primary-hover) disabled:opacity-50"
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
}: {
  readonly legend: string
  readonly aside?: string
  readonly children: React.ReactNode
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 flex w-full justify-between p-0 text-[15px] font-bold">
        {legend}
        {aside ? <span className="font-semibold">{aside}</span> : null}
      </legend>
      {children}
    </fieldset>
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
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
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
      <span className="flex-1">{label}</span>
      <span className="text-[13px]" style={{ color: T.ink.dim }}>
        {count.toLocaleString()}
      </span>
    </label>
  )
}
