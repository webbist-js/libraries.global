"use client"

import {
  ATLAS_ACCESS_BINS,
  type AtlasAccessMetric,
  type AtlasLibraryDensity,
  type AtlasDensitySettings,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AtlasContextRelease } from "@/lib/atlas-context"
import { T } from "@/lib/design-tokens"

import { INDIGO } from "./atlas-map.style"
import { Icon, KeyLegend, PinGlyph, RampLegend, Segmented } from "./atlas-ui"
import {
  type LayerId,
  TYPE_GROUPS,
  type TypeGroupKey,
  type AccessibilityView,
} from "./atlas.logic"
import { AccessibilitySwatch } from "./AtlasAccessibility"
import { AtlasContextLegend } from "./AtlasContext"
import { AtlasLibraryDensityLegend } from "./AtlasLibraryDensity"

/** Legends for the pins and every active layer, in stacking order. */
export function AtlasLegends({
  groups,
  layers,
  accessibility = [],
  accessibilityView = "matches",
  accessMetric = "per100k",
  density,
  context,
  reach,
}: {
  readonly groups: TypeGroupKey[]
  readonly layers: LayerId[]
  readonly accessibility?: string[]
  readonly accessibilityView?: AccessibilityView
  readonly density?: {
    data: AtlasLibraryDensity | null
    settings: AtlasDensitySettings
  }
  readonly accessMetric?: AtlasAccessMetric
  readonly perCapitaYear?: number
  readonly context?: AtlasContextRelease | null
  readonly reach?: {
    mode: string
    minutes: number
    year?: number | null
    gaps: boolean
    state?: string
  }
}) {
  const tUi = useUiTranslations("ui")
  const tContext = useUiTranslations("atlasContext")

  const on = (id: LayerId) => layers.includes(id)
  const items: React.ReactNode[] = []
  if (context || on("population")) {
    const theme =
      context?.theme === "deprivation" || context?.theme === "carAccess"
        ? context.theme
        : "population"
    items.push(
      <div key="context" className="w-60">
        <p className="mt-0 mb-1 text-sm font-semibold">{tContext(theme)}</p>
        <p className="mt-0 mb-3 text-xs text-(--t-ink-dim)">
          {context?.edition ?? tContext("officialTotals")}
        </p>
        <AtlasContextLegend
          theme={theme}
          missing={context ? "transparent" : "grey"}
        />
      </div>
    )
  }

  if (on("reach"))
    items.push(
      <KeyLegend
        key="reach"
        title={`Reach · ${reach?.mode === "cycling" ? "Cycling" : "Walking"} · ${reach?.minutes ?? 15} min`}
        source={
          reach?.year
            ? `OSM routing · ${reach.year} population grid`
            : "OSM routing · population year unavailable"
        }
        items={[
          {
            key: "catchment",
            label:
              reach?.state === "ready" || reach?.state === "partial"
                ? "Modelled catchment · not observed use"
                : reach?.state === "pending"
                  ? "Calculating catchment"
                  : "Catchment not available yet",
            swatch: (
              <i
                className="inline-block h-3.5 w-4 rounded border-2"
                style={{
                  borderColor: INDIGO,
                  background: "rgba(67,56,202,0.22)",
                }}
              />
            ),
          },
          ...(reach?.gaps
            ? [
                {
                  key: "beyond",
                  label: `Beyond ${reach.minutes} minutes · reporting area`,
                  swatch: (
                    <i className="inline-block h-3.5 w-4 rounded bg-(--t-border-hi)" />
                  ),
                },
              ]
            : []),
        ]}
      />
    )
  if (on("pins") && !on("complete") && !on("access") && groups.length > 0)
    items.push(
      <KeyLegend
        key="pins"
        title={tUi("libraries")}
        source="Community records · live"
        items={TYPE_GROUPS.filter((g) => groups.includes(g.key)).map((g) => ({
          key: g.key,
          label: g.label.split(" ")[0]!,
          swatch: <PinGlyph group={g.key} />,
        }))}
      />
    )
  if (on("density") && density)
    items.push(
      <div key="density" className="w-60">
        <p className="mt-0 mb-3 text-sm font-semibold">
          {tUi("library_density")}
        </p>
        <AtlasLibraryDensityLegend {...density} />
      </div>
    )
  if (on("events"))
    items.push(
      <RampLegend
        key="events"
        title={tUi("events_density")}
        source="Libraries with an events feed"
        ramp="heat"
        ticks={["Low", "", "", "High"]}
        width={150}
      />
    )
  if (on("complete"))
    items.push(
      <RampLegend
        key="complete"
        title={tUi("record_completeness")}
        source="Share of 8 sections filled in"
        ramp="seq"
        ticks={["0%", "50%", "100%"]}
        width={150}
      />
    )
  if (on("access"))
    items.push(
      <KeyLegend
        key="access"
        title={`Accessibility · ${accessibilityView === "matches" ? "Confirmed only" : accessibilityView === "compare" ? "Comparison" : "Unconfirmed only"}`}
        source={
          accessibility.length
            ? accessibility.slice(0, 2).join(" + ") +
              (accessibility.length > 2
                ? ` + ${accessibility.length - 2} more`
                : "")
            : "Any recorded accessibility feature"
        }
        items={[
          ...(accessibilityView !== "gaps"
            ? [
                {
                  key: "y",
                  label: accessibility.length
                    ? "All selected confirmed"
                    : "Feature recorded",
                  swatch: <AccessibilitySwatch confirmed />,
                },
              ]
            : []),
          ...(accessibilityView !== "matches"
            ? [
                {
                  key: "n",
                  label: "Not confirmed",
                  swatch: <AccessibilitySwatch confirmed={false} />,
                },
              ]
            : []),
          ...(accessibilityView === "compare"
            ? [
                {
                  key: "cluster",
                  label: "Clusters: matches / records",
                  swatch: null,
                },
              ]
            : []),
        ]}
      />
    )
  if (on("perCapita"))
    items.push(
      <KeyLegend
        key="access-area"
        title={tUi("library_access")}
        source={
          accessMetric === "per100k"
            ? "Recorded libraries / 100k residents"
            : "Residents / recorded library"
        }
        items={[
          ...ATLAS_ACCESS_BINS.map((bin) => ({
            key: bin.label,
            label: accessMetric === "per100k" ? bin.label : bin.inverse,
            swatch: (
              <i
                aria-hidden="true"
                className="inline-block h-3.5 w-4 rounded border border-black/10"
                style={{ background: bin.color }}
              />
            ),
          })),
          {
            key: "few",
            label: "Few records",
            swatch: (
              <i
                aria-hidden="true"
                className="inline-block h-3.5 w-4 rounded"
                style={{
                  background:
                    "repeating-linear-gradient(135deg,#bdb7ed 0px,#bdb7ed 4px,#7d71bd 4px,#7d71bd 5px)",
                }}
              />
            ),
          },
          {
            key: "unknown",
            label: "No data",
            swatch: (
              <i
                aria-hidden="true"
                className="inline-block h-3.5 w-4 rounded border border-dashed border-black/30"
                style={{ background: "#D8D4CA" }}
              />
            ),
          },
        ]}
      />
    )
  if (on("openLate"))
    items.push(
      <KeyLegend
        key="late"
        title={tUi("open_late_or_sundays")}
        source="From recorded hours"
        items={[
          {
            key: "late",
            label: "After 19:00 or Sundays",
            swatch: (
              <i
                aria-hidden="true"
                className="inline-block size-3.5 rounded-full"
                style={{
                  background: "rgba(67,56,202,.14)",
                  border: `2px solid ${INDIGO}`,
                }}
              />
            ),
          },
        ]}
      />
    )
  if (on("closures"))
    items.push(
      <KeyLegend
        key="closures"
        title={tUi("closures")}
        source="Recorded as permanently closed"
        items={[
          {
            key: "x",
            label: tUi("closed"),
            swatch: (
              <i
                aria-hidden="true"
                className="inline-flex size-3.5 items-center justify-center rounded-full text-[10px] leading-none font-bold"
                style={{
                  border: "1.5px solid #A13A1A",
                  color: "#A13A1A",
                  background: "#fff",
                }}
              >
                ×
              </i>
            ),
          },
        ]}
      />
    )

  return (
    <>
      {items.map((node, i) => (
        <div key={i} className="flex items-center gap-[18px]">
          {i > 0 ? (
            <span
              className="w-px self-stretch"
              style={{ background: T.border.divider }}
            />
          ) : null}
          {node}
        </div>
      ))}
    </>
  )
}

