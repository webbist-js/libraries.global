"use client"

import type {
  AtlasAccessMetric,
  AtlasBounds,
  AtlasLibraryAccessResponse,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useMemo, useState, type ReactNode } from "react"

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
  AreaDetails,
} from "@/components/atlas/AtlasAccessViews"
import {
  AtlasAnalysisWorkspace,
  type AnalysisTab,
} from "@/components/atlas/AtlasAnalysisWorkspace"
import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"

import { AtlasInspectSettings, AtlasInspectTools } from "./AtlasInspect"
import { AtlasLoadingSkeleton } from "./AtlasLoadingSkeleton"

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
  settings,
  opacity,
  onOpacity,
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
  readonly onSettings?: () => void
  readonly settings?: ReactNode
  readonly opacity?: number
  readonly onOpacity?: (value: number) => void
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly error?: string
  readonly onRetry: () => void
  readonly viewBounds?: AtlasBounds
  readonly tab?: AnalysisTab
  readonly onTab?: (tab: AnalysisTab) => void
}) {
  const tUi = useUiTranslations("ui")

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
      title={tUi("library_access")}
      badge="Pro"
      description={`${metric === "per100k" ? "Libraries per 100k people" : "People per library"} · ${areaKind}`}
      {...{ collapsed, onCollapse, onClose, onSettings }}
      tab={tab}
      lead={
        area && tab !== "explore" ? (
          <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4">
            <AreaDetails area={area} metric={metric} onFit={onFit} compact />
          </div>
        ) : null
      }
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "explore", label: "Explore" },
        { id: "compare", label: "Compare" },
      ]}
      onTab={changeTab}
      context={
        response ? (
          <AtlasInspectSettings
            summary={`${metric === "per100k" ? "Per 100k residents" : "Residents per library"} · ${areaKind} · ${analysisScope === "view" ? "In map view" : "All areas"}`}
          >
            {settings}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2 font-semibold">
                  Scope
                  <SelectField
                    label={tUi("analysis_scope")}
                    value={viewBounds ? analysisScope : "all"}
                    onValueChange={(value) => {
                      setAnalysisScope(value as "view" | "all")
                      setPage(0)
                    }}
                    options={[
                      {
                        value: "view",
                        label: "In map view",
                        disabled: !viewBounds,
                      },
                      { value: "all", label: "All areas" },
                    ]}
                  />
                </label>
                <span style={{ color: T.ink.dim }}>
                  {analysisAreas.length.toLocaleString()} {scopeKind}
                </span>
              </div>
              {area && tab !== "compare" ? (
                <div
                  aria-label={tUi("selected_area_context")}
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
          </AtlasInspectSettings>
        ) : undefined
      }
      footer={
        response &&
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
            {tUi("try_again")}{" "}
          </button>
        </div>
      ) : !response ? (
        <AtlasLoadingSkeleton label="Loading library access…" />
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
          <AtlasInspectTools
            shading={opacity}
            onShading={onOpacity}
            about={<AccessData {...{ response, area }} />}
            downloads={
              <button
                type="button"
                className="min-h-12 w-full rounded-xl border bg-(--t-bg-deep) px-4 py-3 text-left text-sm font-semibold hover:bg-(--t-bg-surface)"
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
            }
          />
        </>
      )}
    </AtlasAnalysisWorkspace>
  )
}
