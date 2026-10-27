"use client"

import {
  ATLAS_REACH_MINUTES,
  parseAtlasReachResult,
  type AtlasReachMode,
  type AtlasReachResponse,
  type AtlasReachResult,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useState, type ReactNode } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"

import type { AtlasLibrary } from "./atlas.logic"
import { AtlasAnalysisHeader } from "./AtlasAnalysisHeader"
import { AtlasInspectSettings, AtlasInspectTools } from "./AtlasInspect"
import { AtlasLoadingSkeleton } from "./AtlasLoadingSkeleton"
import { AtlasReachLimitNotice } from "./AtlasReachLimitNotice"

function reachRequestError(status: number, code?: string) {
  if (status !== 429) return "unavailable"

  return code === "REACH_RATE_LIMIT" ? "rate" : "allowance"
}

function validateReachResponse(
  data: AtlasReachResponse,
  libraryId: string,
  mode: AtlasReachMode
) {
  if (
    data.libraryId !== libraryId ||
    data.mode !== mode ||
    data.schemaVersion !== 1
  )
    throw new Error("unavailable")
  if (data.state === "ready" || data.state === "partial")
    parseAtlasReachResult(data)
  else if (
    ![
      "pending",
      "unsupported",
      "unroutable",
      "missing_population",
      "failed",
    ].includes(data.state)
  )
    throw new Error("unavailable")
}

