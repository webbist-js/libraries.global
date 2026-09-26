"use client"

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
}: {
  readonly filters: AtlasFilters
  readonly onChange: (f: AtlasFilters) => void
  readonly libraries: AtlasLibrary[]
  readonly matchCount: number
  readonly now: Date
  readonly onShowResults: () => void
  readonly showResultsLabel?: string
}) {
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
          countWith(libraries, filters, { types: [g.key] }, now),
        ])
      ),
    [libraries, filters, now]
  )
  const operatorCounts = useMemo(
    () =>
      new Map(
        OPERATOR_GROUPS.map((g) => [
          g.key,
          countWith(libraries, filters, { operators: [g.key] }, now),
        ])
      ),
    [libraries, filters, now]
  )
  const facilities = useMemo(
    () => facilityOptions(libraries.filter(isListed)),
    [libraries]
  )
  const facilityCount = (name: string) =>
    countWith(
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
    const ys = libraries
      .map((l) => l.founded)
      .filter((y): y is number => y !== null)

    return ys.length > 0
      ? ([Math.min(...ys), new Date().getFullYear()] as [number, number])
      : null
  }, [libraries])

  // Show groups that exist in the data, plus any that are selected.
  const typeOptions = TYPE_GROUPS.filter(
    (g) =>
      filters.types.includes(g.key) ||
      libraries.some(
        (l) =>
          isListed(l) &&
          TYPE_GROUPS.find((x) => x.key === g.key)!.types.includes(l.type)
      )
  )
  const operatorOptions = OPERATOR_GROUPS.filter(
    (g) =>
      filters.operators.includes(g.key) ||
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
    <div className="flex min-h-full flex-col gap-[14px]">
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
                onClick={() => set({ types: toggle(filters.types, g.key) })}
              >
                {on ? null : <PinGlyph group={g.key} />}
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
          label="Opening"
          value={filters.opening}
          onChange={(opening) => set({ opening })}
          className="self-start"
          options={[
            { value: "any", label: "Any time" },
            { value: "now", label: "Open now", icon: "clock" },
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
          Libraries without recorded hours are left out when this is on.
        </p>
      </Group>

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
            label="Has upcoming events"
            checked={filters.events}
            count={countWith(libraries, filters, { events: true }, now)}
            onChange={() => set({ events: !filters.events })}
          />
          <Check
            label="Live catalogue link"
            checked={filters.catalogue}
            count={countWith(libraries, filters, { catalogue: true }, now)}
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
        className="sticky bottom-0 -mx-5 mt-auto flex items-center gap-2.5 border-t bg-white px-5 pt-3 pb-1"
        style={{ borderColor: T.border.divider }}
      >
        <p className="m-0 flex-1 text-[15px]" aria-live="polite">
          <strong
            className="text-[22px] font-medium"
            style={{ fontFamily: T.font.serif }}
          >
            {matchCount.toLocaleString()}
          </strong>{" "}
          match
        </p>
        <button
          type="button"
          onClick={onShowResults}
          disabled={matchCount === 0}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white hover:bg-(--t-accent-primary-hover) disabled:opacity-50"
        >
          {showResultsLabel} {matchCount.toLocaleString()}{" "}
          {matchCount === 1 ? "library" : "libraries"}
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
      <legend className="mb-2 flex w-full justify-between p-0 text-[14px] font-bold">
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
    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-[15px]">
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
