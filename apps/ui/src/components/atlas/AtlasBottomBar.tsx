"use client"

import { ATLAS_ACCESS_BINS, type AtlasAccessMetric } from "@repo/shared-data"
import { useRef, type ReactNode } from "react"

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

/** Legends for the pins and every active layer, in stacking order. */
export function AtlasLegends({
  groups,
  layers,
  accessibility = [],
  accessibilityView = "matches",
  accessMetric = "per100k",
}: {
  readonly groups: TypeGroupKey[]
  readonly layers: LayerId[]
  readonly accessibility?: string[]
  readonly accessibilityView?: AccessibilityView
  readonly accessMetric?: AtlasAccessMetric
  readonly perCapitaYear?: number
}) {
  const on = (id: LayerId) => layers.includes(id)
  const items: React.ReactNode[] = []

  if (on("pins") && !on("complete") && !on("access") && groups.length > 0)
    items.push(
      <KeyLegend
        key="pins"
        title="Libraries"
        source="Community records · live"
        items={TYPE_GROUPS.filter((g) => groups.includes(g.key)).map((g) => ({
          key: g.key,
          label: g.label.split(" ")[0]!,
          swatch: <PinGlyph group={g.key} />,
        }))}
      />
    )
  if (on("density"))
    items.push(
      <RampLegend
        key="density"
        title="Library density"
        source="Relative · community records"
        ramp="heat"
        ticks={["Low", "", "", "High"]}
        width={150}
      />
    )
  if (on("events"))
    items.push(
      <RampLegend
        key="events"
        title="Events density"
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
        title="Record completeness"
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
        title="Library access"
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
        title="Open late or Sundays"
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
        title="Closures"
        source="Recorded as permanently closed"
        items={[
          {
            key: "x",
            label: "Closed",
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
}: {
  readonly count: number
  readonly sub: string
}) {
  return (
    <p className="m-0 text-[15px] whitespace-nowrap" aria-live="polite">
      <strong
        className="text-[22px] font-medium"
        style={{ fontFamily: T.font.serif }}
      >
        {count.toLocaleString()}
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
  return (
    <Segmented
      label="View"
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
}: {
  readonly layers: readonly LayerId[]
  readonly metric: AtlasAccessMetric
  readonly accessibilityView: AccessibilityView
  readonly children: ReactNode
}) {
  const disclosure = useRef<HTMLDetailsElement>(null)
  const area = layers.includes("perCapita"),
    access = layers.includes("access")
  const heat = layers.includes("density") || layers.includes("events")
  if (!layers.length) return null

  return (
    <div className="flex shrink-0 items-center gap-3">
      <details
        ref={disclosure}
        className="relative"
        onKeyDown={(event) => {
          if (event.key === "Escape" && disclosure.current?.open) {
            disclosure.current.open = false
            disclosure.current.querySelector("summary")?.focus()
          }
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <Icon name="layers" size={17} />
          Map key
          <Icon name="chevD" size={14} />
        </summary>
        <div
          role="region"
          aria-label="Active map key"
          className="absolute bottom-[calc(100%+16px)] left-0 flex max-h-[45vh] w-[min(380px,calc(100vw-48px))] flex-col gap-4 overflow-auto rounded-2xl border bg-white p-4 shadow-lg"
          style={{ borderColor: T.border.hi }}
        >
          {children}
        </div>
      </details>
      {area ? (
        <div
          aria-label={
            metric === "per100k"
              ? "Library access: darker means more recorded libraries per resident"
              : "Library access: darker means fewer residents per recorded library"
          }
          className="flex w-[150px] flex-col gap-1 text-xs"
        >
          <strong>Library access</strong>
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
      ) : access ? (
        <div className="flex flex-col gap-1 text-xs">
          <strong>Accessibility</strong>
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
      ) : heat ? (
        <RampLegend
          title={
            layers.includes("events") ? "Events density" : "Library density"
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