export function AtlasCount({
  count,
  sub,
  loading = false,
}: {
  readonly count: number
  readonly loading?: boolean
  readonly sub: string
}) {
  return (
    <p
      className="m-0 text-[15px] whitespace-nowrap"
      aria-live="polite"
      aria-busy={loading}
    >
      <strong
        className="text-[22px] font-medium"
        style={{ fontFamily: T.font.serif }}
      >
        {loading ? (
          <>
            <span aria-hidden="true">…</span>
            <span className="sr-only">Loading result count</span>
          </>
        ) : (
          count.toLocaleString()
        )}
      </strong>{" "}
      {sub}
    </p>
  )
}

export function ViewToggle({
  list,
  onChange,
}: {
  readonly list: boolean
  readonly onChange: (list: boolean) => void
}) {
  const tUi = useUiTranslations("ui")

  return (
    <Segmented
      label={tUi("view")}
      value={list ? "list" : "map"}
      onChange={(v) => onChange(v === "list")}
      options={[
        { value: "map", label: "Map", icon: "map" },
        { value: "list", label: "List", icon: "list" },
      ]}
    />
  )
}

/** Detailed keys are available without covering the map with every classification. */
export function AtlasMapLegend({
  layers,
  metric,
  accessibilityView,
  children,
  compact = false,
  placement = "above",
}: {
  readonly layers: readonly LayerId[]
  readonly metric: AtlasAccessMetric
  readonly accessibilityView: AccessibilityView
  readonly placement?: "above" | "below"
  readonly compact?: boolean
  readonly children: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const area = layers.includes("perCapita"),
    access = layers.includes("access")
  const heat = layers.includes("density") || layers.includes("events")
  if (!layers.length) return null

  return (
    <div className="flex shrink-0 items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"
          >
            <Icon name="layers" size={17} />
            Map key
            <Icon name="chevD" size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={placement === "above" ? "top" : "bottom"}
          align="start"
          collisionPadding={16}
          sideOffset={12}
          aria-label={tUi("active_map_key")}
          className="z-[90] grid max-h-[min(55dvh,480px)] w-[min(640px,calc(100vw-32px))] gap-4 overflow-y-auto overscroll-contain rounded-2xl border-(--t-border-hi) bg-white p-5 shadow-lg sm:grid-cols-2"
        >
          {children}
        </PopoverContent>
      </Popover>
      {!compact && area ? (
        <div
          aria-label={
            metric === "per100k"
              ? "Library access: darker means more recorded libraries per resident"
              : "Library access: darker means fewer residents per recorded library"
          }
          className="flex w-[150px] flex-col gap-1 text-xs"
        >
          <strong>{tUi("library_access")}</strong>
          <span
            aria-hidden="true"
            className="flex h-2.5 overflow-hidden rounded"
          >
            {ATLAS_ACCESS_BINS.map((bin) => (
              <i
                key={bin.label}
                className="flex-1"
                style={{ background: bin.color }}
              />
            ))}
          </span>
          <span className="flex justify-between" style={{ color: T.ink.dim }}>
            <span>{metric === "per100k" ? "Under 2" : "Over 50k"}</span>
            <span>{metric === "per100k" ? "12+ / 100k" : "Up to 8.3k"}</span>
          </span>
        </div>
      ) : !compact && access ? (
        <div className="flex flex-col gap-1 text-xs">
          <strong>{tUi("accessibility")}</strong>
          <span className="flex items-center gap-2">
            {accessibilityView !== "gaps" ? (
              <AccessibilitySwatch confirmed />
            ) : null}
            {accessibilityView !== "matches" ? (
              <AccessibilitySwatch confirmed={false} />
            ) : null}
            {accessibilityView === "compare"
              ? "Confirmed / records"
              : accessibilityView === "gaps"
                ? "Unconfirmed only"
                : "Confirmed only"}
          </span>
        </div>
      ) : !compact && heat ? (
        <RampLegend
          title={
            layers.includes("events")
              ? tUi("events_density")
              : tUi("library_density")
          }
          source="Recorded libraries"
          ramp="heat"
          ticks={["Low", "High"]}
          width={100}
        />
      ) : null}
    </div>
  )
}
