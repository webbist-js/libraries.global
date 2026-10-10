"use client"

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

const ABOUT: Record<LayerId, string> = {
  pins: "Library locations recorded in the index. The library-type key in Filters controls which types are shown.",
  density:
    "Where libraries cluster. Shown as a heatmap when zoomed out; individual libraries take over as you zoom in.",
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
    "Estimate walking or cycling times along routes to recorded libraries, with a chosen time limit. Population within overlapping catchments would be counted once. Travel times are estimates, not guarantees of a step-free route.",
  coverageGaps:
    "Estimate the number and share of residents beyond a chosen travel time to a recorded library. This needs routing and gridded population data with source years shown. An incomplete library index can overstate gaps; missing records do not prove an area lacks a library.",
  serviceCoverage:
    "Compare the share of library records confirming a selected service or accessibility feature within each area, using the same filters and library types. Show confirmed and unconfirmed records separately with the denominator. Missing information does not prove a service is absent.",
  mobile:
    "Stops and estimated driving routes in timetable order for the selected visit period. Road routes use OpenStreetMap; they may differ from the operator's route. Stops stay visible if routing is unavailable.",
  population:
    "Resident population density from the Global Human Settlement Layer.",
  deprivation:
    "Area deprivation indices for the UK nations (IMD, SIMD, WIMD), with source dates. Indices use different methods and should be compared within the same nation and edition.",
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
  settings: controlledSettings,
  onSettings,
  onEventsFilter,
}: {
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
  readonly settings?: LayerId | null
  readonly onSettings?: (layer: LayerId | null) => void
  readonly onEventsFilter?: () => void
}) {
  const [upsell, setUpsell] = useState<LayerId | null>(null),
    [localSettings, setLocalSettings] = useState<LayerId | null>(null)
  const settingsRef = useRef<HTMLElement>(null),
    upsellRef = useRef<HTMLDivElement>(null)
  const settings =
    controlledSettings === undefined ? localSettings : controlledSettings
  const changeSettings = onSettings ?? setLocalSettings
  const configure = (id: LayerId) => {
    if (id === "access") return onAccessibilityAnalysis()
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
          <h4 className="m-0 text-sm font-bold">{configured.name} settings</h4>
        )}
        <button
          type="button"
          onClick={() => changeSettings(null)}
          aria-label="Close layer settings"
          className="flex size-11 items-center justify-center rounded-full border"
          style={{ borderColor: T.border.hi, color: T.accent.primary }}
        >
          <Icon
            name={configured.id === "perCapita" ? "settings" : "x"}
            size={17}
          />
        </button>
      </div>
      {configured.id === "perCapita" && perCapita ? (
        <AtlasPerCapitaControls {...perCapita} showAnalysisLink={false} />
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
            aria-label="Mobile route key"
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
              Timetable
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
              aria-label="Mobile layer opacity"
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2
          className="m-0 text-[30px] leading-tight"
          style={{ fontFamily: T.font.serif }}
        >
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
            Clear layers
          </button>
        ) : null}
      </div>
      {active.length ? (
        <section aria-labelledby="atlas-active-layers">
          <h3
            id="atlas-active-layers"
            className="m-0 mb-2 text-sm font-bold"
            style={{ color: T.ink.dim }}
          >
            Active layers
          </h3>
          <div
            className="rounded-[20px] border px-2"
            style={{ borderColor: T.border.hi, background: T.bg.surface }}
          >
            {active.map((id) => {
              const def = layerDef(id),
                locationRequirement =
                  id === "pins" ? pinRequirement : undefined,
                configurable =
                  id === "access" ||
                  id === "perCapita" ||
                  id === "mobile" ||
                  def.exclusive === "heat"

              return (
                <div
                  key={id}
                  className="flex min-h-14 items-center gap-2 border-b px-2 py-1 text-sm last:border-b-0"
                  style={{ borderColor: T.border.divider }}
                >
                  <Icon name="check" size={15} color={T.accent.primary} />
                  <span className="min-w-0 flex-1 font-semibold">
                    {def.name}
                  </span>
                  {id === "perCapita" && perCapita ? (
                    <button
                      type="button"
                      onClick={handleOpenAnalysis}
                      className="min-h-9 rounded-full px-3 text-xs font-semibold"
                      style={{ background: T.accent.primary, color: "#fff" }}
                    >
                      Analyse
                    </button>
                  ) : null}
                  {configurable ? (
                    <button
                      type="button"
                      onClick={() => configure(id)}
                      aria-label={
                        id === "access"
                          ? accessibilityAnalysisOpen
                            ? "Close accessibility analysis"
                            : "Open accessibility analysis"
                          : `Configure ${def.name}`
                      }
                      aria-expanded={
                        id === "access"
                          ? accessibilityAnalysisOpen
                          : settings === id
                      }
                      aria-controls={
                        id === "access"
                          ? "atlas-analysis-panel"
                          : "atlas-layer-settings"
                      }
                      className={
                        id === "access"
                          ? "min-h-9 shrink-0 rounded-full border bg-white px-3 text-xs font-semibold"
                          : "flex size-9 shrink-0 items-center justify-center rounded-full border bg-white"
                      }
                      style={{ borderColor: T.border.hi }}
                    >
                      {id === "access" ? (
                        "Features"
                      ) : (
                        <Icon
                          name={id === "perCapita" ? "settings" : "filter"}
                          size={17}
                        />
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onToggle(id)}
                    aria-label={`Disable ${def.name}`}
                    aria-describedby={
                      locationRequirement ? "atlas-pins-required" : undefined
                    }
                    disabled={Boolean(locationRequirement)}
                    title={locationRequirement}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <Icon name={locationRequirement ? "lock" : "x"} size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
      {LAYER_GROUPS.map((group) => {
        const definitions = LAYERS.filter((layer) => layer.group === group.id)
        if (!definitions.length) return null

        return (
          <section key={group.id} aria-labelledby={`atlas-layers-${group.id}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3
                id={`atlas-layers-${group.id}`}
                className="m-0 text-sm font-bold"
                style={{ color: T.ink.dim }}
              >
                {group.name}
              </h3>
              {group.id === "coverage" ? (
                <span
                  className="text-right text-xs"
                  style={{ color: T.ink.dim }}
                >
                  One area layer at a time
                </span>
              ) : null}
            </div>
            <div
              className="overflow-hidden rounded-[20px] border"
              style={{ borderColor: T.border.hi, background: "#fff" }}
            >
              {definitions.map((def) => (
                <LayerRow
                  key={def.id}
                  def={def}
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
                    active.includes(def.id) &&
                    (def.id === "perCapita" ||
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
                className="mt-4 flex min-h-20 w-full items-center justify-between gap-3 rounded-[20px] border p-4 text-left"
                style={{ borderColor: T.border.hi }}
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
                  className="shrink-0 rounded-full border px-3 py-2 text-xs font-semibold"
                  style={{ color: T.accent.primary, borderColor: T.border.hi }}
                >
                  Filters <span aria-hidden="true">→</span>
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
  const [about, setAbout] = useState(false)
  const expandable =
    !def.ready || def.id === "perCapita" || Boolean(onConfigure)

  return (
    <div
      data-layer={def.id}
      className="border-b last:border-b-0"
      style={{ borderColor: T.border.divider }}
    >
      <div className="flex items-center gap-3 px-3 py-3">
        <Switch
          checked={checked}
          onChange={onToggle}
          variant="layer"
          label={`${def.name}${access === "pro" ? " (Pro)" : access === "signin" ? " (sign in to use)" : ""}`}
          locked={access === "pro"}
          disabled={access === "soon" || Boolean(pinRequirement)}
          descriptionId={pinRequirement ? "atlas-pins-required" : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            <span>{def.name}</span>
            {def.tier === "pro" ? <ProChip locked={false} soft /> : null}
          </div>
          <p
            id={pinRequirement ? "atlas-pins-required" : undefined}
            className="mt-1 mb-0 text-xs leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            {pinRequirement ?? def.sub}
          </p>
          {!def.ready ? (
            <div
              className="mt-2 flex flex-wrap items-center gap-1.5"
              aria-label={`${def.name} availability`}
            >
              <MutedChip>Coming soon</MutedChip>
            </div>
          ) : null}
        </div>
        {expandable ? (
          <button
            type="button"
            onClick={onConfigure ?? (() => setAbout(!about))}
            aria-label={
              onConfigure ? `Configure ${def.name}` : `About ${def.name}`
            }
            aria-expanded={Boolean(settingsOpen || about)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
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
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ color: T.ink.dim }}
          >
            <Icon name={analysisOpen ? "minus" : "plus"} size={17} />
          </button>
        ) : null}
      </div>
      {about && !settingsOpen ? (
        <p
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
