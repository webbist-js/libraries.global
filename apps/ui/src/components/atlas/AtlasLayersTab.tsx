"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { Icon, MutedChip, ProChip, Switch } from "@/components/atlas/atlas-ui"
import {
  layerAccess,
  layerDef,
  pinDependentLayers,
  LAYERS,
  LAYER_GROUPS,
  type LayerId,
  type LayerDef,
  type LayerAccess,
  type Tier,
} from "@/components/atlas/atlas.logic"
import {
  AtlasPerCapitaControls,
  type LibraryAccessControlsProps,
} from "@/components/atlas/AtlasPerCapita"
import { T } from "@/lib/design-tokens"

import {
  AtlasPopulationDensityControls,
  type PopulationControlsProps,
} from "./AtlasPopulationDensity"

export const ABOUT: Record<LayerId, string> = {
  pins: "Library locations recorded in the index. The library-type key in Filters controls which types are shown.",
  density:
    "Explore recorded library locations at every zoom. Inspect counts and libraries per 100 km² in the density grid, or choose smooth concentration. Detail, colour scale and library locations are controlled in the analysis drawer.",
  openLate:
    "Rings libraries whose recorded hours run past 19:00 on any day, or that open on Sundays.",
  closures:
    "Libraries recorded as permanently closed. They're hidden from the map otherwise.",
  access:
    "Recorded shows libraries that confirm every chosen feature, or any accessibility detail when nothing is chosen. Both adds unconfirmed records; Not yet shows those records on their own. Missing records do not prove a feature is absent.",
  events: "Heatmap of libraries that publish an events feed we sync.",
  complete:
    "How much of each record is filled in: photo, hours, address, facilities, collections, history and contact. A good place to start contributing.",
  perCapita:
    "Compare recorded libraries with the resident population of whole countries or supported local areas. Pro and Team include both libraries per 100k people and people per library. Filters apply; missing records do not prove poor provision.",
  founded:
    "Colour libraries by recorded founding year. A founding date is not a complete history of openings, moves and closures; unknown dates stay visible separately.",
  reach:
    "Choose one library or a library service to estimate the residents within a 5, 10, 15 or 30-minute walk or bike ride. A service uses its mapped reporting area automatically; overlapping catchments count once. Atlas filters apply. Missing routes or population data remain unknown, and routes are not checked for step-free access.",
  coverageGaps:
    "Estimate the number and share of residents beyond a chosen travel time to a recorded library. This needs routing and gridded population data with source years shown. An incomplete library index can overstate gaps; missing records do not prove an area lacks a library.",
  serviceCoverage:
    "Compare the share of library records confirming a selected service or accessibility feature within each area, using the same filters and library types. Show confirmed and unconfirmed records separately with the denominator. Missing information does not prove a service is absent.",
  mobile:
    "Stops and estimated driving routes in timetable order for the selected visit period. Road routes use OpenStreetMap; they may differ from the operator's route. Stops stay visible if routing is unavailable.",
  population:
    "Compare official population averages across supported reporting areas, or explore the 100 m resident grid within them. Automatic detail follows map zoom. Source years stay visible. Library filters do not change population, and the shading can stay beneath Reach.",
  deprivation:
    "Small-area deprivation in England (IMD 2025), Wales (WIMD 2025), Scotland (SIMD 2020v2) and Northern Ireland (NIMDM 2017). Compare areas within the same nation and edition. Show this beneath Reach to explore access in context; ranks do not measure individual residents or library use.",
  carAccess:
    "Share of households with no car or van available in Census 2021, for England and Wales. Compare walking and cycling reach with household transport constraints. These are household figures, not resident counts.",
  transit:
    "Public transport stops and lines from OpenStreetMap and GTFS feeds.",
  schools: "Schools from government registers.",
}

