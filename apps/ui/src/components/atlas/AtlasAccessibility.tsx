"use client"
import { useTranslations } from "next-intl"

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
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  return (
    <div className="mb-3 flex flex-col gap-2.5">
      <div
        role="group"
        aria-label={tUi("accessibility_map_view")}
        className="grid grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: T.bg.muted }}
      >
        {VIEWS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => onChange(value)}
            className="min-h-11 rounded-lg px-1 text-sm font-semibold hover:bg-(--t-bg-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            style={
              view === value
                ? {
                    background: "var(--t-bg-deep)",
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
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        {VIEWS.find((option) => option.value === view)!.description}
      </p>
      <AccessibilityCoverage
        coverage={coverage}
        scope={scope}
        enabled={enabled}
      />
      <p className="m-0 text-xs" style={{ color: T.ink.dim }}>
        {tStatic(
          "atlas.a_gap_in_our_records_does_not_prove_a_feature_is_absent"
        )}
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
  const tCopy = useTranslations("atlasCopy")

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  return (
    <section
      aria-label={tUi("accessibility_coverage")}
      className="flex flex-col gap-3"
    >
      <p className="m-0 text-xs font-semibold" style={{ color: T.ink.dim }}>
        {tCopy("currentFilters", { scope })}
      </p>
      {!enabled ? (
        <p className="m-0 text-sm">
          {tStatic(
            "atlas.turn_on_the_layer_or_choose_a_feature_to_see_map_coverage"
          )}
        </p>
      ) : coverage && coverage.total > 0 ? (
        <div role="status" className="flex flex-col gap-3">
          <p className="m-0 text-sm">
            {tCopy.rich("confirmedRecords", {
              count: coverage.matches,
              total: coverage.total,
              strong: (chunks) => (
                <strong
                  className="text-3xl font-semibold"
                  style={{ color: ACCESS_MATCH }}
                >
                  {chunks}
                </strong>
              ),
            })}
          </p>
          <div
            aria-hidden="true"
            className="flex h-2.5 overflow-hidden rounded-full border"
            style={{
              borderColor: ACCESS_GAP,
              background: "var(--t-palette-amber-soft)",
            }}
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
              <dt style={{ color: T.ink.dim }}>
                {tStatic("atlas.confirmed_share")}
              </dt>
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
                {tStatic("atlas.unconfirmed")}
              </dt>
              <dd className="m-0 mt-1 text-xl font-semibold">
                {coverage.unconfirmed.toLocaleString()}
              </dd>
            </div>
          </dl>
          {coverage.partial > 0 ? (
            <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
              {tCopy("partialRecords", { count: coverage.partial })}
            </p>
          ) : null}
        </div>
      ) : coverage ? (
        <p className="m-0 text-sm">{tStatic("common.noMapLibraries")}</p>
      ) : (
        <p className="m-0 text-sm">{tStatic("common.loadingLibraries")}</p>
      )}
    </section>
  )
}

export function AccessibilityMapKey({
  view,
}: {
  readonly view: AccessibilityView
}) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  return (
    <section
      aria-label={tUi("accessibility_map_key")}
      className="flex flex-col gap-2 text-sm"
    >
      <h3 className="type-h3 m-0">{tStatic("atlas.on_the_map")}</h3>
      {view !== "gaps" ? (
        <span className="flex items-center gap-2">
          <AccessibilitySwatch confirmed />
          {tStatic("atlas.confirmed_feature_matches")}
        </span>
      ) : null}
      {view !== "matches" ? (
        <span className="flex items-center gap-2">
          <AccessibilitySwatch confirmed={false} />
          {tStatic("atlas.unconfirmed_records")}
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
