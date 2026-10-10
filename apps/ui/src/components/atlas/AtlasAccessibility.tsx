"use client"

import { T } from "@/lib/design-tokens"

import { ACCESS_GAP, ACCESS_MATCH } from "./atlas-map.style"
import type { AccessibilityView, accessibilitySummary } from "./atlas.logic"

export function AccessibilitySwatch({
  confirmed,
}: {
  readonly confirmed: boolean
}) {
  return (
    <i
      aria-hidden="true"
      className="inline-block size-3.5 shrink-0 rounded-full"
      style={{
        background: confirmed ? ACCESS_MATCH : "#fff",
        border: confirmed ? "2px solid #fff" : `2px solid ${ACCESS_GAP}`,
        boxShadow: confirmed ? `0 0 0 1px ${ACCESS_MATCH}` : undefined,
      }}
    />
  )
}

const VIEWS: {
  value: AccessibilityView
  label: string
  description: string
}[] = [
  {
    value: "matches",
    label: "Matches",
    description:
      "Only libraries that confirm every selected feature. With no features selected, any recorded accessibility feature qualifies.",
  },
  {
    value: "compare",
    label: "Compare",
    description:
      "Confirmed matches are solid blue. Other records are hollow amber. Cluster labels show matches / total records.",
  },
  {
    value: "gaps",
    label: "Data gaps",
    description:
      "Only records that do not confirm every selected feature. These may include partial records.",
  },
]

/** Denominator comes from the filtered viewport before hiding any records. */
export function AccessibilityControls({
  view,
  onChange,
  coverage,
  scope,
  enabled = true,
}: {
  readonly view: AccessibilityView
  readonly onChange: (view: AccessibilityView) => void
  readonly coverage: ReturnType<typeof accessibilitySummary> | null
  readonly scope: string
  readonly enabled?: boolean
}) {
  return (
    <div className="mb-3 flex flex-col gap-2.5">
      <div
        role="group"
        aria-label="Accessibility map view"
        className="grid grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: T.bg.muted }}
      >
        {VIEWS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => onChange(value)}
            className="min-h-11 rounded-lg px-1 text-[13px] font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            style={
              view === value
                ? {
                    background: "#fff",
                    color: T.ink.base,
                    boxShadow: `inset 0 0 0 1px ${T.border.hi}`,
                  }
                : { color: T.ink.dim }
            }
          >
            {label}
          </button>
        ))}
      </div>
      <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
        {VIEWS.find((option) => option.value === view)!.description}
      </p>
      <AccessibilityCoverage
        coverage={coverage}
        scope={scope}
        enabled={enabled}
      />
      <p className="m-0 text-[12px]" style={{ color: T.ink.dim }}>
        A gap in our records does not prove a feature is absent.
      </p>
    </div>
  )
}

/** Coverage always uses the same filtered records, before the display mode hides any. */
export function AccessibilityCoverage({
  coverage,
  scope,
  enabled = true,
}: {
  readonly coverage: ReturnType<typeof accessibilitySummary> | null
  readonly scope: string
  readonly enabled?: boolean
}) {
  return (
    <section
      aria-label="Accessibility coverage"
      className="flex flex-col gap-3"
    >
      <p className="m-0 text-xs font-semibold" style={{ color: T.ink.dim }}>
        {scope} · current filters
      </p>
      {!enabled ? (
        <p className="m-0 text-sm">
          Turn on the layer or choose a feature to see map coverage.
        </p>
      ) : coverage && coverage.total > 0 ? (
        <div role="status" className="flex flex-col gap-3">
          <p className="m-0 text-sm">
            <strong
              className="text-3xl font-semibold"
              style={{ color: ACCESS_MATCH }}
            >
              {coverage.matches.toLocaleString()}
            </strong>
            <br />
            of {coverage.total.toLocaleString()} records confirm the selection
          </p>
          <div
            aria-hidden="true"
            className="flex h-2.5 overflow-hidden rounded-full border"
            style={{ borderColor: ACCESS_GAP, background: "#FFF4E5" }}
          >
            <span
              style={{
                width: `${(100 * coverage.matches) / coverage.total}%`,
                background: ACCESS_MATCH,
              }}
            />
          </div>
          <dl className="m-0 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt style={{ color: T.ink.dim }}>Confirmed share</dt>
              <dd className="m-0 mt-1 text-xl font-semibold">
                {((100 * coverage.matches) / coverage.total).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 1 }
                )}
                %
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2">
                <AccessibilitySwatch confirmed={false} />
                Unconfirmed
              </dt>
              <dd className="m-0 mt-1 text-xl font-semibold">
                {coverage.unconfirmed.toLocaleString()}
              </dd>
            </div>
          </dl>
          {coverage.partial > 0 ? (
            <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
              {coverage.partial.toLocaleString()} unconfirmed records confirm
              some selected features.
            </p>
          ) : null}
        </div>
      ) : coverage ? (
        <p className="m-0 text-sm">No library records in this map area.</p>
      ) : (
        <p className="m-0 text-sm">Loading library records…</p>
      )}
    </section>
  )
}

export function AccessibilityMapKey({
  view,
}: {
  readonly view: AccessibilityView
}) {
  return (
    <section
      aria-label="Accessibility map key"
      className="flex flex-col gap-2 text-sm"
    >
      <h3 className="m-0 text-sm font-bold">On the map</h3>
      {view !== "gaps" ? (
        <span className="flex items-center gap-2">
          <AccessibilitySwatch confirmed />
          Confirmed feature matches
        </span>
      ) : null}
      {view !== "matches" ? (
        <span className="flex items-center gap-2">
          <AccessibilitySwatch confirmed={false} />
          Unconfirmed records
        </span>
      ) : null}
      <p className="m-0" style={{ color: T.ink.dim }}>
        {view === "compare"
          ? "Clusters show confirmed / total records, for example 3/5. Both states use the same filtered records."
          : view === "gaps"
            ? "Only unconfirmed records are shown. These can include partial records."
            : "Only confirmed records are shown. Other records are hidden."}
      </p>
    </section>
  )
}