export function AtlasLayersTab({
  tier,
  active,
  onAccessibilityAnalysis,
  accessibilityAnalysisOpen = false,
  onToggle,
  onClear,
  heatOpacity,
  onHeatOpacity,
  onSignIn,
  onSeePlans,
  mobileRouteLines = true,
  onMobileRouteLines,
  mobileOpacity = 1,
  onMobileOpacity,
  perCapita,
  population,
  onContextAnalysis,
  settings: controlledSettings,
  onSettings,
  onEventsFilter,
  onInspect,
  summaries,
}: {
  readonly onInspect?: (id: LayerId) => void
  readonly summaries?: Partial<Record<LayerId, string>>
  readonly tier: Tier
  readonly active: LayerId[]
  readonly onAccessibilityAnalysis: () => void
  readonly accessibilityAnalysisOpen?: boolean
  readonly onToggle: (id: LayerId) => void
  readonly onClear: () => void
  readonly heatOpacity: number
  readonly onHeatOpacity: (value: number) => void
  readonly onSignIn: () => void
  readonly onSeePlans: () => void
  readonly mobileRouteLines?: boolean
  readonly onMobileRouteLines?: (show: boolean) => void
  readonly mobileOpacity?: number
  readonly onMobileOpacity?: (value: number) => void
  readonly perCapita?: LibraryAccessControlsProps
  readonly population?: PopulationControlsProps & {
    onAnalysis: () => void
  }
  readonly onContextAnalysis?: (id: "deprivation" | "carAccess") => void
  readonly settings?: LayerId | null
  readonly onSettings?: (layer: LayerId | null) => void
  readonly onEventsFilter?: () => void
}) {
  const tUi = useUiTranslations("ui")

  const [upsell, setUpsell] = useState<LayerId | null>(null),
    [localSettings, setLocalSettings] = useState<LayerId | null>(null)
  const settingsRef = useRef<HTMLElement>(null),
    upsellRef = useRef<HTMLDivElement>(null)
  const settings =
    controlledSettings === undefined ? localSettings : controlledSettings
  const changeSettings = onSettings ?? setLocalSettings
  const configure = (id: LayerId) => {
    if (id === "access") return onAccessibilityAnalysis()
    if (id === "population" && population) return population.onAnalysis()
    if (id === "deprivation" || id === "carAccess")
      return onContextAnalysis?.(id)
    changeSettings(settings === id ? null : id)
  }
  const toggle = (def: LayerDef) => {
    const access = layerAccess(def, tier)
    switch (access) {
      case "available":
        if (def.id === "perCapita" && !active.includes(def.id))
          changeSettings(def.id)
        onToggle(def.id)
        break

      case "signin":
        if (def.id === "access") onAccessibilityAnalysis()
        else onSignIn()

        break

      case "pro":
        {
          setUpsell(upsell === def.id ? null : def.id)
          // No default
        }
        break
    }
  }
  const configured =
    settings && active.includes(settings) ? layerDef(settings) : null
  const configuredId = configured?.id
  const handleOpenAnalysis = perCapita?.onAnalysis
  useEffect(() => {
    const target = upsell ? upsellRef.current : settingsRef.current
    if (!target) return
    target.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    })
  }, [configuredId, upsell])
  const pinModifiers = pinDependentLayers(active)
  const pinRequirement = pinModifiers.length
    ? `Needed by ${pinModifiers.map((def) => def.name).join(" and ")}`
    : undefined

  const configuration = configured ? (
    <section
      ref={settingsRef}
      id="atlas-layer-settings"
      aria-label={`${configured.name} configuration`}
      className="flex flex-col gap-4 p-4"
      style={{ background: T.bg.surface }}
    >
      <div className="flex items-center justify-between gap-2">
        {configured.id === "perCapita" && perCapita ? (
          <button
            type="button"
            onClick={handleOpenAnalysis}
            className="min-h-11 rounded-full px-4 text-sm font-semibold"
            style={{ background: T.accent.primary, color: "#fff" }}
          >
            Open analysis
          </button>
        ) : (
          <h4 className="type-h4 m-0">{configured.name} settings</h4>
        )}
        {configured.id !== "perCapita" ? (
          <button
            type="button"
            onClick={() => changeSettings(null)}
            aria-label={tUi("close_layer_settings")}
            className="flex size-11 items-center justify-center rounded-full border"
            style={{ borderColor: T.border.hi, color: T.accent.primary }}
          >
            <Icon name="x" size={17} />
          </button>
        ) : null}
      </div>
      {configured.id === "perCapita" && perCapita ? (
        <AtlasPerCapitaControls {...perCapita} showAnalysisLink={false} />
      ) : null}
      {configured.id === "population" && population ? (
        <>
          <AtlasPopulationDensityControls {...population} />
          <button
            type="button"
            onClick={() => population.onAnalysis()}
            className="min-h-11 font-semibold underline"
          >
            Analyse
          </button>
        </>
      ) : null}
      {configured.exclusive === "heat" ? (
        <label className="flex flex-col gap-2 text-sm">
          Opacity · {Math.round(heatOpacity * 100)}%
          <input
            type="range"
            aria-label={`${configured.name} opacity`}
            min={20}
            max={100}
            step={10}
            value={Math.round(heatOpacity * 100)}
            onChange={(event) =>
              onHeatOpacity(Number(event.target.value) / 100)
            }
            className="w-full accent-(--t-accent-primary)"
          />
        </label>
      ) : null}
      {configured.id === "mobile" ? (
        <>
          <div
            aria-label={tUi("mobile_route_key")}
            className="grid grid-cols-2 gap-2 text-xs"
            style={{ color: T.ink.dim }}
          >
            <span className="flex items-center gap-2">
              <i
                className="h-1 w-5 rounded"
                style={{ background: T.map.route }}
              />
              Today, live
            </span>
            <span className="flex items-center gap-2">
              <i
                className="w-5 border-t-2 border-dashed"
                style={{ borderColor: T.map.route }}
              />
              {tUi("timetable")}
            </span>
            <span className="flex items-center gap-2">
              <i
                className="size-3 rounded border-2"
                style={{ borderColor: T.map.stopRing }}
              />
              Stop
            </span>
            <span className="flex items-center gap-2">
              <i
                className="h-3 w-5 rounded-full border-2"
                style={{ borderColor: T.map.stopRing }}
              />
              Vehicle
            </span>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mobileRouteLines}
              onChange={(event) => onMobileRouteLines?.(event.target.checked)}
              className="size-4 accent-(--t-accent-primary)"
            />
            Show route lines
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Opacity · {Math.round(mobileOpacity * 100)}%
            <input
              type="range"
              aria-label={tUi("mobile_layer_opacity")}
              min={0}
              max={100}
              step={5}
              value={Math.round(mobileOpacity * 100)}
              onChange={(event) =>
                onMobileOpacity?.(Number(event.target.value) / 100)
              }
              className="w-full accent-(--t-accent-primary)"
            />
          </label>
        </>
      ) : null}
    </section>
  ) : null

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-h2 m-0">
          Layers{" "}
          <span
            className="ml-1 text-sm font-normal"
            style={{ color: T.ink.dim }}
          >
            {active.length ? `${active.length} on` : "None on"}
          </span>
        </h2>
        {active.length > 1 ? (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 text-sm font-semibold underline"
            style={{ color: T.accent.primary }}
          >
            Turn all off
          </button>
        ) : null}
      </div>
      {LAYER_GROUPS.map((group) => {
        const definitions = LAYERS.filter((layer) => layer.group === group.id)
        if (!definitions.length) return null

        return (
          <section key={group.id} aria-labelledby={`atlas-layers-${group.id}`}>
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-b border-(--t-border-line) pb-2.5">
              <h3
                id={`atlas-layers-${group.id}`}
                className="type-label m-0 uppercase"
                style={{ color: T.ink.dim }}
              >
                {group.name}
              </h3>
              {group.id === "characteristics" ||
              group.id === "patterns" ||
              group.id === "coverage" ||
              group.id === "reference" ? (
                <span
                  className="max-w-[145px] text-xs leading-5"
                  style={{ color: T.ink.dim }}
                >
                  {group.id === "characteristics"
                    ? "One pin style at a time"
                    : group.id === "patterns"
                      ? "One heat layer at a time"
                      : group.id === "reference"
                        ? "One background layer at a time"
                        : "Reach can overlay one background layer"}
                </span>
              ) : null}
            </div>
            <div>
              {definitions.map((def) => (
                <LayerRow
                  key={def.id}
                  def={def}
                  summary={summaries?.[def.id]}
                  onOpen={
                    onInspect &&
                    active.includes(def.id) &&
                    [
                      "reach",
                      "perCapita",
                      "population",
                      "deprivation",
                      "carAccess",
                      "access",
                      "mobile",
                      "density",
                      "events",
                    ].includes(def.id)
                      ? () => onInspect(def.id)
                      : undefined
                  }
                  access={layerAccess(def, tier)}
                  checked={def.ready && active.includes(def.id)}
                  pinRequirement={
                    def.id === "pins" ? pinRequirement : undefined
                  }
                  onToggle={() => toggle(def)}
                  onAnalysis={
                    def.id === "access" &&
                    tier === "public" &&
                    !active.includes("access")
                      ? onAccessibilityAnalysis
                      : undefined
                  }
                  analysisOpen={accessibilityAnalysisOpen}
                  onConfigure={
                    !onInspect &&
                    active.includes(def.id) &&
                    (def.id === "perCapita" ||
                      def.id === "deprivation" ||
                      def.id === "carAccess" ||
                      def.id === "population" ||
                      def.id === "mobile" ||
                      def.exclusive === "heat")
                      ? () => configure(def.id)
                      : undefined
                  }
                  settingsOpen={configured?.id === def.id}
                >
                  {configured?.id === def.id ? configuration : null}
                </LayerRow>
              ))}
            </div>
            {group.id === "characteristics" && onEventsFilter ? (
              <button
                type="button"
                onClick={onEventsFilter}
                className="mt-1 flex min-h-16 w-full items-center justify-between gap-3 border-t py-3 text-left"
                style={{ borderColor: T.border.divider }}
              >
                <span className="text-sm font-semibold">
                  Events and activities
                  <small
                    className="mt-1 block text-xs font-normal"
                    style={{ color: T.ink.dim }}
                  >
                    Find libraries with upcoming events
                  </small>
                </span>
                <span
                  className="shrink-0 px-1 text-xs font-semibold underline underline-offset-4"
                  style={{ color: T.accent.primary }}
                >
                  {tUi("filters")} <span aria-hidden="true">→</span>
                </span>
              </button>
            ) : null}
            {upsell && definitions.some((def) => def.id === upsell) ? (
              <div
                ref={upsellRef}
                role="status"
                className="mt-2 rounded-xl p-3 text-sm"
                style={{ background: T.accent.chip }}
              >
                <p className="mt-0 mb-2">
                  <strong>{layerDef(upsell).name}</strong> is included with Pro
                  and Team.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onSeePlans}
                    className="min-h-11 font-semibold underline"
                  >
                    Compare plans
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpsell(null)}
                    className="min-h-11"
                  >
                    Not now
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )
      })}
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        Library facts are always free. Pro and Team add analysis and licensed
        context data.{" "}
        <button
          type="button"
          onClick={onSeePlans}
          className="font-semibold underline underline-offset-2"
          style={{ color: T.accent.primary }}
        >
          Compare plans
        </button>
      </p>
    </div>
  )
}

