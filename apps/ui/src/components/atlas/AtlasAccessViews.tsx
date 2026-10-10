"use client"

import {
  ATLAS_ACCESS_BINS,
  atlasAccessColor,
  type AtlasAccessMetric,
  type AtlasLibraryAccessArea,
  type AtlasLibraryAccessResponse,
} from "@repo/shared-data"

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
      aria-label="Library access colour key"
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
              className="h-5 w-full rounded border border-black/10"
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
            className="h-4 w-5 rounded border border-black/20"
            style={{
              background:
                "repeating-linear-gradient(135deg,#bdb7ed 0px,#bdb7ed 4px,#7d71bd 4px,#7d71bd 5px)",
            }}
          />
          Few records yet
        </span>
        <span className="flex items-center gap-2">
          <i
            className="h-4 w-5 rounded border border-dashed border-black/30"
            style={{ background: "#D8D4CA" }}
          />
          No data
        </span>
      </div>
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        Darker means more recorded libraries for each person.{" "}
        {areas.length.toLocaleString()} areas,{" "}
        {areas
          .filter(
            (area) =>
              area.status === "available" &&
              area.indexedCount > 0 &&
              area.indexedCount < 5
          )
          .length.toLocaleString()}{" "}
        with few records.
      </p>
    </section>
  )
}

