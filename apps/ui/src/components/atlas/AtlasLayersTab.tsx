"use client"

import { useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"

import { Icon, MutedChip, ProChip, Switch } from "./atlas-ui"
import {
  type LayerAccess,
  layerAccess,
  type LayerDef,
  type LayerId,
  LAYERS,
  type Tier,
} from "./atlas.logic"

/** Plain-language notes behind each layer's info button. */
const ABOUT: Record<LayerId, string> = {
  density:
    "Where libraries cluster. Shown as a heatmap when zoomed out; individual libraries take over as you zoom in.",
  openLate:
    "Rings libraries whose recorded hours run past 19:00 on any day, or that open on Sundays.",
  closures:
    "Libraries recorded as permanently closed. They're hidden from the map otherwise.",
  access:
    "Green where step-free entry (wheelchair access, level access, ramp or lift) is recorded; grey where it isn't recorded yet, which doesn't mean it's missing.",
  events: "Heatmap of libraries that publish an events feed we sync.",
  complete:
    "How much of each record is filled in: photo, hours, address, facilities, collections, history and contact. A good place to start contributing.",
  perCapita:
    "Libraries per 100,000 residents by council area, using official population estimates.",
  founded: "Colour libraries by founding year and play back how networks grew.",
  mobile: "Mobile library routes and stops, with visit schedules.",
  population:
    "Resident population density from the Global Human Settlement Layer.",
  deprivation: "Area deprivation indices for the UK nations (IMD, SIMD, WIMD).",
  transit:
    "Public transport stops and lines from OpenStreetMap and GTFS feeds.",
  schools: "Schools from government registers.",
}

export function AtlasLayersTab({
  tier,
  active,
  onToggle,
  heatOpacity,
  onHeatOpacity,
  onSignIn,
  onSeePlans,
}: {
  readonly tier: Tier
  readonly active: LayerId[]
  readonly onToggle: (id: LayerId) => void
  readonly heatOpacity: number
  readonly onHeatOpacity: (v: number) => void
  readonly onSignIn: () => void
  readonly onSeePlans: () => void
}) {
  const [upsell, setUpsell] = useState<LayerId | null>(null)
  const on = active.length

  const row = (def: LayerDef) => (
    <LayerRow
      key={def.id}
      def={def}
      access={layerAccess(def, tier)}
      checked={active.includes(def.id)}
      showUpsell={upsell === def.id}
      heatOpacity={heatOpacity}
      onHeatOpacity={onHeatOpacity}
      onToggle={() => {
        const access = layerAccess(def, tier)
        switch (access) {
          case "available":
            onToggle(def.id)
            break

          case "signin":
            onSignIn()
            break

          case "pro":
            {
              setUpsell((u) => (u === def.id ? null : def.id))
              // No default
            }
            break
        }
      }}
      onSeePlans={onSeePlans}
      onDismissUpsell={() => setUpsell(null)}
    />
  )

  return (
    <div className="flex flex-col">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="m-0 text-[15px] font-bold">
          {on === 0
            ? "No layers on"
            : `${on} ${on === 1 ? "layer" : "layers"} on`}
        </p>
        {on > 0 ? (
          <button
            type="button"
            onClick={() => active.forEach(onToggle)}
            className="text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: "#3730A3" }}
          >
            Turn all off
          </button>
        ) : null}
      </div>
      <h3
        className="mt-1 mb-0 text-[13px] font-bold"
        style={{ color: T.ink.dim }}
      >
        Libraries
      </h3>
      {LAYERS.filter((l) => l.group === "libraries").map(row)}
      <h3
        className="mt-3 mb-0 flex items-center justify-between text-[13px] font-bold"
        style={{ color: T.ink.dim }}
      >
        Context <span className="font-medium">One area shading at a time</span>
      </h3>
      {LAYERS.filter((l) => l.group === "context").map(row)}
      <p
        className="mt-3 mb-0 text-[13px] leading-normal"
        style={{ color: T.ink.dim }}
      >
        Library facts are always free. Pro will add analysis and licensed
        context data.{" "}
        <button
          type="button"
          onClick={onSeePlans}
          className="font-semibold underline underline-offset-2"
          style={{ color: "#3730A3" }}
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
  showUpsell,
  heatOpacity,
  onHeatOpacity,
  onToggle,
  onSeePlans,
  onDismissUpsell,
}: {
  readonly def: LayerDef
  readonly access: LayerAccess
  readonly checked: boolean
  readonly showUpsell: boolean
  readonly heatOpacity: number
  readonly onHeatOpacity: (v: number) => void
  readonly onToggle: () => void
  readonly onSeePlans: () => void
  readonly onDismissUpsell: () => void
}) {
  const [info, setInfo] = useState(false)
  const upsellRef = useRef<HTMLDivElement>(null)
  const dim = access !== "available" && !checked

  // The upsell opens under rows near the bottom of the panel; bring it into view.
  useEffect(() => {
    if (!showUpsell) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    upsellRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    })
  }, [showUpsell])
  const infoId = `layer-info-${def.id}`

  return (
    <div
      className="flex flex-col gap-1.5 border-t py-[7px]"
      style={{ borderColor: T.border.divider }}
    >
      <div className="flex items-center gap-2.5">
        <Switch
          checked={checked}
          onChange={onToggle}
          label={`${def.name}${access === "pro" ? " (Pro)" : access === "signin" ? " (sign in to use)" : ""}`}
          locked={access === "pro"}
          disabled={access === "soon"}
        />
        <span
          className="min-w-0 flex-1 text-[15px] leading-tight font-semibold"
          style={{ color: dim ? "#45435A" : T.ink.base }}
        >
          {def.name}
          <small
            className="mt-0.5 block text-[12.5px] font-normal"
            style={{ color: T.ink.dim }}
          >
            {def.sub}
          </small>
        </span>
        {access === "pro" ? <ProChip /> : null}
        {access === "signin" ? <MutedChip>Sign in</MutedChip> : null}
        {access === "soon" ? <MutedChip>Coming soon</MutedChip> : null}
        <button
          type="button"
          aria-label={`About ${def.name}`}
          aria-expanded={info}
          aria-controls={infoId}
          onClick={() => setInfo((v) => !v)}
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ color: T.ink.dim }}
        >
          <Icon name="info" size={18} />
        </button>
      </div>
      {info ? (
        <p
          id={infoId}
          className="m-0 pl-[50px] text-[13px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          {ABOUT[def.id]}
        </p>
      ) : null}
      {checked && def.exclusive === "heat" ? (
        <label
          className="flex items-center gap-2.5 pl-[50px] text-[13px]"
          style={{ color: T.ink.dim }}
        >
          <span className="w-[52px]">Opacity</span>
          <input
            type="range"
            min={20}
            max={100}
            step={10}
            value={Math.round(heatOpacity * 100)}
            onChange={(e) => onHeatOpacity(Number(e.target.value) / 100)}
            className="flex-1 accent-(--t-accent-primary)"
          />
          <span
            className="w-[34px] text-right font-semibold"
            style={{ color: T.ink.base }}
          >
            {Math.round(heatOpacity * 100)}%
          </span>
        </label>
      ) : null}
      {showUpsell ? (
        <div
          ref={upsellRef}
          className="mt-1 flex flex-col gap-2.5 rounded-2xl border p-3"
          style={{ background: T.bg.surface, borderColor: T.border.hi }}
          role="status"
        >
          <p
            className="m-0 text-[14px] leading-normal"
            style={{ color: "#2A2940" }}
          >
            <strong>{def.name}</strong> is part of Pro, alongside reach and area
            analysis. Pro isn’t available yet.
          </p>
          <p
            className="m-0 flex gap-1.5 text-[13px] leading-snug"
            style={{ color: "#2F5D3A" }}
          >
            <Icon name="check" size={15} color="#2F5D3A" stroke={2.2} />
            <span>Library facts always stay free.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSeePlans}
              className="inline-flex h-9 items-center rounded-full bg-(--t-accent-primary) px-3.5 text-[14px] font-semibold text-white hover:bg-(--t-accent-primary-hover)"
            >
              See what Pro includes
            </button>
            <button
              type="button"
              onClick={onDismissUpsell}
              className="inline-flex h-9 items-center rounded-full border bg-white px-3.5 text-[14px] font-semibold"
              style={{ borderColor: T.border.hi }}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