function LayerRow({
  def,
  summary,
  onOpen,
  access,
  checked,
  onToggle,
  onAnalysis,
  analysisOpen,
  pinRequirement,
  onConfigure,
  settingsOpen,
  children,
}: {
  readonly summary?: string
  readonly onOpen?: () => void
  readonly def: LayerDef
  readonly access: LayerAccess
  readonly checked: boolean
  readonly onToggle: () => void
  readonly onAnalysis?: () => void
  readonly analysisOpen?: boolean
  readonly pinRequirement?: string
  readonly onConfigure?: () => void
  readonly settingsOpen?: boolean
  readonly children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const [about, setAbout] = useState(false)
  const expandable = !pinRequirement
  const label = (
    <span className="block min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-5 font-semibold">
        <span>{def.name}</span>
        {def.tier === "pro" ? <ProChip locked={false} soft /> : null}
        {def.tier === "free" && def.ready ? (
          <MutedChip>{tUi("account")}</MutedChip>
        ) : null}
        {!def.ready ? (
          <span aria-label={`${def.name} availability`}>
            <MutedChip>{tUi("coming_soon")}</MutedChip>
          </span>
        ) : null}
      </span>
      <span
        id={pinRequirement ? "atlas-pins-required" : undefined}
        className="mt-0.5 block text-xs leading-5 font-normal text-(--t-ink-dim)"
      >
        {pinRequirement ?? summary ?? def.sub}
      </span>
    </span>
  )

  return (
    <div
      data-layer={def.id}
      className="border-b last:border-b-0"
      style={{ borderColor: T.border.divider }}
    >
      <div className="flex items-center gap-2.5 py-3">
        <Switch
          checked={checked}
          onChange={onToggle}
          variant="layer"
          label={`${def.name}${access === "pro" ? " (Pro)" : access === "signin" ? " (sign in to use)" : ""}`}
          locked={access === "pro"}
          disabled={access === "soon" || Boolean(pinRequirement)}
          descriptionId={pinRequirement ? "atlas-pins-required" : undefined}
        />
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${def.name}`}
            title={`Open ${def.name}`}
            className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
          >
            {label}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--t-accent-chip) text-(--t-accent-primary) group-hover:bg-(--t-bg-selected)">
              <Icon name="panel" size={17} />
            </span>
          </button>
        ) : (
          label
        )}
        {pinRequirement ? (
          <span
            title={pinRequirement}
            className="flex h-11 w-8 shrink-0 items-center justify-center text-(--t-ink-low)"
          >
            <Icon name="lock" size={15} />
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-0.5">
          {expandable ? (
            <button
              type="button"
              onClick={onConfigure ?? (() => setAbout(!about))}
              aria-label={
                onConfigure ? `Configure ${def.name}` : `About ${def.name}`
              }
              aria-expanded={Boolean(settingsOpen || about)}
              aria-controls={
                onConfigure
                  ? "atlas-layer-settings"
                  : `atlas-layer-about-${def.id}`
              }
              className="flex h-11 w-7 shrink-0 items-center justify-center rounded-full hover:bg-(--t-bg-surface)"
              style={{ color: T.ink.dim }}
            >
              <Icon
                name="chevD"
                size={17}
                className={settingsOpen || about ? "rotate-180" : ""}
              />
            </button>
          ) : null}
          {onAnalysis ? (
            <button
              type="button"
              aria-label={
                analysisOpen
                  ? "Close accessibility analysis"
                  : "Open accessibility analysis"
              }
              aria-expanded={analysisOpen}
              aria-controls="atlas-analysis-panel"
              onClick={onAnalysis}
              className="flex h-11 w-8 shrink-0 items-center justify-center rounded-full hover:bg-(--t-bg-surface)"
              style={{ color: T.ink.dim }}
            >
              <Icon name={analysisOpen ? "minus" : "plus"} size={17} />
            </button>
          ) : null}
        </div>
      </div>
      {about && !settingsOpen ? (
        <p
          id={`atlas-layer-about-${def.id}`}
          className="m-0 border-t px-4 py-3 text-sm leading-relaxed"
          style={{
            borderColor: T.border.divider,
            background: T.bg.surface,
            color: T.ink.dim,
          }}
        >
          {ABOUT[def.id]}
        </p>
      ) : null}
      {children ? (
        <div className="border-t" style={{ borderColor: T.border.divider }}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
