"use client"

import type { AtlasListResponse, AtlasScope } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useMemo, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { analyticsAttributes } from "@/lib/analytics-events"
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

type SortKey = "distance" | "name" | "place"
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
  onShowMap,
  onSeePlans,
  notice,
  compact = false,
  accessibility,
  remoteScope,
}: {
  readonly libraries: AtlasLibrary[]
  readonly center: { lat: number; lng: number }
  readonly now: Date
  readonly onHover: (lib: AtlasLibrary | null) => void
  readonly onShowMap: () => void
  /** Opens the plans sheet from the Pro-locked export button. */
  readonly onSeePlans: () => void
  /** Data notices (offline, load errors) shown above the table. */
  readonly notice?: React.ReactNode
  readonly compact?: boolean
  readonly accessibility?: string[]
  readonly remoteScope?: AtlasScope
}) {
  const tUi = useUiTranslations("ui")

  const [sort, setSort] = useState<SortKey>("distance")
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
    if (sort === "name") xs.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === "place")
      xs.sort(
        (a, b) =>
          (a.city ?? a.region ?? "").localeCompare(b.city ?? b.region ?? "") ||
          a.name.localeCompare(b.name)
      )
    else
      xs.sort(
        (a, b) =>
          distanceSq(a, center.lat, center.lng) -
          distanceSq(b, center.lat, center.lng)
      )

    return xs
  }, [libraries, sort, center.lat, center.lng, remoteScope])

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
  const changeSort = (key: SortKey) => {
    setSort(key)
    setPage(0)
    setCursor(undefined)
    setPrevious([])
  }

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => changeSort(key)}
      className="inline-flex items-center gap-1 font-bold"
      aria-label={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <Icon
        name="sort"
        size={13}
        color={sort === key ? T.accent.primary : undefined}
      />
    </button>
  )

  return (
    <section
      aria-label={tUi("libraries_in_view")}
      className="flex h-full min-h-0 flex-col"
    >
      <div
        className="flex flex-wrap items-center gap-3.5 border-b px-[18px] py-3.5"
        style={{ borderColor: T.border.divider }}
      >
        <div className="flex-1">
          <AtlasCount count={total} sub="libraries in view" />
        </div>
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          Sort
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as SortKey)}
            className="h-9 rounded-full border bg-white px-3 text-[14px]"
            style={{ borderColor: T.border.hi }}
          >
            <option value="distance">Nearest the centre</option>
            <option value="name">{tUi("name")}</option>
            <option value="place">Place</option>
          </select>
        </label>
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
        <ViewToggle list onChange={(list) => !list && onShowMap()} />
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
      {remoteScope && sort === "distance" && total > 1000 ? (
        <p className="px-6 text-sm">
          Showing the nearest 1,000 of {total.toLocaleString()} libraries. Sort
          by name or place to reach every record.
        </p>
      ) : null}
      {libraries.length === 0 && (!remoteScope || remote.value) ? (
        <p className="m-0 p-6 text-[16px]" style={{ color: T.ink.dim }}>
          No libraries in this part of the map match your filters. Zoom out or
          loosen a filter.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">
              Libraries in view, sorted by{" "}
              {sort === "distance" ? "distance from the map centre" : sort}
            </caption>
            <thead className="sticky top-0 z-10">
              <tr style={{ background: T.bg.surface, color: "#45435A" }}>
                <th
                  scope="col"
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
                  className="border-b px-3.5 py-3 text-left text-[13px]"
                  style={{ borderColor: T.border.hi }}
                >
                  {sortButton("place", "Place")}
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
                      className="border-b px-3.5 py-3 text-left text-[13px] font-bold"
                      style={{ borderColor: T.border.hi }}
                    >
                      Record
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
                    onMouseEnter={() => onHover(l)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(l)}
                    onBlur={() => onHover(null)}
                    className="focus-within:bg-(--t-accent-chip) hover:bg-(--t-accent-chip)"
                  >
                    <th
                      scope="row"
                      className="border-b px-3.5 py-3 text-left font-semibold"
                      style={{ borderColor: T.border.divider }}
                    >
                      {l.path ? (
                        <GlobalLink
                          href={l.path}
                          {...analyticsAttributes("select_content", {
                            interaction_source: "atlas_list",
                            content_type: "library",
                            library_document_id: l.id,
                          })}
                          className="no-underline hover:underline"
                          style={{ color: T.ink.base }}
                        >
                          {l.name}
                        </GlobalLink>
                      ) : (
                        l.name
                      )}
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
          <span className="text-[14px]" style={{ color: T.ink.dim }}>
            Showing {current * PAGE + 1}–
            {remoteScope
              ? current * PAGE + rows.length
              : Math.min(sorted.length, (current + 1) * PAGE)}{" "}
            of {total.toLocaleString()}
          </span>
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
