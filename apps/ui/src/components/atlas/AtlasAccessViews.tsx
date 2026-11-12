"use client"

import {
  ATLAS_ACCESS_BINS,
  atlasAccessColor,
  type AtlasAccessMetric,
  type AtlasLibraryAccessArea,
  type AtlasLibraryAccessResponse,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { accessValue } from "@/components/atlas/atlas-access-analysis"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

function AccessKey({
  areas,
  metric,
}: {
  readonly areas: readonly AtlasLibraryAccessArea[]
  readonly metric: AtlasAccessMetric
}) {
  const tCopy = useTranslations("atlasCopy")

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  const histogram = ATLAS_ACCESS_BINS.map(
    (bin, index) =>
      areas.filter(
        (area) =>
          area.per100k !== null &&
          area.per100k >= bin.min &&
          (index === ATLAS_ACCESS_BINS.length - 1 ||
            area.per100k < ATLAS_ACCESS_BINS[index + 1]!.min)
      ).length
  )
  const maximum = Math.max(1, ...histogram)

  return (
    <section
      aria-label={tUi("library_access_colour_key")}
      className="flex flex-col gap-3"
    >
      <div
        className="grid grid-cols-5 gap-1.5"
        role="img"
        aria-label={`Areas per colour band: ${histogram.join(", ")}. Counts include the analysis areas with rates.`}
      >
        {ATLAS_ACCESS_BINS.map((bin, index) => (
          <div
            key={bin.label}
            className="flex min-w-0 flex-col items-center justify-end gap-1"
          >
            <span className="text-xs" style={{ color: T.ink.dim }}>
              {histogram[index]}
            </span>
            <div className="flex h-14 w-full items-end">
              <div
                className="w-full rounded-t"
                style={{
                  background: T.border.hi,
                  height: `${(histogram[index]! / maximum) * 100}%`,
                }}
              />
            </div>
            <i
              aria-hidden="true"
              className="h-5 w-full rounded border border-(--t-border-hi)"
              style={{ background: bin.color }}
            />
            <span className="text-center text-xs font-semibold">
              {metric === "per100k" ? bin.label : bin.inverse}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <i
            className="h-4 w-5 rounded border border-(--t-border-hi)"
            style={{
              background:
                "repeating-linear-gradient(135deg,#bdb7ed 0px,#bdb7ed 4px,#7d71bd 4px,#7d71bd 5px)",
            }}
          />
          {tStatic("atlas.few_records_yet")}
        </span>
        <span className="flex items-center gap-2">
          <i
            className="h-4 w-5 rounded border border-dashed border-(--t-ink-low)"
            style={{ background: "var(--t-border-hi)" }}
          />
          {tExisting("tables.noData")}
        </span>
      </div>
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        {tStatic("atlas.darker_means_more_recorded_libraries_for_each_person")}{" "}
        {tCopy("areaCoverage", {
          total: areas.length,
          count: areas.filter(
            (area) =>
              area.status === "available" &&
              area.indexedCount > 0 &&
              area.indexedCount < 5
          ).length,
        })}
      </p>
    </section>
  )
}

export function AreaDetails({
  area,
  metric,
  onFit,
  compact = false,
}: {
  readonly area: AtlasLibraryAccessArea
  readonly metric: AtlasAccessMetric
  readonly onFit: (id: string) => void
  readonly compact?: boolean
}) {
  const tCopy = useTranslations("atlasCopy")

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  return (
    <section
      aria-label={tUi("selected_analysis_area")}
      className="flex flex-col gap-3"
    >
      <div>
        <h3 className="type-h3 m-0">{area.name}</h3>
        <p
          className="mt-1 mb-0 text-3xl font-semibold"
          style={{ color: T.accent.primary }}
        >
          {accessValue(area, metric)}
        </p>
        <p className="mt-1 mb-0 text-sm" style={{ color: T.ink.dim }}>
          {metric === "per100k"
            ? "recorded libraries per 100k people"
            : "people per recorded library"}
        </p>
      </div>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
        <dt>{tStatic("atlas.libraries_matching_filters")}</dt>
        <dd className="m-0 font-semibold">
          {area.libraryCount.toLocaleString()}
        </dd>
        <dt>{tStatic("atlas.indexed_before_filters")}</dt>
        <dd className="m-0 font-semibold">
          {area.indexedCount.toLocaleString()}
        </dd>
        <dt>{tCopy("residentsYear", { year: area.populationYear ?? "—" })}</dt>
        <dd className="m-0 font-semibold">
          {area.population?.toLocaleString() ??
            tExisting("atlasDrawers.unavailable")}
        </dd>
      </dl>
      {area.status === "no_records" ? (
        <p className="m-0 text-sm">
          {tStatic(
            "atlas.no_libraries_are_indexed_here_yet_this_does_not_mean_there_are_no_libraries"
          )}
        </p>
      ) : area.status === "missing_population" ? (
        <p className="m-0 text-sm">
          {tStatic("atlas.a_matching_population_estimate_is_unavailable")}
        </p>
      ) : area.indexedCount < 5 ? (
        <p className="m-0 text-sm">
          {tStatic(
            "atlas.fewer_than_five_records_are_indexed_here_the_comparison_may_change_substantially_as_records_are_adde"
          )}
        </p>
      ) : null}
      {area.status === "available" && area.libraryCount === 0 ? (
        <p className="m-0 text-sm">
          {tStatic(
            "atlas.no_indexed_libraries_match_these_filters_people_per_library_has_no_finite_value"
          )}
        </p>
      ) : null}
      {area.smallPopulation ? (
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          {tStatic(
            "atlas.under_100_000_residents_a_single_library_can_change_the_rate_substantially"
          )}
        </p>
      ) : null}
      {!compact ? (
        <a
          href={area.populationSourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline"
          style={{ color: T.accent.primary }}
        >
          {area.populationSource}
        </a>
      ) : null}
      {area.bounds && !compact ? (
        <button
          type="button"
          onClick={() => onFit(area.id)}
          className="min-h-11 self-start text-sm font-semibold underline"
        >
          {tStatic("atlas.zoom_to")} {area.name}
        </button>
      ) : null}
    </section>
  )
}

export function AccessOverview({
  area,
  metric,
  scopeDescription,
  analysisAreas,
  onFit,
  ranked,
  onSelect,
  onCompare,
}: {
  readonly area?: AtlasLibraryAccessArea
  readonly metric: AtlasAccessMetric
  readonly scopeDescription: string
  readonly analysisAreas: readonly AtlasLibraryAccessArea[]
  readonly onFit: (id: string) => void
  readonly ranked: readonly AtlasLibraryAccessArea[]
  readonly onSelect: (id: string) => void
  readonly onCompare: () => void
}) {
  const tCopy = useTranslations("atlasCopy")

  const tStatic = useTranslations("staticUi")

  const fewRecords = analysisAreas.filter(
    (item) =>
      item.status === "available" &&
      item.indexedCount > 0 &&
      item.indexedCount < 5
  ).length

  return (
    <>
      <AccessKey areas={analysisAreas} metric={metric} />
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        {tStatic(
          "atlas.this_compares_recorded_libraries_with_the_people_living_in_each_area_it_doesn_t_show_whether_people_"
        )}
      </p>
      <AccessRanking {...{ ranked, metric, onSelect }} />
      <button
        type="button"
        onClick={onCompare}
        className="min-h-11 self-start text-sm font-semibold underline"
        style={{ color: T.accent.primary }}
      >
        {tCopy("compareAll", { count: analysisAreas.length })}
      </button>
      {fewRecords > 0 ? (
        <section
          className="flex flex-col gap-3 rounded-[20px] border p-4 text-sm leading-relaxed"
          style={{ borderColor: T.border.hi, background: T.bg.surface }}
        >
          <h3 className="type-h3 m-0">
            {tCopy("fewAreas", { count: fewRecords })}
          </h3>
          <p className="m-0" style={{ color: T.ink.dim }}>
            {tStatic(
              "atlas.missing_libraries_can_make_these_figures_look_lower_than_actual_provision_adding_confirmed_library_r"
            )}
          </p>
          <GlobalLink
            href="/community#drives"
            className="flex min-h-11 items-center self-start rounded-full border bg-(--t-bg-deep) px-4 font-semibold"
            style={{ borderColor: T.border.hi }}
          >
            {tStatic("atlas.join_a_drive")}
          </GlobalLink>
        </section>
      ) : null}
      <p className="sr-only">{scopeDescription}</p>
    </>
  )
}

export function AccessExplore({
  area,
  metric,
  areaQuery,
  setAreaQuery,
  exploreAreas,
  onSelect,
  onFit,
}: {
  readonly area?: AtlasLibraryAccessArea
  readonly metric: AtlasAccessMetric
  readonly areaQuery: string
  readonly setAreaQuery: (query: string) => void
  readonly exploreAreas: readonly AtlasLibraryAccessArea[]
  readonly onSelect: (id: string) => void
  readonly onFit: (id: string) => void
}) {
  const tCopy = useTranslations("atlasCopy")

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        {tExisting("atlasContext.findArea")}
        <input
          type="search"
          value={areaQuery}
          placeholder={tUi("try_leeds_or_glasgow")}
          onChange={(event) => setAreaQuery(event.target.value)}
          className="min-h-12 w-full rounded-2xl border bg-(--t-bg-deep) px-3 font-normal"
          style={{ borderColor: T.border.hi }}
        />
      </label>
      {areaQuery.trim() ? (
        <section
          aria-label={tUi("area_search_results")}
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: T.border.hi }}
        >
          {exploreAreas.slice(0, 20).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={area?.id === item.id}
              className="flex min-h-12 w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0"
              style={{ borderColor: T.border.divider }}
            >
              <span>{item.name}</span>
              <strong>{accessValue(item, metric)}</strong>
            </button>
          ))}
          {!exploreAreas.length ? (
            <p role="status" className="m-0 p-3 text-sm">
              {tStatic("atlas.no_areas_match_your_search_in_this_scope")}
            </p>
          ) : null}
          {exploreAreas.length > 20 ? (
            <p className="m-0 p-3 text-xs" style={{ color: T.ink.dim }}>
              {tCopy("firstMatches", { count: exploreAreas.length })}
            </p>
          ) : null}
        </section>
      ) : null}
      <div
        className="rounded-[20px] border p-4"
        style={{ borderColor: T.border.hi, background: T.bg.surface }}
      >
        {area ? (
          <AreaDetails area={area} metric={metric} onFit={onFit} />
        ) : (
          <>
            <h3 className="type-h3 m-0 mb-2">
              {tStatic("atlas.pick_an_area")}
            </h3>
            <p
              className="m-0 text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              {tStatic(
                "atlas.select_one_on_the_map_search_above_or_choose_from_compare"
              )}
            </p>
          </>
        )}
      </div>
    </>
  )
}

