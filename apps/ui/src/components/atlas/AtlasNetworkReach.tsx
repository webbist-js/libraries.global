"use client"

import {
  parseAtlasNetworkReachResult,
  type AtlasNetworkReachRequest,
  type AtlasNetworkReachResult,
  type AtlasNetworkSelection,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useState, type ReactNode } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"

import { buildAtlasNetworkExport } from "./atlas-network-export"
import { Icon } from "./atlas-ui"
import { AtlasInspectTools } from "./AtlasInspect"
import { AtlasLoadingSkeleton } from "./AtlasLoadingSkeleton"
import { AtlasNetworkPicker } from "./AtlasNetworkPicker"
import { AtlasReachInterpretation } from "./AtlasReachInterpretation"
import { AtlasReachLimitNotice } from "./AtlasReachLimitNotice"

type NetworkExportFormat = "csv" | "geojson" | "json"

type NetworkResponse =
  | AtlasNetworkReachResult
  | {
      state:
        | "pending"
        | "failed"
        | "unsupported"
        | "unroutable"
        | "missing_population"
      message?: string
    }
// Cached results contain these provider notes. Localise them at display time
// so copy improvements also apply to calculations that already exist.
const NOTE_COPY = new Map<
  string,
  "reachMeaning" | "travelLimits" | "partialCoverage"
>([
  [
    "Coverage is potential geographical reach to the selected recorded libraries, not observed use or guaranteed admission.",
    "reachMeaning",
  ],
  [
    "No elevation model, opening-hours journey or step-free routing is included. Ferries are excluded.",
    "travelLimits",
  ],
  [
    "Incomplete routing or population data: unavailable coverage must not be interpreted as an underserved community.",
    "partialCoverage",
  ],
] as const)

export function useNetworkReach(
  draft: AtlasNetworkReachRequest | null,
  enabled: boolean
) {
  const identity = JSON.stringify(draft)
  const [applied, setApplied] = useState<{
    identity: string
    request: AtlasNetworkReachRequest
    tick: number
  } | null>(null)
  const [value, setValue] = useState<{
    identity: string
    tick: number
    response: NetworkResponse
  } | null>(null)
  useEffect(() => {
    // Returning to a local view must not restart an abandoned calculation.
    if (!enabled) setApplied(null)
  }, [enabled])
  useEffect(() => {
    if (!enabled || !applied || applied.identity !== identity) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const started = Date.now()
    async function check() {
      try {
        const response = await fetch("/api/atlas/network-reach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(applied!.request),
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
        })
        const data = await response.json()
        if (abort.signal.aborted) return
        if (!response.ok)
          throw new Error(data.error ?? "Network analysis unavailable")
        if (
          data.networkId !== applied!.request.networkId ||
          (applied!.request.areaCode !== undefined &&
            data.areaCode !== applied!.request.areaCode) ||
          data.mode !== applied!.request.mode
        )
          throw new Error("Mismatched network response")
        if (["ready", "partial"].includes(data.state))
          parseAtlasNetworkReachResult(data)
        if (data.state === "pending" && Date.now() - started >= 300000)
          throw new Error(
            "The calculation is still queued. Calculate again to check its progress."
          )
        setValue({ identity, tick: applied!.tick, response: data })
        if (data.state === "pending")
          timer = setTimeout(() => void check(), 3000)
      } catch (error) {
        if (!abort.signal.aborted)
          setValue({
            identity,
            tick: applied!.tick,
            response: {
              state: "failed",
              message:
                error instanceof Error
                  ? error.message
                  : "Network analysis unavailable",
            },
          })
      }
    }
    void check()

    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [applied, enabled, identity])
  const response =
    enabled && value?.identity === identity && value.tick === applied?.tick
      ? value.response
      : enabled && applied?.identity === identity
        ? { state: "pending" as const }
        : null
  const result =
    response && ["ready", "partial"].includes(response.state)
      ? (response as AtlasNetworkReachResult)
      : null

  return {
    response,
    result,
    stale: enabled && applied !== null && applied.identity !== identity,
    clear: () => setApplied(null),
    calculate: () => {
      if (enabled && draft)
        setApplied({
          identity,
          request: { ...draft, retry: true },
          tick: Date.now(),
        })
    },
  }
}

