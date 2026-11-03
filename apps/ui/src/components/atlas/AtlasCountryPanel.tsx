"use client"

import { Icon } from "@iconify/react"
import { GAPS, type GapKey } from "@repo/shared-data"
import { useLocale } from "next-intl"
import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  baselinePopulation,
  perHundredThousand,
  type AtlasCountryDetail,
  type AtlasCountryOption,
} from "@/lib/atlas-countries"
import { placeAddHref } from "@/lib/contribution-place"
import { proposeHref } from "@/lib/drives/propose-link"

const GAP_LABEL = new Map(GAPS.map((gap) => [gap.key, gap.label]))
/** Gaps worth a drive, in the order a visitor would care about them. */
const GAP_ORDER: GapKey[] = [
  "hours",
  "contact",
  "location",
  "accessibility",
  "photo",
  "address",
]

const number = (value: number) => value.toLocaleString("en-GB")
const compact = (value: number) =>
  value.toLocaleString("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  })

/** A regional-indicator flag from a two-letter code; nothing otherwise. */
function flag(iso2: string | null): string {
  if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) return ""

  return String.fromCodePoint(
    ...[...iso2].map((c) => 0x1f1e6 + c.codePointAt(0)! - 65)
  )
}

function Bars({
  rows,
  total,
}: {
  readonly rows: { key: string; label: React.ReactNode; count: number }[]
  readonly total: number
}) {
  return (
    <ul className="m-0 grid list-none gap-2.5 p-0">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {row.label}
            </span>
            <span className="shrink-0 text-(--t-ink-dim) tabular-nums">
              {number(row.count)}
            </span>
          </div>
          <span
            aria-hidden
            className="block h-1.5 overflow-hidden rounded-full bg-(--t-bg-muted)"
          >
            <span
              className="block h-full rounded-full bg-(--t-action-primary)"
              style={{
                width: `${Math.max(2, (row.count / Math.max(1, total)) * 100)}%`,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Section({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <section className="grid gap-3 border-t border-(--t-border-line) pt-4">
      <h3 className="type-label m-0 text-(--t-ink-dim)">{title}</h3>
      {children}
    </section>
  )
}

type Population = NonNullable<AtlasCountryDetail["population"]>
type Source = AtlasCountryDetail["sources"][number]

const ghostPill =
  "inline-flex min-h-11 items-center rounded-full border border-(--t-border-line) px-4 font-semibold text-(--t-ink-base) no-underline hover:bg-(--t-bg-surface)"

/** Several records share one boundary: ask which to explore. */
function CountryChoices({
  choices,
  onPick,
}: {
  readonly choices: AtlasCountryOption[]
  readonly onPick: (slug: string) => void
}) {
  return (
    <div className="grid gap-4 p-[18px] text-sm">
      <p className="m-0 text-base leading-relaxed">
        This area is recorded as {choices.length} separate countries. Choose one
        to explore.
      </p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {choices.map((choice) => (
          <li key={choice.slug}>
            <button
              type="button"
              onClick={() => onPick(choice.slug)}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) px-4 text-left font-semibold hover:bg-(--t-bg-surface)"
            >
              {choice.name}
              <span className="text-sm font-normal text-(--t-ink-dim)">
                {number(choice.libraries)} libraries
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The stored population, else the World Bank baseline for a whole boundary. */
function countryPopulation(
  country: AtlasCountryOption,
  data: AtlasCountryDetail | undefined
) {
  const stored = data?.population?.count
  if (stored !== undefined) return stored
  if (country.boundary && country.boundary === country.iso3)
    return baselinePopulation(country.boundary)

  return null
}

/** A link when the source has an address, plain text otherwise. */
function SourceName({
  name,
  url,
}: {
  readonly name: React.ReactNode
  readonly url: string | null | undefined
}) {
  if (!url) return name

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {name}
    </a>
  )
}

/** Where the population figure comes from. */
function PopulationNote({
  stored,
  population,
}: {
  readonly stored: Population | null | undefined
  readonly population: number | null
}) {
  if (stored?.source)
    return (
      <p className="m-0 text-xs text-(--t-ink-dim)">
        Population {stored.year ? `${stored.year}, ` : ""}
        <SourceName name={stored.source} url={stored.sourceUrl} />
        {stored.licence ? ` · ${stored.licence}` : ""}
      </p>
    )
  if (!population) return null

  return (
    <p className="m-0 text-xs text-(--t-ink-dim)">
      Population: World Bank, CC BY 4.0
    </p>
  )
}

function CountryStats({
  libraries,
  population,
  rate,
  regionCount,
}: {
  readonly libraries: number | null
  readonly population: number | null
  readonly rate: number | null
  readonly regionCount: number | null
}) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-2">
      {[
        ["Libraries", libraries === null ? "—" : number(libraries)],
        ["People", population ? compact(population) : "—"],
        ["Per 100,000 people", rate === null ? "—" : String(rate)],
        ["Regions", regionCount === null ? "—" : number(regionCount)],
      ].map(([label, value]) => (
        <div
          key={label}
          className="rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-2.5"
        >
          <dt className="text-xs text-(--t-ink-dim)">{label}</dt>
          <dd className="m-0 text-lg font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CountryActions({
  filtered,
  placeHref,
  onShow,
  onClearFilter,
}: {
  readonly filtered: boolean
  readonly placeHref: string | null
  readonly onShow: () => void
  readonly onClearFilter: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filtered ? (
        <button
          type="button"
          onClick={onClearFilter}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 font-semibold"
        >
          <Icon aria-hidden icon="mdi:close" width={16} />
          Show every country
        </button>
      ) : (
        <button
          type="button"
          onClick={onShow}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-(--t-action-primary) px-4 font-semibold text-white"
        >
          <Icon aria-hidden icon="mdi:filter-variant" width={16} />
          Show only these libraries
        </button>
      )}
      {placeHref ? (
        <GlobalLink
          href={placeHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--t-border-line) px-4 font-semibold text-(--t-ink-base) no-underline hover:bg-(--t-bg-surface)"
        >
          Country page
          <Icon aria-hidden icon="mdi:arrow-top-right" width={15} />
        </GlobalLink>
      ) : null}
    </div>
  )
}

function TypesSection({ data }: { readonly data: AtlasCountryDetail }) {
  const types = [...(data.libraryTypeCounts ?? [])].sort(
    (a, b) => b.count - a.count
  )
  if (!types.length) return null

  return (
    <Section title="By library type">
      <Bars
        total={types[0]!.count}
        rows={types
          .slice(0, 6)
          .map((t) => ({ key: t.type, label: t.type, count: t.count }))}
      />
    </Section>
  )
}

function RegionName({
  name,
  href,
}: {
  readonly name: string
  readonly href: string | null
}) {
  if (!href) return name

  return (
    <GlobalLink
      href={href}
      className="text-(--t-accent-primary) underline underline-offset-2"
    >
      {name}
    </GlobalLink>
  )
}

function RegionsSection({
  data,
  placeHref,
}: {
  readonly data: AtlasCountryDetail
  readonly placeHref: string | null
}) {
  if (!data.regions.length) return null

  return (
    <Section title="Regions with the most libraries">
      <Bars
        total={data.regions[0]!.libraryCount}
        rows={data.regions.slice(0, 6).map((region) => ({
          key: region.slug,
          count: region.libraryCount,
          label: (
            <RegionName
              name={region.name}
              href={placeHref && `${placeHref}/${region.slug}`}
            />
          ),
        }))}
      />
      {data.regionCount > 6 && placeHref ? (
        <GlobalLink
          href={placeHref}
          className="w-fit text-sm font-semibold text-(--t-accent-primary) underline underline-offset-2"
        >
          All {number(data.regionCount)} regions
        </GlobalLink>
      ) : null}
    </Section>
  )
}

function SourceRow({ source }: { readonly source: Source }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block font-semibold [overflow-wrap:anywhere]">
          <SourceName name={source.name} url={source.sourceUrl} />
        </span>
        {source.publisher || source.licence ? (
          <span className="block text-xs text-(--t-ink-dim)">
            {[source.publisher, source.licence].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-(--t-ink-dim) tabular-nums">
        {number(source.count)}
      </span>
    </li>
  )
}

function SourcesSection({ data }: { readonly data: AtlasCountryDetail }) {
  if (!data.sources.length && !data.community) return null

  return (
    <Section title="Where the records come from">
      <ul className="m-0 grid list-none gap-2 p-0">
        {data.sources.map((source) => (
          <SourceRow key={source.key} source={source} />
        ))}
        {data.community ? (
          <li className="flex items-start justify-between gap-3">
            <span className="font-semibold">Added by contributors</span>
            <span className="shrink-0 text-(--t-ink-dim) tabular-nums">
              {number(data.community)}
            </span>
          </li>
        ) : null}
      </ul>
    </Section>
  )
}

function GapsSection({
  data,
  country,
}: {
  readonly data: AtlasCountryDetail
  readonly country: AtlasCountryOption
}) {
  const gaps = GAP_ORDER.flatMap((key) => {
    const count = data.gaps[key] ?? 0

    return count > 0 ? [{ key, count }] : []
  }).slice(0, 4)
  if (!gaps.length) return null

  return (
    <Section title="Help fill the gaps">
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {gaps.map((gap) => (
          <li key={gap.key} className="flex items-center justify-between gap-3">
            <span>Missing {GAP_LABEL.get(gap.key)?.toLowerCase()}</span>
            <span className="text-(--t-ink-dim) tabular-nums">
              {number(gap.count)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <GlobalLink
          href={proposeHref({
            gaps: [gaps[0]!.key],
            places: { country: [country.slug] },
          })}
          className={ghostPill}
        >
          Propose a drive
        </GlobalLink>
        <GlobalLink
          href={placeAddHref({
            continent: country.continent ?? undefined,
            country: country.slug,
          })}
          className={ghostPill}
        >
          Add a missing library
        </GlobalLink>
      </div>
    </Section>
  )
}

/** The loaded breakdown, a retry after a failure, or a loading note. */
function CountryBreakdown({
  data,
  failed,
  country,
  placeHref,
  onRetry,
}: {
  readonly data: AtlasCountryDetail | undefined
  readonly failed: boolean
  readonly country: AtlasCountryOption
  readonly placeHref: string | null
  readonly onRetry: () => void
}) {
  if (failed)
    return (
      <p role="alert" className="m-0">
        The breakdown didn’t load.{" "}
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer font-semibold text-(--t-accent-primary) underline"
        >
          Try again
        </button>
      </p>
    )
  if (!data)
    return (
      <p role="status" className="m-0 text-(--t-ink-dim)">
        Loading the breakdown…
      </p>
    )

  return (
    <>
      <TypesSection data={data} />
      <RegionsSection data={data} placeHref={placeHref} />
      <SourcesSection data={data} />
      <GapsSection data={data} country={country} />
    </>
  )
}

/**
 * The Atlas country drawer: headline numbers, libraries by type, region and
 * origin Dataset, the gaps contributors could fill, and ways to act on them.
 * A boundary drawn for several records (the UK's nations) offers a choice.
 */
export function AtlasCountryPanel({
  country,
  choices,
  filtered,
  onShow,
  onClearFilter,
  onPick,
}: {
  /** The country to show, or null while a shared boundary asks for a choice. */
  readonly country: AtlasCountryOption | null
  /** The records one boundary stands for, when there are several. */
  readonly choices: AtlasCountryOption[]
  readonly filtered: boolean
  readonly onShow: () => void
  readonly onClearFilter: () => void
  readonly onPick: (slug: string) => void
}) {
  const locale = useLocale()
  const slug = country?.slug ?? null
  const [state, setState] = useState<{
    slug: string | null
    data?: AtlasCountryDetail
    failed?: boolean
  }>({ slug: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    fetch(
      `/api/atlas/countries/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("unavailable")
        const json = (await res.json()) as { data: AtlasCountryDetail }
        setState({ slug, data: json.data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ slug, failed: true })
      })

    return () => controller.abort()
  }, [slug, locale, attempt])
  const data = state.slug === slug ? state.data : undefined
  const failed = state.slug === slug && Boolean(state.failed)

  if (!country) return <CountryChoices choices={choices} onPick={onPick} />

  const libraries = data?.libraryCount ?? country.libraries
  const population = countryPopulation(country, data)
  const rate = perHundredThousand(libraries, population)
  const placeHref = country.continent
    ? `/${country.continent}/${country.slug}`
    : null

  return (
    <div className="grid gap-4 p-[18px] text-sm">
      <p className="m-0 text-sm text-(--t-ink-dim)">
        {flag(country.iso2) ? (
          <span aria-hidden className="mr-1.5">
            {flag(country.iso2)}
          </span>
        ) : null}
        {data?.continent?.name ?? "Country"}
      </p>

      <CountryStats
        libraries={libraries}
        population={population}
        rate={rate}
        regionCount={data ? data.regionCount : null}
      />
      <PopulationNote stored={data?.population} population={population} />

      <CountryActions
        filtered={filtered}
        placeHref={placeHref}
        onShow={onShow}
        onClearFilter={onClearFilter}
      />

      <CountryBreakdown
        data={data}
        failed={failed}
        country={country}
        placeHref={placeHref}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    </div>
  )
}