function AccessRanking({
  metric,
  ranked,
  onSelect,
  scopeDescription,
}: {
  readonly metric: AtlasAccessMetric
  readonly ranked: readonly AtlasLibraryAccessArea[]
  readonly onSelect: (id: string) => void
  readonly scopeDescription?: string
}) {
  const tStatic = useTranslations("staticUi")

  return (
    <section
      aria-label={tStatic(
        "atlas.areas_with_the_fewest_recorded_libraries_per_resident"
      )}
    >
      <h3 className="type-h3 m-0 mb-2">
        {metric === "per100k"
          ? "Fewest libraries per resident"
          : "Most people per library"}
      </h3>
      {scopeDescription ? (
        <p className="mt-0 text-xs" style={{ color: T.ink.dim }}>
          {scopeDescription}
        </p>
      ) : null}
      {ranked.slice(0, 5).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex min-h-12 w-full items-center gap-3 border-t py-2 text-left text-sm"
          style={{ borderColor: T.border.divider }}
        >
          <i
            aria-hidden="true"
            className="size-4 shrink-0 rounded border border-(--t-border-hi)"
            style={{ background: atlasAccessColor(item.per100k) }}
          />
          <span className="flex-1">{item.name}</span>
          <strong>{accessValue(item, metric)}</strong>
        </button>
      ))}
      <p className="mb-0 text-xs leading-relaxed" style={{ color: T.ink.dim }}>
        {ranked.length
          ? "At least five indexed records and 20,000 residents. These thresholds limit small-number effects; they do not establish complete record coverage."
          : "No areas meet the minimum of five indexed records and 20,000 residents."}
      </p>
    </section>
  )
}