type NetworkReachProps = {
  scopeControl?: ReactNode
  opacity?: number
  onOpacity?: (value: number) => void
  selection: AtlasNetworkSelection | null
  selectionLoading?: boolean
  selectionError?: boolean
  retrySelection: () => void
  networkId: string
  onNetwork: (id: string) => void
  minutes: number
  onMinutes: (minutes: number) => void
  mode: string
  onMode: (mode: "walking" | "cycling") => void
  response: NetworkResponse | null
  calculate: () => void
  canExport: boolean
  gaps: boolean
  onGaps: (value: boolean) => void
  filterCount: number
  onClearFilters: () => void
  stale?: boolean
  calculationLimit?: "zoom" | "busy" | "libraries" | "area" | null
  onZoomLocal?: () => void
  onSingleLibrary?: () => void
}

export function AtlasNetworkReach(props: NetworkReachProps) {
  const {
    selection,
    minutes,
    onMinutes,
    response,
    calculate,
    canExport,
    stale = false,
    calculationLimit = null,
    onZoomLocal,
    onSingleLibrary,
  } = props
  const t = useTranslations("atlasNetwork")
  const result: AtlasNetworkReachResult | null =
    response && (response.state === "ready" || response.state === "partial")
      ? response
      : null
  const download = (format: NetworkExportFormat) => {
    if (!result || !canExport) return
    const data = buildAtlasNetworkExport(result, minutes, format)
    const url = URL.createObjectURL(
      new Blob([data], {
        type:
          format === "csv"
            ? "text/csv"
            : format === "json"
              ? "application/json"
              : "application/geo+json",
      })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `network-reach-${result.networkId}-${result.areaCode}.${format}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const current = result?.contours.find((band) => band.minutes === minutes)

  const updateCoverage = (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-4 font-semibold text-white hover:bg-(--t-accent-primary-hover) disabled:opacity-50"
      disabled={
        Boolean(calculationLimit) ||
        !selection?.available ||
        response?.state === "pending"
      }
      onClick={calculate}
    >
      {response?.state === "pending"
        ? t("pending")
        : result
          ? t("recalculate")
          : t("calculate")}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5 text-sm text-(--t-ink-base) [&>*]:shrink-0">
      {calculationLimit ? (
        <AtlasReachLimitNotice
          reason={calculationLimit}
          onZoom={onZoomLocal}
          onSingleLibrary={onSingleLibrary}
        />
      ) : null}
      {result && current ? (
        <NetworkReachSummary
          result={result}
          current={current}
          minutes={minutes}
        />
      ) : null}
      <SegmentedControl
        layout="equal"
        label={t("showCatchment")}
        value={String(minutes)}
        onChange={(value) => onMinutes(Number(value))}
        options={[5, 10, 15, 30].map((value) => ({
          value: String(value),
          label: `${value} min`,
        }))}
      />
      <NetworkReachControls {...props} result={result} />
      {response?.state === "pending" && !stale ? (
        <AtlasLoadingSkeleton label={t("pending")} compact />
      ) : null}
      {stale ? (
        <p
          role="status"
          className="m-0 text-xs leading-relaxed text-(--t-ink-dim)"
        >
          {t("selectionChanged")}
        </p>
      ) : null}
      <NetworkReachResult
        {...props}
        result={result}
        current={current}
        updateCoverage={updateCoverage}
        download={download}
      />
      {!result ? (
        <AtlasInspectTools
          action={updateCoverage}
          about={
            <p>
              {t("explanation")} {t("travelLimits")}
            </p>
          }
        />
      ) : null}
    </div>
  )
}

function NetworkReachAbout({ result }: { result: AtlasNetworkReachResult }) {
  const t = useTranslations("atlasNetwork")

  return (
    <div className="flex flex-col gap-4">
      <h4 className="m-0 font-semibold text-(--t-ink-base)">
        {t("aboutResult")}
      </h4>
      <p>
        {t("residentsTotal", {
          count: networkResidentNumber(result.totalResidents, t("unknown")),
          year: result.population.year ?? "—",
        })}
      </p>
      <p>
        {t("populationMethod", {
          source: result.population.source,
          year: result.population.year ?? t("unknown"),
        })}
      </p>
      <p>
        {result.population.release === "ghsl-2020-r2023a-100m"
          ? t("gridResolution", { metres: 100 })
          : t("unknownGrid")}
      </p>
      <p>{t("networkSnap")}</p>
      <p>
        {t("routingMethod", {
          speed: result.mode === "walking" ? "5.1" : "15",
        })}
      </p>
      <p>{t("libraryScope", { count: result.selectedLibraries })}</p>
      <p>
        {t("boundaryMethod", {
          name: result.reportingArea?.name ?? result.areaCode,
        })}
      </p>
      <p>
        {t("summary", {
          selected: result.selectedLibraries,
        })}
      </p>
      <p>{t("boundaryNote")}</p>
      {result.excludedLibraries > 0 ? (
        <p>
          {t("excludedLibraries", {
            count: result.excludedLibraries,
          })}
        </p>
      ) : null}
      {result.unavailableLibraries > 0 ? (
        <p>
          {t("unavailableLibraries", {
            count: result.unavailableLibraries,
          })}
        </p>
      ) : null}
      {result.warnings.map((warning) => {
        const copy = NOTE_COPY.get(warning)

        return <p key={warning}>{copy ? t(copy) : warning}</p>
      })}
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
      <p>
        <a
          className="underline"
          href={result.network.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {t("routingSource")}
        </a>{" "}
        · {result.network.licence}
      </p>
    </div>
  )
}

function NetworkReachDownloads({
  download,
}: {
  download: (format: NetworkExportFormat) => void
}) {
  const t = useTranslations("atlasNetwork")

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 pb-2 text-xs leading-relaxed text-(--t-ink-dim)">
        {t("exportHint")}
      </p>
      {(["csv", "geojson", "json"] as const).map((format) => (
        <button
          key={format}
          type="button"
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-(--t-border-line) px-4 py-3 text-left text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
          onClick={() => download(format)}
        >
          <Icon name="download" size={15} />
          {t(
            format === "csv"
              ? "downloadCsv"
              : format === "json"
                ? "downloadAnalysis"
                : "downloadGeojson"
          )}
        </button>
      ))}
    </div>
  )
}

function NetworkReachControls({
  scopeControl,
  networkId,
  selection,
  onNetwork,
  selectionLoading,
  selectionError,
  retrySelection,
  mode,
  onMode,
  filterCount,
  onClearFilters,
  gaps,
  onGaps,
  result,
}: NetworkReachProps & { result: AtlasNetworkReachResult | null }) {
  const t = useTranslations("atlasNetwork")

  return (
    <section
      aria-label={t("coverageControls")}
      className="flex flex-col gap-4 border-t border-(--t-border-line) pt-5"
    >
      {scopeControl}
      <AtlasNetworkPicker
        value={networkId}
        selected={selection}
        onChange={onNetwork}
      />
      {selectionLoading ? (
        <AtlasLoadingSkeleton label={t("loadingService")} compact />
      ) : null}
      {selectionError ? (
        <div role="alert">
          <p>{t("catalogueUnavailable")}</p>
          <button
            type="button"
            onClick={retrySelection}
            className="min-h-10 underline"
          >
            {t("retry")}
          </button>
        </div>
      ) : null}
      {selection ? (
        <section
          aria-label={t("serviceArea")}
          className="flex flex-col gap-1 text-xs leading-relaxed text-(--t-ink-dim)"
        >
          <p className="m-0 font-medium text-(--t-ink-base)">
            {selection.areaName}
          </p>
          <p className="m-0">
            {t("serviceAreaSummary", {
              libraries: selection.eligibleLibraries,
              areas: selection.areaCodes.length,
            })}
          </p>
          {!selection.available ? (
            <p className="m-0">{t("serviceNotReady")}</p>
          ) : null}
        </section>
      ) : null}
      <SegmentedControl
        layout="equal"
        label={t("travelMode")}
        value={mode}
        onChange={(value) => onMode(value as "walking" | "cycling")}
        options={[
          { value: "walking", label: t("walking") },
          { value: "cycling", label: t("cycling") },
        ]}
      />
      {filterCount ? (
        <div className="flex items-start gap-2 rounded-xl bg-(--t-bg-surface) px-3.5 py-3 text-xs leading-relaxed text-(--t-ink-dim)">
          <Icon name="filter" size={16} />
          <span className="flex-1">
            {filterCount
              ? t("filtersApplied", { count: filterCount })
              : t("allServiceLibraries")}
          </span>
          {filterCount ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="min-h-8 font-semibold text-(--t-accent-primary) underline"
            >
              {t("clearFilters")}
            </button>
          ) : null}
        </div>
      ) : null}
      {result ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] font-medium">
          <input
            type="checkbox"
            className="size-4 accent-(--t-accent-primary)"
            checked={gaps && result.state === "ready"}
            disabled={result.state !== "ready"}
            onChange={(event) => onGaps(event.target.checked)}
          />
          {t("showGaps")}
        </label>
      ) : null}
    </section>
  )
}

function NetworkReachSummary({
  result,
  current,
  minutes,
}: {
  result: AtlasNetworkReachResult
  current: AtlasNetworkReachResult["contours"][number]
  minutes: number
}) {
  const t = useTranslations("atlasNetwork")

  return (
    <section
      aria-label={t("coverageSummary")}
      data-atlas-reveal
      className="rounded-2xl border border-(--t-border-hi) bg-(--t-bg-surface) p-4"
    >
      <p className="m-0 text-xs font-semibold text-(--t-ink-dim)">
        {t("withinMinutes", { count: minutes })}
      </p>
      <p className="mt-2 mb-1 text-[40px] leading-none font-semibold text-(--t-accent-primary) tabular-nums">
        {current.percent == null
          ? t("unknown")
          : `${current.percent.toFixed(1)}%`}
      </p>
      <p className="mt-2 mb-1 text-xs font-medium text-(--t-ink-dim)">
        {t("modelledCoverage", { mode: t(result.mode) })}
      </p>
      <p className="m-0 text-xs text-(--t-ink-dim)">
        {t("coveragePopulation", {
          count: networkResidentNumber(result.totalResidents, t("unknown")),
          year: result.population.year ?? "—",
        })}
      </p>
      <p className="mt-3 mb-0 border-t border-(--t-border-line) pt-3 text-xs text-(--t-ink-dim)">
        {networkResidentNumber(current.residents, t("unknown"))} within ·{" "}
        {networkResidentNumber(current.outsideResidents, t("unknown"))} beyond{" "}
        {minutes} min
      </p>
    </section>
  )
}

function NetworkReachResult({
  result,
  current,
  updateCoverage,
  download,
  minutes,
  onMinutes,
  opacity = 0.7,
  onOpacity,
  canExport,
  response,
  filterCount,
  onClearFilters,
  networkId,
}: NetworkReachProps & {
  result: AtlasNetworkReachResult | null
  current?: AtlasNetworkReachResult["contours"][number]
  updateCoverage: ReactNode
  download: (format: NetworkExportFormat) => void
}) {
  const t = useTranslations("atlasNetwork")
  if (result && current)
    return (
      <>
        {result.state === "partial" ? (
          <p
            role="status"
            className="m-0 rounded-xl bg-(--t-bg-surface) p-3.5 text-xs leading-relaxed text-(--t-ink-dim)"
          >
            {t(
              result.totalResidents === null
                ? "missingReportingPopulation"
                : "partialCoverage"
            )}
          </p>
        ) : null}

        <AtlasReachInterpretation
          key={result.selectionHash}
          result={result}
          minutes={minutes}
          onMinutes={onMinutes}
        />

        <AtlasInspectTools
          action={updateCoverage}
          shading={opacity}
          onShading={onOpacity}
          about={<NetworkReachAbout result={result} />}
          downloads={
            canExport ? <NetworkReachDownloads download={download} /> : null
          }
        />
      </>
    )
  if (response && response.state !== "pending")
    return (
      <div
        role="status"
        className="rounded-xl border border-(--t-border-line) p-3.5 text-xs leading-relaxed text-(--t-ink-dim)"
      >
        <p className="m-0">
          {networkResponseMessage(response) ?? t("unavailable")}
        </p>
        {filterCount ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-2 min-h-10 font-semibold text-(--t-accent-primary) underline"
          >
            {t("clearAndCalculate")}
          </button>
        ) : null}
      </div>
    )
  if (!networkId)
    return (
      <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
        {t("choosePrompt")}
      </p>
    )

  return null
}

function networkResidentNumber(
  value: number | null | undefined,
  unknown: string
) {
  return value == null
    ? unknown
    : value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
function networkResponseMessage(response: NetworkResponse) {
  return "message" in response ? response.message : null
}
