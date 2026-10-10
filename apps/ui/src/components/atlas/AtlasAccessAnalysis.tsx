"use client"

import type {
  AtlasAccessMetric,
  AtlasBounds,
  AtlasLibraryAccessResponse,
} from "@repo/shared-data"
import { useMemo, useState } from "react"

import {
  accessAreaInView,
  accessValue,
  ACCESS_COMPARE_PAGE_SIZE,
  ACCESS_COMPARE_PREVIEW_SIZE,
  libraryAccessCsv,
  sortAccessAreas,
  type AreaSort,
  type ProvisionDirection,
} from "@/components/atlas/atlas-access-analysis"
import {
  AccessCompare,
  AccessCompareFooter,
} from "@/components/atlas/AtlasAccessCompare"
import {
  AccessOverview,
  AccessExplore,
  AccessData,
} from "@/components/atlas/AtlasAccessViews"
import {
  AtlasAnalysisWorkspace,
  type AnalysisTab,
} from "@/components/atlas/AtlasAnalysisWorkspace"
import { T } from "@/lib/design-tokens"

export {
  accessAreaInView,
  accessValue,
  libraryAccessCsv,
  sortAccessAreas,
} from "@/components/atlas/atlas-access-analysis"

export function AtlasAccessAnalysis({
  response,
  metric,
  selected,
  onSelect,
  onFit,
  onClose,
  onSettings,
  collapsed,
  onCollapse,
  error,
  onRetry,
  viewBounds,
  tab: controlledTab,
  onTab,
}: {
  readonly response?: AtlasLibraryAccessResponse
  readonly metric: AtlasAccessMetric
  readonly selected: string | null
  readonly onSelect: (id: string) => void
  readonly onFit: (id: string) => void
  readonly onClose: () => void
  readonly onSettings: () => void
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly error?: string
  readonly onRetry: () => void
  readonly viewBounds?: AtlasBounds
  readonly tab?: AnalysisTab
  readonly onTab?: (tab: AnalysisTab) => void
}) {
  const [localTab, setLocalTab] = useState<AnalysisTab>("overview"),
    [showAllAreas, setShowAllAreas] = useState(false),
    [query, setQuery] = useState(""),
    [areaQuery, setAreaQuery] = useState(""),
    [sort, setSort] = useState<AreaSort>("rate"),
    [direction, setDirection] = useState<ProvisionDirection>("provisionLow"),
    [page, setPage] = useState(0),
    [analysisScope, setAnalysisScope] = useState<"view" | "all">("view")
  const tab = controlledTab ?? localTab,
    changeTab = onTab ?? setLocalTab
  const area = response?.areas.find((item) => item.id === selected)
  const analysisAreas = useMemo(() => {
    const areas = response?.areas ?? []

    return analysisScope === "view" && viewBounds
      ? areas.filter((item) => accessAreaInView(item, viewBounds))
      : areas
  }, [response, analysisScope, viewBounds])
  const ranked = useMemo(
    () =>
      sortAccessAreas(
        analysisAreas.filter(
          (item) =>
            item.status === "available" &&
            item.indexedCount >= 5 &&
            (item.population ?? 0) >= 20000
        ),
        metric,
        "rate",
        metric === "per100k" ? "asc" : "desc"
      ),
    [analysisAreas, metric]
  )
  const resolvedDirection =
    direction === "provisionLow"
      ? metric === "per100k"
        ? "asc"
        : "desc"
      : direction === "provisionHigh"
        ? metric === "per100k"
          ? "desc"
          : "asc"
        : direction
  const rows = useMemo(
    () =>
      sortAccessAreas(
        analysisAreas.filter((item) =>
          item.name.toLowerCase().includes(query.trim().toLowerCase())
        ),
        metric,
        sort,
        resolvedDirection
      ),
    [analysisAreas, query, metric, sort, resolvedDirection]
  )
  const exploreAreas = useMemo(
    () =>
      [...analysisAreas]
        .filter((item) =>
          item.name.toLowerCase().includes(areaQuery.trim().toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [analysisAreas, areaQuery]
  )
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / ACCESS_COMPARE_PAGE_SIZE) - 1)
  )
  const areaKind = response?.level === "local" ? "local areas" : "countries"
  const scopeKind =
    analysisAreas.length === 1
      ? response?.level === "local"
        ? "local area"
        : "country"
      : areaKind
  const scopeDescription = `${analysisAreas.length.toLocaleString()} ${scopeKind}${analysisScope === "view" && viewBounds ? " intersecting the map view" : " in the comparison"}. Each rate covers its whole area.`

  return (
    <AtlasAnalysisWorkspace
      title="Library access"
      badge="Pro"
      description={`${metric === "per100k" ? "Libraries per 100k people" : "People per library"} · ${areaKind}`}
      {...{ collapsed, onCollapse, onClose, onSettings }}
      tab={tab}
      onTab={changeTab}
      context={
        response ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-[14px]">
              <label className="flex items-center gap-2 font-semibold">
                Scope
                <select
                  aria-label="Analysis scope"
                  value={viewBounds ? analysisScope : "all"}
                  onChange={(event) => {
                    setAnalysisScope(event.target.value as "view" | "all")
                    setPage(0)
                  }}
                  className="min-h-[44px] max-w-[165px] rounded-xl border bg-white px-2 text-[14px] font-normal"
                  style={{ borderColor: T.border.hi }}
                >
                  <option value="view" disabled={!viewBounds}>
                    In map view
                  </option>
                  <option value="all">All areas</option>
                </select>
              </label>
              <span style={{ color: T.ink.dim }}>
                {analysisAreas.length.toLocaleString()} {scopeKind}
              </span>
            </div>
            {area && tab !== "compare" ? (
              <div
                aria-label="Selected area context"
                className="flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => changeTab("explore")}
                  className="min-h-9 min-w-0 text-left font-semibold underline"
                  style={{ color: T.accent.primary }}
                >
                  {area.name}
                </button>
                <span className="shrink-0 font-semibold">
                  {accessValue(area, metric)}
                </span>
              </div>
            ) : null}
          </div>
        ) : undefined
      }
      footer={
        response && tab === "data" ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-full border bg-white px-3 text-sm font-semibold"
            style={{ color: T.ink.base, borderColor: T.border.hi }}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(
                  [
                    "\uFEFF",
                    libraryAccessCsv(
                      { ...response, areas: analysisAreas },
                      { kind: analysisScope, bounds: viewBounds }
                    ),
                  ],
                  {
                    type: "text/csv;charset=utf-8",
                  }
                )
              )
              const link = document.createElement("a")
              link.href = url
              link.download = `library-access-${response.level}-${response.baseline.year}.csv`
              document.body.append(link)
              link.click()
              link.remove()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            Download area comparison CSV
          </button>
        ) : response &&
          tab === "compare" &&
          rows.length > ACCESS_COMPARE_PREVIEW_SIZE ? (
          <AccessCompareFooter
            total={rows.length}
            {...{ showAllAreas, setShowAllAreas, currentPage, setPage }}
          />
        ) : undefined
      }
    >
      {error ? (
        <div role="alert" className="text-sm">
          The library access comparison couldn’t load.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : !response ? (
        <p role="status" className="m-0">
          Loading library access…
        </p>
      ) : (
        <>
          {tab === "overview" ? (
            <AccessOverview
              {...{
                area,
                metric,
                scopeDescription,
                analysisAreas,
                ranked,
                onFit,
              }}
              onSelect={(id) => {
                onSelect(id)
                changeTab("explore")
              }}
              onCompare={() => {
                setShowAllAreas(true)
                setQuery("")
                setPage(0)
                changeTab("compare")
              }}
            />
          ) : null}
          {tab === "explore" ? (
            <AccessExplore
              {...{
                area,
                metric,
                areaQuery,
                setAreaQuery,
                exploreAreas,
                onSelect,
                onFit,
              }}
            />
          ) : null}
          {tab === "compare" ? (
            <AccessCompare
              {...{
                metric,
                scopeDescription,
                showAllAreas,
                query,
                setQuery,
                sort,
                setSort,
                resolvedDirection,
                setDirection,
                setPage,
                areaKind,
                rows,
                currentPage,
              }}
              selected={selected}
              onSelect={(id) => {
                onSelect(id)
                changeTab("explore")
              }}
            />
          ) : null}
          {tab === "data" ? <AccessData {...{ response, area }} /> : null}
        </>
      )}
    </AtlasAnalysisWorkspace>
  )
}
