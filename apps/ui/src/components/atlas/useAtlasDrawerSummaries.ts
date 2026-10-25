"use client"

import type {
  AtlasAccessMetric,
  AtlasLibraryAccessResponse,
  AtlasNetworkReachResult,
  AtlasNetworkSelection,
  AtlasPopulationDensityArea,
  AtlasReachMode,
  AtlasReachResult,
} from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"

import type {
  AtlasContextPoint,
  AtlasContextRelease,
} from "@/lib/atlas-context"

import type {
  AtlasAnalysisMode,
  AtlasDrawerSummary,
} from "./atlas-analysis-panels"
import type { accessibilitySummary } from "./atlas.logic"

export interface AtlasDrawerSummaryInput {
  reach: {
    scope: "library" | "network"
    libraryName?: string
    mode: AtlasReachMode
    minutes: number
    result: AtlasReachResult | null
    state?: string
    stale: boolean
  }
  network: {
    selection: AtlasNetworkSelection | null
    result: AtlasNetworkReachResult | null
  }
  population: {
    grid: AtlasContextRelease | null
    area?: AtlasPopulationDensityArea
    level: string
    country: string
  }
  context: { release: AtlasContextRelease | null; point?: AtlasContextPoint }
  accessibility: {
    selected: string[]
    coverage: ReturnType<typeof accessibilitySummary> | null
    inView: boolean
  }
  libraryAccess: {
    response: AtlasLibraryAccessResponse | null
    selected: string | null
    metric: AtlasAccessMetric
  }
}

export function useAtlasDrawerSummaries(
  input: AtlasDrawerSummaryInput
): Record<AtlasAnalysisMode, AtlasDrawerSummary> {
  const t = useTranslations("atlasDrawers")
  const locale = useLocale()
  const number = (value: number, digits = 0) =>
    value.toLocaleString(locale, { maximumFractionDigits: digits })
  const { reach, network, population, context, accessibility, libraryAccess } =
    input
  const reachResult = reach.scope === "network" ? network.result : reach.result
  const band = reachResult?.contours.find(
    ({ minutes }) => minutes === reach.minutes
  )
  const networkBand = network.result?.contours.find(
    ({ minutes }) => minutes === reach.minutes
  )
  const reachMetric = () => {
    if (reach.stale) return t("updateNeeded")
    if (reach.state === "pending") return t("calculating")
    if (reachResult?.state === "partial") return t("partial")
    if (reach.scope === "network" && networkBand?.percent != null)
      return `${number(networkBand.percent, 1)}%`
    if (reach.scope === "library" && band?.residents != null)
      return t("residents", { count: number(band.residents) })
  }
  // A reporting-area count is comparable only to the same installed population grid.
  const reportingPopulation =
    population.grid?.country === "GB" &&
    network.result?.population.sourceUrl === population.grid.sourceUrl &&
    network.result?.networkId === network.selection?.documentId &&
    network.result?.population.year === population.grid.year
      ? network.result
      : null
  const populationSummary = (): AtlasDrawerSummary => {
    if (population.grid)
      return {
        detail: reportingPopulation
          ? t("reportingGrid", {
              year: population.grid.year,
              area:
                network.selection?.areaName ??
                reportingPopulation.reportingArea?.name ??
                t("reportingArea"),
            })
          : `${population.grid.name} · ${population.grid.edition}`,
        metric:
          reportingPopulation?.totalResidents != null
            ? number(reportingPopulation.totalResidents)
            : undefined,
      }
    if (population.area)
      return {
        detail: `${population.area.name} · ${population.area.year}`,
        metric:
          population.area.population == null
            ? t("unavailable")
            : number(population.area.population),
      }

    return {
      detail: t(
        population.level === "countries" ? "countryAverages" : "localAverages"
      ),
    }
  }
  const contextSummary = (
    theme: "deprivation" | "carAccess"
  ): AtlasDrawerSummary => {
    if (context.release?.theme !== theme) return { detail: t("chooseArea") }
    const area = context.point?.area

    return {
      detail: [
        area?.name ?? context.release.name,
        context.release.edition,
      ].join(" · "),
      metric:
        area?.value == null
          ? undefined
          : theme === "deprivation"
            ? t("decile", { count: area.value })
            : `${number(area.value, 1)}%`,
    }
  }
  const accessArea = libraryAccess.response?.areas.find(
    ({ id }) => id === libraryAccess.selected
  )
  const accessValue =
    libraryAccess.metric === "per100k"
      ? accessArea?.per100k
      : accessArea?.peoplePerLibrary

  return {
    reach: {
      heading: t(reach.scope === "network" ? "serviceReach" : "reachLabel"),
      detail: [
        reach.scope === "network"
          ? (network.selection?.name ?? t("chooseService"))
          : (reach.libraryName ?? t("chooseLibrary")),
        t(reach.mode),
        t("minutes", { count: reach.minutes }),
      ].join(" · "),
      metric: reachMetric(),
    },
    population: populationSummary(),
    deprivation: contextSummary("deprivation"),
    carAccess: contextSummary("carAccess"),
    accessibility: {
      detail: [
        accessibility.selected.length
          ? accessibility.selected.join(", ")
          : t("recordedFeatures"),
        t(accessibility.inView ? "inView" : "loadedLibraries"),
      ].join(" · "),
      metric: accessibility.coverage
        ? t("matches", {
            count: number(accessibility.coverage.matches),
            total: number(accessibility.coverage.total),
          })
        : undefined,
    },
    libraryAccess: {
      detail: accessArea
        ? `${accessArea.name} · ${accessArea.populationYear}`
        : t("chooseArea"),
      metric:
        accessValue == null
          ? undefined
          : t(libraryAccess.metric === "per100k" ? "per100k" : "perLibrary", {
              count: number(
                accessValue,
                libraryAccess.metric === "per100k" ? 1 : 0
              ),
            }),
    },
  }
}
