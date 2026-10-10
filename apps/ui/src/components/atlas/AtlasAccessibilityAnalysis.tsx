"use client"

import type { AtlasExportRequest } from "@repo/shared-data"
import { useEffect, useId, useState } from "react"

import { ACCESS_GAP, ACCESS_MATCH } from "@/components/atlas/atlas-map.style"
import { Chip, Icon, ProChip } from "@/components/atlas/atlas-ui"
import {
  accessibilityOptions,
  type AccessibilityView,
  type AtlasLibrary,
  type accessibilitySummary,
  type Tier,
} from "@/components/atlas/atlas.logic"
import { AtlasAnalysisHeader } from "@/components/atlas/AtlasAnalysisHeader"
import { useAtlasExport } from "@/components/atlas/AtlasExportButton"
import { T } from "@/lib/design-tokens"

const FEATURE_SHORTLIST = [
  "Step-free access",
  "Accessible toilets",
  "Hearing loop",
  "Lift access",
  "Accessible parking",
]
const MAP_VIEWS: { value: AccessibilityView; label: string }[] = [
  { value: "matches", label: "Recorded" },
  { value: "compare", label: "Both" },
  { value: "gaps", label: "Not yet" },
]
type Coverage = ReturnType<typeof accessibilitySummary>

export function AtlasAccessibilityAnalysis({
  tier,
  enabled,
  libraries,
  selected,
  view,
  coverage,
  scope,
  serverOptions,
  optionsLoading = false,
  onSelected,
  onView,
  onEnable,
  onSignIn,
  onList,
  onSeePlans,
  exportRequest,
  exportLibraries = [],
  collapsed,
  onCollapse,
  onClose,
}: {
  readonly tier: Tier
  readonly enabled: boolean
  readonly libraries: AtlasLibrary[]
  readonly selected: string[]
  readonly view: AccessibilityView
  readonly coverage: Coverage | null
  readonly scope: string
  readonly serverOptions?: { name: string; count: number }[]
  readonly optionsLoading?: boolean
  readonly onSelected: (names: string[]) => void
  readonly onView: (view: AccessibilityView) => void
  readonly onEnable: () => void
  readonly onSignIn: () => void
  readonly onList?: (view?: AccessibilityView) => void
  readonly onSeePlans?: () => void
  readonly exportRequest?: AtlasExportRequest
  readonly exportLibraries?: AtlasLibrary[]
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly onClose: () => void
}) {
  const [catalogue, setCatalogue] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [catalogueState, setCatalogueState] = useState<
      "loading" | "ready" | "error"
    >("loading")
  const id = useId(),
    hasServerOptions = serverOptions !== undefined,
    canApply = tier !== "public",
    canExport = tier === "pro"
  const { busy, outcome, run } = useAtlasExport(onSeePlans ?? onSignIn)
  useEffect(() => {
    if (hasServerOptions) return
    const controller = new AbortController()
    fetch("/api/relations/accessibility", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Catalogue unavailable")

        return response.json()
      })
      .then((result) => {
        if (controller.signal.aborted) return
        setCatalogue(
          (result.data ?? []).flatMap((row: { name?: string }) =>
            row.name ? [row.name] : []
          )
        )
        setCatalogueState("ready")
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogueState("error")
      })

    return () => controller.abort()
  }, [hasServerOptions])

  const options =
      serverOptions ?? accessibilityOptions(libraries, selected, catalogue),
    byName = new Map(options.map((option) => [option.name, option])),
    preferred = FEATURE_SHORTLIST.filter((name) => byName.has(name)),
    shortlist = [
      ...new Set([...preferred, ...options.map(({ name }) => name)]),
    ].slice(0, 5),
    featured = [...new Set([...selected, ...shortlist])],
    matching = options.filter(({ name }) =>
      name.toLowerCase().includes(query.trim().toLowerCase())
    ),
    countsAvailable =
      !optionsLoading && (hasServerOptions || libraries.length > 0),
    summary = enabled && canApply ? coverage : null,
    shownCount = summary
      ? view === "matches"
        ? summary.matches
        : view === "gaps"
          ? summary.unconfirmed
          : summary.total
      : null
  const applySelection = (names: string[]) => {
    if (!canApply) return onSignIn()
    onSelected(names)
    if (!enabled) onEnable()
  }
  const changeView = (value: AccessibilityView) => {
    if (!canApply) return onSignIn()
    onView(value)
    if (!enabled) onEnable()
  }
  const listLibraries = (value?: AccessibilityView) => {
    if (!canApply) return onSignIn()
    if (value) onView(value)
    if (!enabled) onEnable()
    onList?.(value)
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ color: T.ink.base }}
    >
      <AtlasAnalysisHeader
        title="Accessibility"
        badge="Pin layer"
        badgeTone="pin"
        description="Which libraries record the features you need"
        {...{ collapsed, onCollapse, onClose }}
      />
      {!collapsed ? (
        <div
          role="region"
          aria-label="Accessibility analysis controls"
          tabIndex={0}
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto overscroll-contain p-5 focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
        >
          <section
            aria-label="Choose accessibility features"
            className="flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="m-0 text-base font-bold">What do you need?</h3>
              <span className="text-right text-sm" style={{ color: T.ink.dim }}>
                {selected.length
                  ? `${selected.length} chosen`
                  : "Nothing chosen"}
              </span>
            </div>
            <p
              className="m-0 text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {selected.length
                ? "Libraries must record every feature you choose."
                : "Any accessibility detail counts until you choose."}
            </p>
            <div className="flex flex-wrap gap-2">
              {featured.map((name) => (
                <Chip
                  key={name}
                  on={selected.includes(name)}
                  onClick={() =>
                    applySelection(
                      selected.includes(name)
                        ? selected.filter((value) => value !== name)
                        : [...selected, name]
                    )
                  }
                  count={countsAvailable ? byName.get(name)?.count : undefined}
                >
                  {name}
                </Chip>
              ))}
            </div>
            {optionsLoading ? (
              <p
                role="status"
                className="m-0 text-sm"
                style={{ color: T.ink.dim }}
              >
                Loading recorded features…
              </p>
            ) : null}
            {selected.length ? (
              <button
                type="button"
                onClick={() => applySelection([])}
                className="min-h-11 self-start text-sm font-semibold underline"
                style={{ color: T.accent.primary }}
              >
                Clear chosen features
              </button>
            ) : null}
            <details>
              <summary
                className="min-h-11 cursor-pointer list-none py-3 text-sm font-semibold"
                style={{ color: T.accent.primary }}
              >
                All {options.length || ""} features{" "}
                <Icon name="chevD" size={14} className="ml-1 inline" />
              </summary>
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="sr-only">All accessibility features</legend>
                <label className="mb-3 flex flex-col gap-1 text-sm font-semibold">
                  Find a feature
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-h-11 w-full rounded-xl border bg-white px-3 font-normal"
                    style={{ borderColor: T.border.hi }}
                  />
                </label>
                {matching.map(({ name, count }) => (
                  <label
                    key={name}
                    className="flex min-h-12 cursor-pointer items-center gap-2.5 border-b text-sm"
                    style={{ borderColor: T.border.divider }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(name)}
                      onChange={() =>
                        applySelection(
                          selected.includes(name)
                            ? selected.filter((value) => value !== name)
                            : [...selected, name]
                        )
                      }
                      className="size-4 shrink-0 accent-(--t-accent-primary)"
                    />
                    <span className="min-w-0 flex-1">{name}</span>
                    <span style={{ color: T.ink.dim }}>
                      {countsAvailable ? count.toLocaleString() : "—"}
                    </span>
                  </label>
                ))}
                {!matching.length ? (
                  <p className="my-2 text-sm" role="status">
                    {query.trim()
                      ? "No features match your search."
                      : optionsLoading ||
                          (!hasServerOptions && catalogueState === "loading")
                        ? "Loading recorded features…"
                        : !hasServerOptions && catalogueState === "error"
                          ? "The feature catalogue couldn’t load. Try opening the panel again."
                          : "No accessibility features recorded yet."}
                  </p>
                ) : null}
              </fieldset>
            </details>
            <p
              className="m-0 text-xs leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              Feature counts:{" "}
              {hasServerOptions ? "all libraries" : "loaded libraries"} matching
              your Filters.
            </p>
            {!canApply ? (
              <div
                className="rounded-xl p-3 text-sm leading-relaxed"
                style={{ background: T.bg.surface }}
              >
                Browse all features. A free account lets you apply your choices
                to the map.
                <button
                  type="button"
                  onClick={onSignIn}
                  className="mt-1 block min-h-11 font-semibold underline"
                  style={{ color: T.accent.primary }}
                >
                  Sign in to apply accessibility features
                </button>
              </div>
            ) : !enabled ? (
              <button
                type="button"
                onClick={onEnable}
                className="min-h-11 self-start text-sm font-semibold underline"
                style={{ color: T.accent.primary }}
              >
                Enable accessibility layer
              </button>
            ) : null}
          </section>

          <AccessibilityHeadline
            coverage={summary}
            selected={selected}
            scope={scope}
            enabled={enabled && canApply}
          />

          <section
            className="flex flex-col gap-3"
            aria-labelledby={`${id}-map`}
          >
            <h3 id={`${id}-map`} className="m-0 text-base font-bold">
              Show on the map
            </h3>
            <div
              role="group"
              aria-label="Accessibility map view"
              className="grid grid-cols-3 gap-1 rounded-2xl p-1"
              style={{ background: T.bg.muted }}
            >
              {MAP_VIEWS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => changeView(value)}
                  className="min-h-11 rounded-xl px-1 text-sm font-semibold"
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
            {view === "compare" ? (
              <p
                className="m-0 text-xs leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                Filled pins show recorded matches; hollow pins show details not
                recorded yet. Cluster labels show recorded / total, for example
                3/5.
              </p>
            ) : null}
            <p
              className="m-0 rounded-2xl border p-3 text-sm leading-relaxed"
              style={{
                background: T.bg.surface,
                borderColor: T.border.divider,
              }}
            >
              <strong>Not recorded yet doesn’t mean inaccessible.</strong>{" "}
              {selected.length
                ? "Our record doesn’t confirm every feature you chose."
                : "Our record has no accessibility details yet."}{" "}
              Check with the library before you visit.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => listLibraries()}
              disabled={!onList || shownCount === 0}
              className="min-h-11 flex-1 rounded-full px-3 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
              style={{ background: T.accent.primary, color: "#fff" }}
            >
              List these libraries
            </button>
            <button
              type="button"
              aria-busy={busy}
              disabled={busy || (canExport && (shownCount === 0 || !summary))}
              aria-describedby={!canExport ? `${id}-export-plan` : undefined}
              onClick={() => {
                if (!canExport) return (onSeePlans ?? onSignIn)()
                void run(
                  "csv",
                  exportRequest ?? exportLibraries.map((library) => library.id)
                )
              }}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border bg-white px-3 text-sm font-semibold whitespace-nowrap disabled:opacity-50"
              style={{ borderColor: T.border.hi }}
            >
              {busy ? "Downloading…" : "Download CSV"}{" "}
              {!canExport ? <ProChip /> : null}
            </button>
            {!canExport ? (
              <span id={`${id}-export-plan`} className="sr-only">
                CSV downloads are included with Pro and Team.
              </span>
            ) : null}
            {outcome ? (
              <p
                role="status"
                className="m-0 w-full text-sm"
                style={{
                  color: outcome.tone === "error" ? T.accent.danger : T.ink.dim,
                }}
              >
                {outcome.text}
              </p>
            ) : null}
          </div>

          {summary && summary.unconfirmed > 0 ? (
            <section
              className="flex flex-col gap-3 rounded-2xl border p-4 text-sm leading-relaxed"
              style={{
                background: T.bg.surface,
                borderColor: T.border.divider,
              }}
            >
              <h3 className="m-0 text-base font-bold">
                {summary.unconfirmed.toLocaleString()} libraries here{" "}
                {selected.length
                  ? "don’t confirm every chosen feature"
                  : "have no accessibility details"}
              </h3>
              <p className="m-0" style={{ color: T.ink.dim }}>
                Check the library’s website, then open a library record to
                suggest a correction with confirmed details.
              </p>
              <button
                type="button"
                disabled={!onList}
                onClick={() => listLibraries("gaps")}
                className="min-h-11 self-start rounded-full border bg-white px-4 font-semibold"
                style={{ borderColor: T.border.hi }}
              >
                Help fill them
              </button>
            </section>
          ) : null}

          <details className="text-sm leading-relaxed">
            <summary className="min-h-11 cursor-pointer py-3 text-base font-bold">
              About this data
            </summary>
            <div className="flex flex-col gap-3" style={{ color: T.ink.dim }}>
              <p className="m-0">
                Features come from library records in the community index and
                the CMS feature catalogue. Each library counts once. Feature
                counts cover{" "}
                {hasServerOptions ? "all libraries" : "loaded libraries"}{" "}
                matching your Filters; the coverage summary covers{" "}
                {scope.toLowerCase()} before the map hides any records.
              </p>
              <p className="m-0">
                With nothing chosen, any recorded accessibility detail counts.
                With features chosen, a library must record all of them. Not
                recorded yet includes records with no details and records that
                confirm only some chosen features.
              </p>
              <p className="m-0">
                The index records confirmed features. Missing confirmation does
                not distinguish unknown information from an absent feature, and
                does not establish that a library is inaccessible. Confirm
                arrangements with the library before visiting.
              </p>
              <p className="m-0">
                The list and CSV follow your Filters, the map area, and the
                selected Recorded, Both, or Not yet view. Downloads use the
                existing Pro and Team export limits.
              </p>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  )
}

