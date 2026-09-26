"use client"

import { T } from "@/lib/design-tokens"

import { INDIGO, MUTED, OK } from "./atlas-map.style"
import { KeyLegend, PinGlyph, RampLegend, Segmented } from "./atlas-ui"
import { type LayerId, TYPE_GROUPS, type TypeGroupKey } from "./atlas.logic"

/** Legends for the pins and every active layer, in stacking order. */
export function AtlasLegends({
  groups,
  layers,
}: {
  readonly groups: TypeGroupKey[]
  readonly layers: LayerId[]
}) {
  const on = (id: LayerId) => layers.includes(id)
  const items: React.ReactNode[] = []

  if (!on("complete") && !on("access") && groups.length > 0)
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
        title="Step-free access"
        source="Recorded by contributors"
        items={[
          { key: "y", label: "Recorded", swatch: <Dot color={OK} /> },
          {
            key: "n",
            label: "Not recorded yet",
            swatch: <Dot color={MUTED} />,
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

function Dot({ color }: { readonly color: string }) {
  return (
    <i
      aria-hidden="true"
      className="inline-block size-3 rounded-full"
      style={{
        background: color,
        border: "1.5px solid #fff",
        boxShadow: "0 0 0 1px rgba(23,22,43,.25)",
      }}
    />
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
