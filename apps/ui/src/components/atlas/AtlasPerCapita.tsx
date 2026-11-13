"use client"

import type {
  AtlasAccessLevel,
  AtlasAccessMetric,
  AtlasPerCapitaResponse,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

import { Icon, Segmented } from "./atlas-ui"
import { TYPE_GROUPS } from "./atlas.logic"

export function perCapitaCsv(response: AtlasPerCapitaResponse): string {
  const quote = (value: string | number | null) => {
    const text = value === null ? "" : String(value)

    return `"${(/^\s*[=+\-@]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`
  }

  return [
    [
      "Country/territory",
      "ISO3",
      "Indexed libraries matching filters",
      "Indexed libraries (unfiltered)",
      "Residents",
      "Population year",
      "Libraries per 100000 residents",
      "Data state",
      "Small population",
      "Index evaluated at",
      "Population source",
      "Filters and accessibility",
      "Population baseline version",
      "Population import version",
      "Index revision",
      "Unjoined matching libraries",
      "Population source URL",
      "Boundary source",
      "Caveat",
    ],
    ...response.countries.map((country) => [
      country.name,
      country.iso3,
      country.libraryCount,
      country.indexedCount,
      country.population,
      response.baseline.year,
      country.per100k,
      country.status,
      country.smallPopulation ? "Yes" : "No",
      response.evaluatedAt,
      response.baseline.populationSource,
      JSON.stringify(response.scope),
      response.baseline.version,
      response.baseline.populationVersion ?? "",
      response.indexedThrough,
      response.unmappedLibraries,
      response.baseline.populationUrl,
      response.baseline.boundarySource,
      "Incomplete library index; not service access or quality. Current index divided by a historical population estimate.",
    ]),
  ]
    .map((row) => row.map(quote).join(","))
    .join("\r\n")
}

export type LibraryAccessControlsProps = {
  metric: AtlasAccessMetric
  onMetric: (value: AtlasAccessMetric) => void
  level: AtlasAccessLevel
  onLevel: (value: AtlasAccessLevel) => void
  resolvedLevel: "countries" | "local"
  opacity: number
  onOpacity: (value: number) => void
  types: string[]
  onTypes: (types: string[]) => void
  onAnalysis: () => void
  showOpacity?: boolean
  showAnalysisLink?: boolean
}

export function AtlasPerCapitaControls({
  metric,
  onMetric,
  level,
  onLevel,
  resolvedLevel,
  opacity,
  onOpacity,
  types,
  onTypes,
  onAnalysis,
  showAnalysisLink = true,
  showOpacity = true,
}: LibraryAccessControlsProps) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  const counted = types.length ? types : TYPE_GROUPS.map((group) => group.key)

  return (
    <section
      aria-label={tUi("library_access_settings")}
      className="flex flex-col gap-4 text-sm"
    >
      <div className="flex items-center justify-between">
        <strong>{tStatic("atlas.show_as")}</strong>
      </div>
      <Segmented
        label={tUi("library_access_measure")}
        value={metric}
        onChange={onMetric}
        options={[
          { value: "per100k", label: tStatic("atlas.per_100k_people") },
          {
            value: "peoplePerLibrary",
            label: tStatic("atlas.people_per_library"),
          },
        ]}
      />
      <div className="flex items-center justify-between">
        <strong>{tExisting("articleContext.areas")}</strong>
        <span style={{ color: T.ink.dim }}>
          {tStatic("atlas.now_label")}{" "}
          {resolvedLevel === "local" ? "local areas" : "countries"}
        </span>
      </div>
      <Segmented
        label={tUi("library_access_areas")}
        value={level}
        onChange={onLevel}
        options={[
          { value: "auto", label: tStatic("atlas.auto") },
          { value: "countries", label: tUi("countries") },
          { value: "local", label: tStatic("atlas.local_areas") },
        ]}
      />
      <p className="m-0 text-xs leading-relaxed" style={{ color: T.ink.dim }}>
        {tStatic(
          "atlas.auto_uses_local_areas_when_you_zoom_into_the_uk_local_comparisons_currently_cover_uk_districts_count"
        )}
      </p>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 w-full">
          <span className="flex justify-between">
            <strong>{tStatic("atlas.libraries_counted")}</strong>
            <span style={{ color: T.ink.dim }}>
              {counted.length} {tExisting("widgetPublic.of")}{" "}
              {TYPE_GROUPS.length} types
            </span>
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TYPE_GROUPS.map((group) => {
            const checked = counted.includes(group.key)

            return (
              <button
                key={group.key}
                type="button"
                aria-pressed={checked}
                disabled={checked && counted.length === 1}
                onClick={() =>
                  onTypes(
                    checked
                      ? counted.filter((type) => type !== group.key)
                      : [...counted, group.key]
                  )
                }
                className="flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-semibold disabled:opacity-70"
                style={{
                  background: checked ? T.accent.chip : T.bg.deep,
                  color: checked ? T.accent.primary : T.ink.dim,
                  borderColor: checked ? T.accent.primary : T.border.divider,
                }}
              >
                {checked ? <Icon name="check" size={16} /> : null}
                {group.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <p className="m-0 text-xs leading-relaxed" style={{ color: T.ink.dim }}>
        {tStatic(
          "atlas.counts_use_published_records_with_usable_map_pins_each_mobile_service_counts_once_at_its_depot_never"
        )}
      </p>
      {showOpacity ? (
        <label className="flex flex-col gap-2 font-semibold">
          <span className="flex justify-between">
            {tStatic("atlas.opacity")} <span>{Math.round(opacity * 100)}%</span>
          </span>
          <input
            className="w-full accent-(--t-accent-primary)"
            type="range"
            min={10}
            max={90}
            step={5}
            value={Math.round(opacity * 100)}
            onChange={(event) => onOpacity(Number(event.target.value) / 100)}
            aria-label={tUi("library_access_opacity")}
          />
        </label>
      ) : null}
      {showAnalysisLink ? (
        <button
          type="button"
          onClick={onAnalysis}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border bg-(--t-bg-deep) font-semibold"
          style={{ color: T.accent.primary, borderColor: T.border.hi }}
        >
          <Icon name="layers" size={18} />
          {tStatic("common.openAnalysis")}
        </button>
      ) : null}
    </section>
  )
}