export function useAtlasReach(
  enabled: boolean,
  libraryId: string | null,
  mode: AtlasReachMode,
  version = ""
) {
  const identity =
    enabled && libraryId ? `${libraryId}:${mode}:${version}` : null
  const [value, setValue] = useState<{
    identity: string
    tick: number
    response?: AtlasReachResponse
    error?: string
  } | null>(null)
  const [revision, setRevision] = useState({
    identity: null as string | null,
    tick: 0,
  })
  useEffect(() => {
    if (!identity || !libraryId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const started = Date.now()
    async function load(retry = false) {
      try {
        const response = await fetch("/api/atlas/reach", {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schemaVersion: 1,
            libraryId,
            mode,
            ...(retry ? { retry: true } : {}),
          }),
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(reachRequestError(response.status, data.code))
        validateReachResponse(data, libraryId!, mode)
        if (controller.signal.aborted) return
        setValue({ identity: identity!, tick: revision.tick, response: data })
        if (data.state === "pending" && Date.now() - started < 120000)
          timer = setTimeout(() => void load(), 3000)
      } catch (error) {
        if (!controller.signal.aborted)
          setValue({
            identity: identity!,
            tick: revision.tick,
            error: error instanceof Error ? error.message : "unavailable",
          })
      }
    }
    void load(revision.identity === identity && revision.tick > 0)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [identity, libraryId, mode, revision])
  const current =
    value?.identity === identity && value.tick === revision.tick ? value : null
  const response = current?.response ?? null

  return {
    response,
    result:
      response && (response.state === "ready" || response.state === "partial")
        ? (response as AtlasReachResult)
        : null,
    error: current?.error ?? null,
    retry: () =>
      setRevision((previous) => ({ identity, tick: previous.tick + 1 })),
  }
}

export function AtlasReachAnalysis({
  scopeControl,
  library,
  response,
  error,
  retry,
  mode,
  onMode,
  minutes,
  onMinutes,
  opacity,
  onOpacity,
  onClose,
  collapsed,
  onCollapse,
  canExport,
  calculationLimit = null,
  onZoomLocal,
}: {
  readonly scopeControl?: ReactNode
  readonly library: AtlasLibrary | null
  readonly response: AtlasReachResponse | null
  readonly error: string | null
  readonly retry: () => void
  readonly mode: AtlasReachMode
  readonly onMode: (mode: AtlasReachMode) => void
  readonly minutes: number
  readonly onMinutes: (minutes: number) => void
  readonly opacity: number
  readonly onOpacity: (opacity: number) => void
  readonly onClose: () => void
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly canExport: boolean
  readonly calculationLimit?: "zoom" | "busy" | null
  readonly onZoomLocal?: () => void
}) {
  const t = useTranslations("atlasAnalysis")
  const result =
    library &&
    !error &&
    response &&
    (response.state === "ready" || response.state === "partial")
      ? (response as AtlasReachResult)
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AtlasAnalysisHeader
        title={t("reach")}
        description={library?.name ?? t("chooseLibrary")}
        badge={t("libraryAnalysis")}
        badgeTone="area"
        collapsed={collapsed}
        onCollapse={onCollapse}
        onClose={onClose}
      />
      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5 text-sm">
          {calculationLimit ? (
            <AtlasReachLimitNotice
              reason={calculationLimit}
              onZoom={onZoomLocal}
            />
          ) : null}
          {result ? (
            <section
              data-atlas-reveal
              className="space-y-2 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4"
            >
              <p className="m-0 text-xs font-semibold">
                Within {minutes} minutes · {t(mode)}
              </p>
              <p className="m-0 text-[40px] leading-tight font-semibold text-(--t-accent-primary) tabular-nums">
                {result.contours
                  .find((band) => band.minutes === minutes)
                  ?.residents?.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  }) ?? t("unavailable")}
              </p>
              <p className="m-0 text-xs text-(--t-ink-dim)">
                Estimated residents · {result.population.year ?? "—"} population
                grid
              </p>
            </section>
          ) : null}
          <SegmentedControl
            layout="equal"
            label={t("timeLimit")}
            value={String(minutes)}
            onChange={(value) => onMinutes(Number(value))}
            options={ATLAS_REACH_MINUTES.map((value) => ({
              value: String(value),
              label: `${value} min`,
            }))}
          />
          <AtlasInspectSettings
            summary={`${library?.name ?? t("chooseLibrary")} · ${t(mode)}`}
            open={!library}
          >
            {scopeControl}{" "}
            <label className="flex flex-col gap-2 font-semibold">
              {t("travelMode")}
              <SelectField
                label={t("travelMode")}
                value={mode}
                onValueChange={(value) => onMode(value as AtlasReachMode)}
                options={[
                  { value: "walking", label: t("walking") },
                  { value: "cycling", label: t("cycling") },
                ]}
              />
            </label>
          </AtlasInspectSettings>
          {result ? (
            <ReachResultContent
              result={result}
              minutes={minutes}
              onMinutes={onMinutes}
              opacity={opacity}
              onOpacity={onOpacity}
              canExport={canExport}
            />
          ) : !calculationLimit ? (
            <ReachStatus
              hasLibrary={Boolean(library)}
              response={response}
              error={error}
              retry={retry}
            />
          ) : null}
          {!result ? (
            <AtlasInspectTools
              about={
                <p>
                  {t("reachExplanation")} {t("reachAssumptions")}
                </p>
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ReachStatus({
  hasLibrary,
  response,
  error,
  retry,
}: {
  readonly hasLibrary: boolean
  readonly response: AtlasReachResponse | null
  readonly error: string | null
  readonly retry: () => void
}) {
  const t = useTranslations("atlasAnalysis")
  if (!hasLibrary) return <p role="status">{t("chooseLibrary")}</p>
  if (error)
    return (
      <div role="alert">
        <p>
          {t(
            error === "rate"
              ? "reachRateLimit"
              : error === "allowance"
                ? "reachAllowance"
                : "reachUnavailable"
          )}
        </p>
        <button
          type="button"
          className="min-h-12 w-full rounded-xl border border-(--t-border-line) px-4 py-3 text-left text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
          onClick={retry}
        >
          {t("retry")}
        </button>
      </div>
    )
  if (!response || response.state === "pending")
    return (
      <div>
        <AtlasLoadingSkeleton label={t("calculatingReach")} compact />
        <button
          type="button"
          className="min-h-12 w-full rounded-xl border border-(--t-border-line) px-4 py-3 text-left text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
          onClick={retry}
        >
          {t("checkAgain")}
        </button>
      </div>
    )
  const message =
    response.state === "unroutable"
      ? "reachUnroutable"
      : response.state === "missing_population"
        ? "reachMissingPopulation"
        : response.state === "failed"
          ? "reachUnavailable"
          : "reachUnsupported"

  return (
    <div role="status">
      <p>{t(message)}</p>
      {response.state === "failed" ? (
        <button
          type="button"
          className="min-h-12 w-full rounded-xl border border-(--t-border-line) px-4 py-3 text-left text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
          onClick={retry}
        >
          {t("retry")}
        </button>
      ) : null}
    </div>
  )
}

function ReachResultContent({
  result,
  minutes,
  onMinutes,
  opacity,
  onOpacity,
  canExport,
}: {
  readonly result: AtlasReachResult
  readonly minutes: number
  readonly onMinutes: (minutes: number) => void
  readonly opacity: number
  readonly onOpacity: (opacity: number) => void
  readonly canExport: boolean
}) {
  const t = useTranslations("atlasAnalysis")
  const [exportError, setExportError] = useState(false)
  async function download(format: "csv" | "geojson") {
    setExportError(false)
    try {
      const res = await fetch(`/api/atlas/reach/export?format=${format}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          libraryId: result.libraryId,
          mode: result.mode,
        }),
      })
      if (!res.ok) throw new Error("Export failed")
      const url = URL.createObjectURL(await res.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `library-reach-${result.libraryId}-${result.mode}.${format === "csv" ? "csv" : "geojson"}`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setExportError(true)
    }
  }

  return (
    <>
      <table className="w-full text-left">
        <caption className="pb-3 text-left font-semibold">
          {t("cumulativeResidents")}
          <span className="mt-1 block text-xs font-normal">
            {t("populationYearShort", { year: result.population.year ?? "—" })}
          </span>
        </caption>
        <thead>
          <tr>
            <th className="pb-2">{t("timeLimit")}</th>
            <th className="pb-2 text-right">{t("estimatedResidents")}</th>
          </tr>
        </thead>
        <tbody>
          {result.contours.map((contour) => (
            <tr key={contour.minutes} className="border-t">
              <td className="py-3">
                {t("minutes", { count: contour.minutes })}
              </td>
              <td className="text-right">
                {contour.residents === null ? (
                  <>
                    {t("unavailable")}
                    <span
                      className="mt-1 block text-xs"
                      style={{ color: T.ink.dim }}
                    >
                      {t("surfaceCoverage", {
                        percent: Math.min(
                          99.99,
                          contour.coveredFraction * 100
                        ).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        }),
                      })}
                    </span>
                  </>
                ) : (
                  Math.round(contour.residents).toLocaleString()
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0">{t("reachCountsExplanation")}</p>
      {result.state === "partial" ? (
        <p role="status">{t("partialPopulation")}</p>
      ) : null}
      <p>{t("reachAssumptions")}</p>
      <AtlasInspectTools
        shading={opacity}
        onShading={onOpacity}
        about={
          <div className="flex flex-col gap-4">
            <h4 className="type-h4 m-0 text-(--t-ink-base)">
              {t("aboutData")}
            </h4>
            <p>{t("reachMethod")}</p>
            <p>
              {t("populationYear", { year: result.population.year ?? "—" })}
            </p>
            <p>{t("reachOverlap")}</p>
            <p>
              <a
                className="underline"
                href={result.network.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("networkSource")}
              </a>{" "}
              · {result.network.licence}
            </p>
            <p>
              <a
                className="underline"
                href={result.population.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("populationSource")}
              </a>{" "}
              · {result.population.licence}
            </p>
            <p style={{ color: T.ink.dim }}>
              {t("calculatedAt", {
                date: new Date(result.calculatedAt).toLocaleDateString(),
              })}
            </p>
            <div className="flex flex-col gap-4">
              <h4 className="type-h4 m-0 text-(--t-ink-base)">
                {t("technicalDetails")}
              </h4>
              <p>{t("reachSpeeds")}</p>
              <p>{t("reachPopulationMethod")}</p>
              <p>
                {t("reachSnap", {
                  distance: Math.round(result.snapDistanceMetres),
                })}
              </p>
              <p className="break-words">
                {t("networkRelease", { release: result.network.release })}
              </p>
              <p className="break-words">
                {t("populationRelease", { release: result.population.release })}
              </p>
            </div>
          </div>
        }
        downloads={
          canExport ? (
            <>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void download("csv")}
                  className="min-h-12 w-full rounded-xl border border-(--t-border-line) px-4 py-3 text-left text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
                >
                  {t("exportCsv")}
                </button>
                <button
                  type="button"
                  onClick={() => void download("geojson")}
                  className="min-h-12 w-full rounded-xl border border-(--t-border-line) px-4 py-3 text-left text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
                >
                  {t("exportGeojson")}
                </button>
              </div>
              {exportError ? (
                <p role="alert">{t("exportUnavailable")}</p>
              ) : null}
            </>
          ) : undefined
        }
      />
    </>
  )
}