function AreaDetails({
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
  return (
    <section
      aria-label="Selected analysis area"
      className="flex flex-col gap-3"
    >
      <div>
        <h3 className="m-0 text-lg font-bold">{area.name}</h3>
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
        <dt>Libraries matching filters</dt>
        <dd className="m-0 font-semibold">
          {area.libraryCount.toLocaleString()}
        </dd>
        <dt>Indexed before filters</dt>
        <dd className="m-0 font-semibold">
          {area.indexedCount.toLocaleString()}
        </dd>
        <dt>Residents · {area.populationYear}</dt>
        <dd className="m-0 font-semibold">
          {area.population?.toLocaleString() ?? "Unavailable"}
        </dd>
      </dl>
      {area.status === "no_records" ? (
        <p className="m-0 text-sm">
          No libraries are indexed here yet. This does not mean there are no
          libraries.
        </p>
      ) : area.status === "missing_population" ? (
        <p className="m-0 text-sm">
          A matching population estimate is unavailable.
        </p>
      ) : area.indexedCount < 5 ? (
        <p className="m-0 text-sm">
          Fewer than five records are indexed here. The comparison may change
          substantially as records are added.
        </p>
      ) : null}
      {area.status === "available" && area.libraryCount === 0 ? (
        <p className="m-0 text-sm">
          No indexed libraries match these filters. People per library has no
          finite value.
        </p>
      ) : null}
      {area.smallPopulation ? (
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          Under 100,000 residents: a single library can change the rate
          substantially.
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
          Zoom to {area.name}
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
  const fewRecords = analysisAreas.filter(
    (item) =>
      item.status === "available" &&
      item.indexedCount > 0 &&
      item.indexedCount < 5
  ).length

  return (
    <>
      <AccessKey areas={analysisAreas} metric={metric} />
      {area ? (
        <AreaDetails area={area} metric={metric} onFit={onFit} compact />
      ) : null}
      <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
        This compares recorded libraries with the people living in each area. It
        doesn’t show whether people can reach a library, and low figures can
        mean missing records. Each rate covers its whole area.
      </p>
      <AccessRanking {...{ ranked, metric, onSelect }} />
      <button
        type="button"
        onClick={onCompare}
        className="min-h-11 self-start text-sm font-semibold underline"
        style={{ color: T.accent.primary }}
      >
        Compare all {analysisAreas.length.toLocaleString()} areas
      </button>
      {fewRecords > 0 ? (
        <section
          className="flex flex-col gap-3 rounded-[20px] border p-4 text-sm leading-relaxed"
          style={{ borderColor: T.border.hi, background: T.bg.surface }}
        >
          <h3 className="m-0 text-base font-bold">
            {fewRecords.toLocaleString()} areas have few records yet
          </h3>
          <p className="m-0" style={{ color: T.ink.dim }}>
            Missing libraries can make these figures look lower than actual
            provision. Adding confirmed library records improves the comparison.
          </p>
          <GlobalLink
            href="/community#drives"
            className="flex min-h-11 items-center self-start rounded-full border bg-white px-4 font-semibold"
            style={{ borderColor: T.border.hi }}
          >
            Join a drive
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
  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Find an area
        <input
          type="search"
          value={areaQuery}
          placeholder="Try Leeds or Glasgow"
          onChange={(event) => setAreaQuery(event.target.value)}
          className="min-h-12 w-full rounded-2xl border bg-white px-3 font-normal"
          style={{ borderColor: T.border.hi }}
        />
      </label>
      {areaQuery.trim() ? (
        <section
          aria-label="Area search results"
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
              No areas match your search in this scope.
            </p>
          ) : null}
          {exploreAreas.length > 20 ? (
            <p className="m-0 p-3 text-xs" style={{ color: T.ink.dim }}>
              Showing the first 20 of {exploreAreas.length.toLocaleString()}{" "}
              matches. Refine your search to find an area.
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
            <h3 className="m-0 mb-2 text-base font-bold">Pick an area</h3>
            <p
              className="m-0 text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              Select one on the map, search above, or choose from Compare.
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
  return (
    <section aria-label="Areas with the fewest recorded libraries per resident">
      <h3 className="m-0 mb-2 text-base font-bold">
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
            className="size-4 shrink-0 rounded border border-black/10"
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
  return (
    <section
      aria-label="Library access methodology"
      className="text-sm leading-relaxed"
    >
      <details
        open
        className="border-b pb-4"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          How it’s calculated
        </summary>
        <div className="flex flex-col gap-4">
          <p className="m-0">
            {response.coverage.note} The layer uses reporting-area boundaries,
            generalised for display. Library counts and population denominators
            cover each whole area, wherever you move or zoom the map.
          </p>
          <p className="m-0">
            Libraries per 100,000 residents = matching recorded libraries ÷
            resident population × 100,000.
          </p>
          <p className="m-0">
            People per library = resident population ÷ matching recorded
            libraries.
          </p>
          <p className="m-0">
            Counts follow your Filters, chosen library types and enabled
            accessibility selection. Planned libraries and permanent closures
            are excluded. Each mapped mobile service counts once at its depot,
            never once per stop.
          </p>
        </div>
      </details>
      <details
        className="border-b py-2"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          What it doesn’t measure
        </summary>
        <p className="mt-0 mb-3">
          The library index is incomplete. Low rates can mean missing records.
          This does not measure travel time, opening capacity, eligibility or
          quality. Academic and restricted libraries may serve a different
          population. Five indexed records do not establish good or complete
          record coverage.
        </p>
      </details>
      <details
        className="border-b py-2"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          Missing data and zeros
        </summary>
        <div className="mb-3 flex flex-col gap-3">
          <p className="m-0">
            Hatching means one to four libraries are indexed before filtering.
            Grey means missing population or no indexed baseline. Zero matching
            libraries is a valid filtered count, not proof of no local
            provision; people per library then has no finite value.
          </p>
          <p className="m-0">
            Fixed colour bands stay comparable as you filter. People-per-library
            band limits are rounded reciprocals of the per-100k scale. Histogram
            bars count areas with a rate, including those with few indexed
            records. Rankings include areas with at least five indexed records
            and 20,000 residents.
          </p>
          <p className="m-0">
            Scope changes which whole areas are included in the analysis and
            CSV. In map view includes areas whose geographic bounds intersect
            the view; it does not clip the population or library counts.
          </p>
        </div>
      </details>
      <details
        className="border-b py-2"
        style={{ borderColor: T.border.divider }}
      >
        <summary className="min-h-12 cursor-pointer list-none py-3 text-base font-bold">
          Sources and dates
        </summary>
        <div className="mb-3 flex flex-col gap-3">
          <p className="m-0">
            Population: {response.baseline.year}. Library index evaluated{" "}
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
              Selected area population:{" "}
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
