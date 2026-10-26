"use client"

import {
  ATLAS_LIST_SORTS,
  type AtlasSort,
  type AtlasListResponse,
  type AtlasScope,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"

import { atlasListLibrary } from "./atlas-data-adapter"
import { Icon, TypeBadge } from "./atlas-ui"
import {
  type AtlasLibrary,
  distanceSq,
  hasAccessibility,
  openNow,
  todayHoursLabel,
  typeGroupOf,
} from "./atlas.logic"
import { AccessibilitySwatch } from "./AtlasAccessibility"
import { AtlasCount, ViewToggle } from "./AtlasBottomBar"
import { AtlasExportButton } from "./AtlasExportButton"
import { useAtlasRequest } from "./useAtlasData"

type SortKey = "name" | "place" | "record"
const PAGE = 20

/**
 * The accessible alternative to the map: libraries in view, with the current
 * filters. Hovering or focusing a row highlights its pin.
 */
export function AtlasListView({
  libraries: localLibraries,
  center,
  now,
  onHover,
  onSelect,
  selectedId,
  onShowMap,
  onSeePlans,
  notice,
  compact = false,
  accessibility,
  remoteScope,
  sort: controlledSort,
  onSortChange,
  onShowAnalysis,
}: {
  readonly libraries: AtlasLibrary[]
  readonly center: { lat: number; lng: number }
  readonly now: Date
  readonly onHover: (lib: AtlasLibrary | null) => void
  readonly onSelect: (
    library: AtlasLibrary,
    trigger: HTMLButtonElement | null
  ) => void
  readonly selectedId?: string | null
  readonly onShowMap: () => void
  /** Opens the plans sheet from the Pro-locked export button. */
  readonly onSeePlans: () => void
  /** Data notices (offline, load errors) shown above the table. */
  readonly notice?: React.ReactNode
  readonly compact?: boolean
  readonly accessibility?: string[]
  readonly remoteScope?: AtlasScope
  readonly sort?: AtlasSort
  readonly onSortChange?: (sort: AtlasSort) => void
  readonly onShowAnalysis?: () => void
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("atlasList")

  const [localSort, setLocalSort] = useState<AtlasSort>("name")
  const sort = controlledSort ?? localSort
  const descending = sort.endsWith("_desc")
  const sortColumn = sort.replace("_desc", "")
  const [page, setPage] = useState(0)
  const [cursor, setCursor] = useState<string | undefined>(),
    [previous, setPrevious] = useState<(string | undefined)[]>([])
  const [refresh, setRefresh] = useState(0)
  const remote = useAtlasRequest<AtlasListResponse>(
    remoteScope
      ? {
          schemaVersion: 1,
          purpose: "list",
          scope: remoteScope,
          centre: center,
          sort,
          ...(sort === "distance" ? { page } : { cursor }),
        }
      : null,
    refresh
  )
  const libraries = remoteScope
    ? (remote.value?.rows ?? []).map(atlasListLibrary)
    : localLibraries
  const total = remoteScope ? (remote.value?.exactTotal ?? 0) : libraries.length

  const sorted = useMemo(() => {
    if (remoteScope) return libraries
    const xs = [...libraries]
    const sign = descending ? -1 : 1
    switch (sortColumn) {
      case "name":
        xs.sort(
          (a, b) =>
            sign * a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
        )
        break

      case "place":
        xs.sort(
          (a, b) =>
            sign *
              ((a.city ?? a.region ?? "").localeCompare(
                b.city ?? b.region ?? ""
              ) || a.name.localeCompare(b.name)) || a.id.localeCompare(b.id)
        )
        break

      case "record":
        xs.sort(
          (a, b) =>
            Number(a.completenessKnown === false) -
              Number(b.completenessKnown === false) ||
            sign * (a.complete - b.complete) ||
            a.id.localeCompare(b.id)
        )
        break

      default:
        xs.sort(
          (a, b) =>
            distanceSq(a, center.lat, center.lng) -
            distanceSq(b, center.lat, center.lng)
        )
    }

    return xs
  }, [libraries, sortColumn, descending, center.lat, center.lng, remoteScope])

  const pages = Math.max(
    1,
    Math.ceil(
      (remoteScope ? (remote.value?.reachableTotal ?? 0) : sorted.length) / PAGE
    )
  )
  // Panning the map changes the list; clamp rather than reset in an effect.
  const current = remoteScope ? page : Math.min(page, pages - 1)
  const rows = remoteScope
    ? sorted
    : sorted.slice(current * PAGE, current * PAGE + PAGE)
  const changeSort = (key: AtlasSort) => {
    setLocalSort(key)
    onSortChange?.(key)
    setPage(0)
    setCursor(undefined)
    setPrevious([])
  }

  const sortButton = (
    key: SortKey,
    label: string,
    accessibleLabel = label.toLowerCase()
  ) => (
    <button
      type="button"
      onClick={() =>
        changeSort(
          sortColumn === key
            ? descending
              ? key
              : `${key}_desc`
            : key === "record"
              ? "record_desc"
              : key
        )
      }
      className="inline-flex min-h-11 items-center gap-1.5 font-bold"
      aria-label={t("sortBy", { column: accessibleLabel })}
    >
      {label}
      <Icon
        name={
          sortColumn === key ? (descending ? "sortDown" : "sortUp") : "sort"
        }
        size={13}
        color={sortColumn === key ? T.accent.primary : undefined}
      />
    </button>
  )

  return (
    <section
      aria-label={tUi("libraries_in_view")}
      className="flex h-full min-h-0 flex-col"
    >
      <div
        className={`${compact ? "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2" : "flex flex-wrap gap-3.5"} items-center border-b px-[18px] py-3.5`}
        style={{ borderColor: T.border.divider }}
      >
        <div className={compact ? "col-span-2" : "flex-1"}>
          <AtlasCount
            count={total}
            sub={t("inView")}
            loading={Boolean(remoteScope && !remote.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <span className={compact ? "sr-only" : undefined}>{t("sort")}</span>
          <SelectField
            label={t("sort")}
            value={sort}
            onValueChange={(value) => changeSort(value as AtlasSort)}
            options={ATLAS_LIST_SORTS.map((value) => ({
              value,
              label: t(value),
            }))}
            className="min-w-[155px]"
          />
        </div>
        {onShowAnalysis && !compact ? (
          <button
            type="button"
            onClick={onShowAnalysis}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-(--t-accent-primary)"
          >
            <Icon name="map" size={15} />
            {t("inspectMap")}
          </button>
        ) : null}
        <AtlasExportButton
          libraries={sorted}
          onSeePlans={onSeePlans}
          total={total}
          request={
            remoteScope
              ? { schemaVersion: 1, scope: remoteScope, sort, centre: center }
              : undefined
          }
        />
        {!compact ? (
          <ViewToggle list onChange={(list) => !list && onShowMap()} />
        ) : null}
      </div>

      {notice ? (
        <div
          className="flex flex-col gap-2 border-b px-[18px] py-3"
          style={{ borderColor: T.border.divider }}
        >
          {notice}
        </div>
      ) : null}

      {remoteScope && !remote.value ? (
        <p role="status" className="p-6">
          {remote.error ?? "Loading libraries…"}
          {remote.error ? (
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => {
                setPage(0)
                setCursor(undefined)
                setPrevious([])
                setRefresh((value) => value + 1)
              }}
            >
              Reload list
            </button>
          ) : null}
        </p>
      ) : null}
      {remoteScope && !remote.value ? null : libraries.length === 0 ? (
        <p className="m-0 p-6 text-[16px]" style={{ color: T.ink.dim }}>
          No libraries in this part of the map match your filters. Zoom out or
          loosen a filter.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">
              {t("caption", { order: t(sort) })}
            </caption>
            <thead className="sticky top-0 z-10">
              <tr style={{ background: T.bg.surface, color: "#45435A" }}>
                <th
                  scope="col"
                  aria-sort={
                    sortColumn === "name"
                      ? descending
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className="border-b px-3.5 py-3 text-left text-[13px] whitespace-nowrap"
                  style={{ borderColor: T.border.hi }}
                >
                  {sortButton("name", tUi("name"))}
                </th>
                {!compact ? (
                  <th
                    scope="col"
                    className="border-b px-3.5 py-3 text-left text-[13px] font-bold"
                    style={{ borderColor: T.border.hi }}
                  >
                    {tUi("type")}
                  </th>
                ) : null}
                <th
                  scope="col"
                  aria-sort={
                    sortColumn === "place"
                      ? descending
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className="border-b px-3.5 py-3 text-left text-[13px]"
                  style={{ borderColor: T.border.hi }}
                >
                  {sortButton("place", t("placeColumn"))}
                </th>
                {accessibility ? (
                  <th
                    scope="col"
                    className="border-b px-3.5 py-3 text-left text-[13px] font-bold"
                    style={{ borderColor: T.border.hi }}
                  >
                    {tUi("accessibility")}{" "}
                  </th>
                ) : null}
                <th
                  scope="col"
                  className="border-b px-3.5 py-3 text-left text-[13px] font-bold"
                  style={{ borderColor: T.border.hi }}
                >
                  Now
                </th>
                {!compact ? (
                  <>
                    <th
                      scope="col"
                      className="border-b px-3.5 py-3 text-left text-[13px] font-bold"
                      style={{ borderColor: T.border.hi }}
                    >
                      Today
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortColumn === "record"
                          ? descending
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                      className="border-b px-3.5 py-3 text-left text-[13px] font-bold"
                      style={{ borderColor: T.border.hi }}
                    >
                      {sortButton(
                        "record",
                        t("recordColumn"),
                        t("recordCompleteness")
                      )}
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const state = openNow(l, now)

                return (
                  <tr
                    key={l.id}
                    data-selected={selectedId === l.id}
                    onClick={(event) => {
                      if (
                        event.target instanceof Element &&
                        event.target.closest("button, a")
                      )
                        return
                      onSelect(
                        l,
                        event.currentTarget.querySelector<HTMLButtonElement>(
                          "[data-atlas-list-library]"
                        )
                      )
                    }}
                    onMouseEnter={() => onHover(l)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(l)}
                    onBlur={() => onHover(null)}
                    className="cursor-pointer focus-within:bg-(--t-accent-chip) hover:bg-(--t-accent-chip) data-[selected=true]:bg-(--t-accent-chip)"
                  >
                    <th
                      scope="row"
                      className="border-b px-3.5 py-3 text-left font-semibold"
                      style={{ borderColor: T.border.divider }}
                    >
                      <button
                        type="button"
                        data-atlas-list-library
                        title={t("inspectLibrary", { name: l.name })}
                        aria-expanded={selectedId === l.id}
                        aria-controls={
                          selectedId === l.id
                            ? "atlas-analysis-panel"
                            : undefined
                        }
                        onClick={(event) => onSelect(l, event.currentTarget)}
                        className="min-h-[36px] w-full text-left font-semibold hover:underline"
                        style={{ color: T.ink.base }}
                      >
                        {l.name}
                      </button>
                      {compact ? (
                        <span className="mt-1 block text-xs font-normal text-(--t-ink-dim)">
                          {l.completenessKnown === false
                            ? t("recordUnknown")
                            : t("recordValue", { value: l.complete })}
                        </span>
                      ) : null}
                    </th>
                    {!compact ? (
                      <td
                        className="border-b px-3.5 py-3"
                        style={{ borderColor: T.border.divider }}
                      >
                        <TypeBadge group={typeGroupOf(l.type)} />
                      </td>
                    ) : null}
                    <td
                      className="border-b px-3.5 py-3"
                      style={{ borderColor: T.border.divider }}
                    >
                      {l.city ?? l.region ?? "—"}
                      {l.country && l.country !== (l.city ?? l.region) ? (
                        <span className="mt-1 block text-xs text-(--t-ink-dim)">
                          {l.country}
                        </span>
                      ) : null}
                    </td>
                    {accessibility ? (
                      <td
                        className="border-b px-3.5 py-3"
                        style={{ borderColor: T.border.divider }}
                      >
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <AccessibilitySwatch
                            confirmed={hasAccessibility(l, accessibility)}
                          />
                          {hasAccessibility(l, accessibility)
                            ? "Confirmed"
                            : "Not confirmed"}
                        </span>
                      </td>
                    ) : null}
                    <td
                      className="border-b px-3.5 py-3"
                      style={{ borderColor: T.border.divider }}
                    >
                      <OpenState state={state} />
                    </td>
                    {!compact ? (
                      <>
                        <td
                          className="border-b px-3.5 py-3"
                          style={{
                            borderColor: T.border.divider,
                            color: l.hours ? T.ink.base : T.ink.dim,
                          }}
                        >
                          {todayHoursLabel(l, now)}
                        </td>
                        <td
                          className="w-[120px] border-b px-3.5 py-3"
                          style={{ borderColor: T.border.divider }}
                        >
                          {l.completenessKnown === false ? (
                            <span className="text-xs text-(--t-ink-dim)">
                              {t("recordUnknown")}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="relative h-2 flex-1 rounded-full"
                                style={{ background: T.border.divider }}
                              >
                                <b
                                  className="absolute inset-y-0 left-0 rounded-full"
                                  style={{
                                    width: `${l.complete}%`,
                                    background:
                                      l.complete < 50 ? "#8A3F22" : "#2F5D3A",
                                  }}
                                />
                              </span>
                              <span className="w-8 text-[13px]">
                                {l.complete}%
                              </span>
                            </span>
                          )}
                        </td>
                      </>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div
          className="flex items-center justify-between border-t px-[18px] py-3"
          style={{ borderColor: T.border.divider }}
        >
          <div className="text-sm text-(--t-ink-dim)">
            <p className="m-0">
              {t("range", {
                from: current * PAGE + 1,
                to: current * PAGE + rows.length,
                total: remoteScope
                  ? (remote.value?.reachableTotal ?? total)
                  : total,
              })}
            </p>
            {remoteScope &&
            sort === "distance" &&
            total > (remote.value?.reachableTotal ?? total) ? (
              <p className="m-0 mt-1 text-xs">
                {t("nearestLimit", {
                  limit: remote.value!.reachableTotal,
                  total,
                })}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <PagerButton
              disabled={
                current === 0 ||
                (remoteScope && sort !== "distance" && previous.length === 0) ||
                Boolean(remoteScope && !remote.value)
              }
              onClick={() => {
                setPage(current - 1)
                if (remoteScope && sort !== "distance") {
                  setCursor(previous.at(-1))
                  setPrevious(previous.slice(0, -1))
                }
              }}
            >
              {tUi("previous")}{" "}
            </PagerButton>
            <PagerButton
              disabled={
                remoteScope ? !remote.value?.hasMore : current >= pages - 1
              }
              onClick={() => {
                setPage(current + 1)
                if (remoteScope && sort !== "distance") {
                  setPrevious([...previous.slice(-99), cursor])
                  setCursor(remote.value?.nextCursor)
                }
              }}
            >
              {tUi("next")}{" "}
            </PagerButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function OpenState({
  state,
}: {
  readonly state: "open" | "closed" | "unknown"
}) {
  const tUi = useUiTranslations("ui")

  if (state === "open")
    return (
      <span
        className="inline-flex items-center gap-1.5 font-semibold"
        style={{ color: T.accent.ok }}
      >
        <Icon name="check" size={16} stroke={2.4} />
        {tUi("open")}
      </span>
    )
  if (state === "closed")
    return (
      <span
        className="inline-flex items-center gap-1.5 font-semibold"
        style={{ color: T.accent.danger }}
      >
        <Icon name="x" size={16} stroke={2.4} />
        {tUi("closed")}
      </span>
    )

  return (
    <span
      className="inline-flex items-center gap-1.5 font-semibold"
      style={{ color: T.ink.dim }}
    >
      <Icon name="info" size={16} />
      {tUi("unknown")}{" "}
    </span>
  )
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  readonly disabled: boolean
  readonly onClick: () => void
  readonly children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-full border bg-white px-3.5 text-[14px] font-semibold disabled:opacity-40"
      style={{ borderColor: T.border.hi }}
    >
      {children}
    </button>
  )
}