export function AccessData({
  response,
  area,
}: {
  readonly response: AtlasLibraryAccessResponse
  readonly area?: AtlasLibraryAccessArea
}) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  return (
    <section
      aria-label={tUi("library_access_methodology")}
      className="text-sm leading-relaxed"
    >
      <details
        open
        className="border-b pb-4"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          {tStatic("atlas.how_it_s_calculated")}
        </summary>
        <div className="flex flex-col gap-4">
          <p className="m-0">
            {response.coverage.note}{" "}
            {tStatic(
              "atlas.the_layer_uses_reporting_area_boundaries_generalised_for_display_library_counts_and_population_denom"
            )}
          </p>
          <p className="m-0">
            {tStatic(
              "atlas.libraries_per_100_000_residents_matching_recorded_libraries_resident_population_100_000"
            )}
          </p>
          <p className="m-0">
            {tStatic(
              "atlas.people_per_library_resident_population_matching_recorded_libraries"
            )}
          </p>
          <p className="m-0">{tStatic("atlas.method_41")}</p>
        </div>
      </details>
      <details
        className="border-b py-2"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          {tStatic("atlas.what_it_doesn_t_measure")}
        </summary>
        <p className="mt-0 mb-3">{tStatic("atlas.method_43")}</p>
      </details>
      <details
        className="border-b py-2"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          {tStatic("atlas.missing_data_and_zeros")}
        </summary>
        <div className="mb-3 flex flex-col gap-3">
          <p className="m-0">{tStatic("atlas.method_45")}</p>
          <p className="m-0">{tStatic("atlas.method_46")}</p>
          <p className="m-0">{tStatic("atlas.method_47")}</p>
        </div>
      </details>
      <details
        className="border-b py-2"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          {tStatic("atlas.sources_and_dates")}
        </summary>
        <div className="mb-3 flex flex-col gap-3">
          <p className="m-0">
            {tStatic("atlas.population")} {response.baseline.year}. Library
            index evaluated{" "}
            {new Date(response.evaluatedAt).toLocaleDateString()}.
            {response.unmappedLibraries
              ? ` ${response.unmappedLibraries.toLocaleString()} matching records lack a reporting-area join and are excluded from rates.`
              : ""}
          </p>
          <p className="m-0">
            <a
              href={response.baseline.populationUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: T.accent.primary }}
            >
              {response.baseline.populationSource}
            </a>{" "}
            · {response.baseline.populationLicence}. Retrieved{" "}
            {new Date(response.baseline.retrievedAt).toLocaleDateString()}.
          </p>
          <p className="m-0">
            <a
              href={response.baseline.boundaryUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: T.accent.primary }}
            >
              {response.baseline.boundarySource}
            </a>{" "}
            · {response.baseline.boundaryLicence}. Boundary version:{" "}
            {response.baseline.version}.
          </p>
          {area ? (
            <p className="m-0">
              {tStatic("atlas.selected_area_population")}{" "}
              <a
                href={area.populationSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: T.accent.primary }}
              >
                {area.populationSource}
              </a>{" "}
              · {area.populationYear} · {area.populationLicence}. Retrieved{" "}
              {new Date(area.populationRetrievedAt).toLocaleDateString()}.
            </p>
          ) : null}
        </div>
      </details>
    </section>
  )
}