function AccessibilityHeadline({
  coverage,
  selected,
  scope,
  enabled,
}: {
  readonly coverage: Coverage | null
  readonly selected: string[]
  readonly scope: string
  readonly enabled: boolean
}) {
  const share =
    coverage && coverage.total > 0
      ? (100 * coverage.matches) / coverage.total
      : 0

  return (
    <section
      aria-label="Accessibility coverage"
      className="flex flex-col gap-3 border-t pt-4"
      style={{ borderColor: T.border.divider }}
    >
      {!enabled ? (
        <p className="m-0 text-sm">
          Turn on the layer or choose a feature to see map coverage.
        </p>
      ) : !coverage ? (
        <p className="m-0 text-sm" role="status">
          Loading library records…
        </p>
      ) : coverage.total === 0 ? (
        <p className="m-0 text-sm">No library records in this map area.</p>
      ) : (
        <>
          <p
            className="m-0 text-6xl leading-none"
            style={{ fontFamily: T.font.serif }}
          >
            {coverage.matches.toLocaleString()}
          </p>
          <p
            className="m-0 text-sm leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            of {coverage.total.toLocaleString()} libraries{" "}
            {scope === "Records in view" ? "in view" : "in the loaded records"}{" "}
            record{" "}
            {selected.length
              ? "every feature you chose"
              : "any accessibility details"}
          </p>
          <div
            aria-hidden="true"
            className="flex h-3 overflow-hidden rounded-full border"
            style={{
              borderColor: T.border.hi,
              background:
                "repeating-linear-gradient(45deg, #fff, #fff 5px, #F1EADC 5px, #F1EADC 10px)",
            }}
          >
            <span style={{ width: `${share}%`, background: ACCESS_MATCH }} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <i
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ background: ACCESS_MATCH }}
              />
              <strong>
                {share.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
              </strong>{" "}
              recorded
            </span>
            <span className="flex items-center gap-1.5">
              <i
                aria-hidden="true"
                className="size-2.5 rounded-full border-2 border-dashed"
                style={{ borderColor: ACCESS_GAP }}
              />
              <strong>{coverage.unconfirmed.toLocaleString()}</strong> not
              recorded yet
            </span>
          </div>
          {selected.length > 1 && coverage.partial > 0 ? (
            <p
              className="m-0 text-xs leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {coverage.partial.toLocaleString()} of these record some, but not
              all, of your chosen features.
            </p>
          ) : null}
        </>
      )}
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        Counts every library{" "}
        {scope === "Records in view" ? "in view" : "in the loaded records"} that
        matches your Filters, including any the map is hiding.
      </p>
    </section>
  )
}
