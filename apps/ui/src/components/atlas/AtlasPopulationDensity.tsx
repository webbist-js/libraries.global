"use client"

import {
  ATLAS_POPULATION_DENSITY_BINS,
  atlasPopulationDensityColor,
  type AtlasPopulationDensityResponse,
  type AtlasPopulationDensityArea,
  type AtlasPopulationLevel,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
import type {
  AtlasContextRelease,
  AtlasContextPoint,
} from "@/lib/atlas-context"
import { T } from "@/lib/design-tokens"

import { AtlasAnalysisHeader } from "./AtlasAnalysisHeader"
import { AtlasAreaPicker } from "./AtlasAreaPicker"
import { AtlasContextLegend, AtlasContextSources } from "./AtlasContext"
import { AtlasInspectSettings, AtlasInspectTools } from "./AtlasInspect"
import { AtlasLoadingSkeleton } from "./AtlasLoadingSkeleton"

export type AtlasPopulationDetail = AtlasPopulationLevel | "auto" | "grid"
export interface PopulationControlsProps {
  readonly level: AtlasPopulationDetail
  readonly onLevel: (level: AtlasPopulationDetail) => void
  readonly opacity: number
  readonly onOpacity: (opacity: number) => void
  readonly country?: string
  readonly countries?: readonly { value: string; label: string }[]
  readonly onCountry?: (country: string) => void
  readonly gridAvailable?: boolean
  readonly resolvedLabel?: string
}

export function usePopulationDensity(
  enabled: boolean,
  level: AtlasPopulationLevel,
  country = "GB"
) {
  const [revision, setRevision] = useState(0)
  const key = enabled ? `${level}:${country}:${revision}` : null
  const [value, setValue] = useState<{
    key: string
    data?: AtlasPopulationDensityResponse
    error?: string
  } | null>(null)
  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    fetch(`/api/atlas/population?level=${level}&country=${country}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Population data is temporarily unavailable")
        const result = (await response.json()) as AtlasPopulationDensityResponse
        if (
          result.schemaVersion !== 1 ||
          result.level !== level ||
          !Array.isArray(result.areas) ||
          result.areas.length > 1024
        )
          throw new Error("Invalid population response")
        if (!controller.signal.aborted) setValue({ key, data: result })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setValue({ key, error: error.message })
      })

    return () => controller.abort()
  }, [key, level, country])
  const current = value?.key === key ? value : null

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    retry: () => setRevision((n) => n + 1),
  }
}

export function AtlasPopulationDensityControls({
  level,
  onLevel,
  opacity,
  onOpacity,
  country = "GB",
  countries,
  onCountry,
  gridAvailable = true,
  resolvedLabel,
  showOpacity = true,
}: PopulationControlsProps & { showOpacity?: boolean }) {
  const t = useTranslations("atlasAnalysis")
  const context = useTranslations("atlasContext")

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-2 text-xs font-semibold text-(--t-ink-dim)">
        {context("detail")}
        <SelectField
          label={context("detail")}
          value={level}
          onValueChange={(value) => onLevel(value as AtlasPopulationDetail)}
          options={[
            { value: "auto", label: context("automatic") },
            { value: "countries", label: t("countries") },
            {
              value: "regions",
              label:
                country === "GB" ? t("englandCounties") : context("regions"),
            },
            {
              value: "local",
              label:
                country === "GB" ? t("ukDistricts") : context("municipalities"),
            },
            { value: "grid", label: context("grid"), disabled: !gridAvailable },
          ]}
        />
      </label>
      {level !== "countries" && countries && onCountry ? (
        <label className="flex flex-col gap-2 text-xs font-semibold text-(--t-ink-dim)">
          {context("country")}
          <SelectField
            label={context("country")}
            value={country}
            onValueChange={onCountry}
            options={countries}
          />
        </label>
      ) : null}
      {resolvedLabel ? (
        <p className="m-0 text-xs text-(--t-ink-dim)">{resolvedLabel}</p>
      ) : null}
      {showOpacity ? (
        <label className="flex flex-col gap-2">
          {t("opacity")}
          <input
            type="range"
            className="min-h-8 w-full accent-(--t-accent-primary)"
            min="0.1"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => onOpacity(Number(event.target.value))}
          />
        </label>
      ) : null}
      <p className="m-0 text-xs leading-relaxed" style={{ color: T.ink.dim }}>
        {t("densityFilterNote")}
      </p>
    </div>
  )
}

export function AtlasPopulationDensityAnalysis({
  response,
  selected,
  onSelect,
  error,
  retry,
  onClose,
  collapsed,
  onCollapse,
  controls,
  gridRelease,
  gridPoint,
  loading = false,
  onReach,
  reachActive,
}: {
  readonly response: AtlasPopulationDensityResponse | null
  readonly selected: string | null
  readonly onSelect: (id: string) => void
  readonly error: string | null
  readonly retry: () => void
  readonly onClose: () => void
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly controls?: PopulationControlsProps
  readonly gridRelease?: AtlasContextRelease | null
  readonly loading?: boolean
  readonly gridPoint?: AtlasContextPoint
  readonly onReach?: () => void
  readonly reachActive?: boolean
}) {
  const t = useTranslations("atlasAnalysis")
  const context = useTranslations("atlasContext")
  const areas = useMemo(
    () =>
      [...(response?.areas ?? [])]
        .filter((area) => area.population !== null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [response]
  )
  const area = areas.find((area) => area.id === selected)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AtlasAnalysisHeader
        title={t("populationDensity")}
        description={t("residentsPerKm2")}
        badge={t("areaLayer")}
        badgeTone="area"
        collapsed={collapsed}
        onCollapse={onCollapse}
        onClose={onClose}
      />
      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5 text-sm">
          <DensityPoint
            gridRelease={gridRelease}
            loading={loading}
            gridPoint={gridPoint}
            area={area}
          />
          {controls ? (
            <AtlasInspectSettings
              summary={`${controls.resolvedLabel ?? controls.level} · ${controls.country ?? ""}`}
            >
              <AtlasPopulationDensityControls
                {...controls}
                showOpacity={false}
              />
            </AtlasInspectSettings>
          ) : null}
          <DensityData
            gridRelease={gridRelease}
            error={error}
            retry={retry}
            controls={controls}
            response={response}
            area={area}
            areas={areas}
            onSelect={onSelect}
          />
          {onReach ? (
            <div className="rounded-xl bg-(--t-bg-surface) p-4">
              <p className="m-0 text-xs leading-relaxed">
                {context("reachHint")}
              </p>
              <button
                type="button"
                onClick={onReach}
                className="mt-2 min-h-11 text-sm font-semibold underline"
              >
                {context(reachActive ? "openReach" : "addReach")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DensityAreaSummary({
  area,
}: {
  readonly area: AtlasPopulationDensityArea
}) {
  const t = useTranslations("atlasAnalysis")

  return (
    <section
      data-atlas-reveal
      className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4"
    >
      <h3 className="mt-0 text-base font-bold">{area.name}</h3>
      <p className="text-3xl font-semibold">
        {area.peoplePerKm2 === null
          ? t("unavailable")
          : area.peoplePerKm2.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
      </p>
      <p>{t("residentsPerKm2")}</p>
      <p>
        {t("residentTotal", {
          count: area.population?.toLocaleString() ?? "—",
          year: area.year,
        })}
      </p>
      <p>
        {t("boundaryArea", {
          area:
            area.areaKm2?.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            }) ?? "—",
        })}
      </p>
      {area.sourceUrl ? (
        <a
          href={area.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {area.source}
        </a>
      ) : null}
      <p>{area.licence}</p>
    </section>
  )
}

function DensityPoint({
  gridRelease,
  loading,
  gridPoint,
  area,
}: {
  gridRelease?: AtlasContextRelease | null
  loading: boolean
  gridPoint?: AtlasContextPoint
  area?: AtlasPopulationDensityArea
}) {
  const t = useTranslations("atlasAnalysis")
  const context = useTranslations("atlasContext")

  return gridRelease ? (
    loading ? (
      <AtlasLoadingSkeleton label={t("loadingPopulation")} compact />
    ) : gridPoint?.density != null ? (
      <section
        data-atlas-reveal
        className="rounded-xl border border-(--t-border-line) p-4"
      >
        <h3 className="m-0 text-sm font-semibold">{context("selectedCell")}</h3>
        <p className="my-3 text-[40px] font-semibold text-(--t-accent-primary)">
          {gridPoint.density.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
        </p>
        <p className="m-0 text-xs">
          {t("residentsPerKm2")} · {gridRelease.year}
        </p>
      </section>
    ) : (
      <p className="m-0 text-xs text-(--t-ink-dim)">
        {gridPoint ? context("cellUnavailable") : context("clickCell")}
      </p>
    )
  ) : area ? (
    <DensityAreaSummary area={area} />
  ) : null
}

function DensityData({
  gridRelease,
  error,
  retry,
  controls,
  response,
  area,
  areas,
  onSelect,
}: {
  gridRelease?: AtlasContextRelease | null
  error: string | null
  retry: () => void
  controls?: PopulationControlsProps
  response: AtlasPopulationDensityResponse | null
  area?: AtlasPopulationDensityArea
  areas: AtlasPopulationDensityArea[]
  onSelect: (id: string) => void
}) {
  const t = useTranslations("atlasAnalysis")
  const context = useTranslations("atlasContext")
  if (gridRelease)
    return (
      <>
        {error ? (
          <div role="alert">
            <p>{context("unavailable")}</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 underline"
            >
              {context("retry")}
            </button>
          </div>
        ) : null}
        <p className="m-0 text-xs font-semibold text-(--t-ink-dim)">
          {gridRelease.edition} · {context("gridResolution")}
        </p>
        <AtlasContextLegend theme="population" />
        <AtlasInspectTools
          shading={controls?.opacity}
          onShading={controls?.onOpacity}
          about={<AtlasContextSources release={gridRelease} open />}
        />
      </>
    )
  if (error)
    return (
      <div role="alert">
        <p>{t("populationUnavailable")}</p>
        <button type="button" onClick={retry} className="min-h-11 underline">
          {t("retry")}
        </button>
      </div>
    )
  if (!response) return <AtlasLoadingSkeleton label={t("loadingPopulation")} />

  return (
    <>
      <AtlasAreaPicker
        key={`${response.boundaryVersion}:${response.level}`}
        selected={area ? { id: area.id, name: area.name } : null}
        areas={areas.map((area) => ({
          id: area.id,
          name: area.name,
          detail: `${area.population?.toLocaleString()} · ${area.year}`,
        }))}
        onSelect={(area) => onSelect(area.id)}
      />
      <div className="flex flex-col gap-2" aria-label={t("densityScale")}>
        {ATLAS_POPULATION_DENSITY_BINS.map((bin) => (
          <div key={bin.min} className="flex items-center gap-2">
            <span
              className="size-4 rounded-sm"
              style={{ background: bin.color }}
            />
            {bin.label}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span
            className="size-4 rounded-sm"
            style={{
              background: atlasPopulationDensityColor(null),
            }}
          />
          {t("unavailable")}
        </div>
      </div>
      {area ? (
        <span className="sr-only">{area.name}</span>
      ) : (
        <p>{t("selectArea")}</p>
      )}
      <AtlasInspectTools
        shading={controls?.opacity}
        onShading={controls?.onOpacity}
        about={
          <div className="flex flex-col gap-4">
            <h4 className="m-0 font-semibold text-(--t-ink-base)">
              {t("aboutData")}
            </h4>
            <p>{t("densityMethod")}</p>
            <p>{response.note}</p>
            <p>{t("densityFilterNote")}</p>
          </div>
        }
      />
    </>
  )
}
