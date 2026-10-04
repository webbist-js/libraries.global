import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
  countNoun,
  formatCount,
  lowerFirst,
  placeLabels,
} from "@/components/location/location-page.helpers"
import { LocationAbout } from "@/components/location/LocationAbout"
import { LocationChildBrowser } from "@/components/location/LocationChildBrowser"
import { LocationFeaturedLibraries } from "@/components/location/LocationFeaturedLibraries"
import { LocationHelpPanel } from "@/components/location/LocationHelpPanel"
import {
  LocationEmptyState,
  LocationHero,
  LocationHeroAction,
  type LocationHeroStat,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import {
  type HeroMapCountPoint,
  LocationHeroMap,
} from "@/components/location/LocationHeroMap"
import { T } from "@/lib/design-tokens"
import { buildLocationDescription } from "@/lib/seo/location"
import type {
  PopulatedCountryData,
  PopulatedFeaturedLibraryData,
} from "@/lib/strapi-api/content/server"

function townOrRegion(library: PopulatedFeaturedLibraryData): string | null {
  return library.city ?? library.region?.name ?? null
}

export function CountryDetailPage({
  country,
  locale,
  slug,
  continentSlug,
}: {
  country: PopulatedCountryData
  locale: Locale
  slug: string
  continentSlug: string
}) {
  const name = country.name ?? ""
  const regions = country.regions ?? []
  const labels = placeLabels(country).region
  const pluralLower = lowerFirst(labels.plural)
  const libraryCount = country.libraryCount ?? 0
  const withLibraries = regions.filter((r) => (r.libraryCount ?? 0) > 0)
  const emptyCount = regions.length - withLibraries.length
  const hasFeaturedLibraries = Boolean(country.featuredLibraries?.length)
  const basePath = `/${continentSlug}/${slug}`

  // The busiest region, when one clearly leads.
  const [top, runnerUp] = [...withLibraries].sort(
    (a, b) => (b.libraryCount ?? 0) - (a.libraryCount ?? 0)
  )
  const leader =
    top &&
    (top.libraryCount ?? 0) > 1 &&
    (top.libraryCount ?? 0) > (runnerUp?.libraryCount ?? 0)
      ? top
      : null

  const stats: LocationHeroStat[] = [
    {
      value: formatCount(libraryCount),
      label: `${countNoun(libraryCount, "Library", "Libraries")} documented`,
    },
  ]
  if (regions.length > 0) {
    stats.push({
      value:
        emptyCount > 0
          ? `${formatCount(withLibraries.length)} of ${formatCount(regions.length)}`
          : formatCount(regions.length),
      label: `${labels.plural} with libraries`,
    })
  }
  if (leader) {
    stats.push({
      value: formatCount(leader.libraryCount ?? 0),
      label: `In ${leader.name}, the most of any ${labels.singular}`,
    })
  }

  const points: HeroMapCountPoint[] = withLibraries.flatMap((r) =>
    r.center
      ? [
          {
            id: r.slug,
            name: r.name,
            href: `${basePath}/${r.slug}`,
            lat: r.center.lat,
            lng: r.center.lng,
            count: r.libraryCount ?? 0,
          },
        ]
      : []
  )
  const bounds = {
    ne: country.mapConfig?.boundingBoxNE,
    sw: country.mapConfig?.boundingBoxSW,
  }
  const hasMap = points.length > 0 || Boolean(bounds.ne && bounds.sw)

  // Most places with records have only one or two so far.
  const sparse =
    withLibraries.length > 0 &&
    withLibraries.filter((r) => (r.libraryCount ?? 0) <= 2).length /
      withLibraries.length >=
      0.6
  const helpBody = sparse
    ? `Most ${pluralLower} have only one or two libraries documented so far. Add your local library, or check that its hours are right.`
    : emptyCount > 0
      ? `Some ${pluralLower} have no libraries documented yet. Know one? You could add the first.`
      : "Know a library we’ve missed, or seen its hours change? A reviewer checks every addition before it’s published."

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <LocationHero
          breadcrumbLabels={{
            ...(continentSlug && country.continent?.name
              ? { [continentSlug]: country.continent.name }
              : {}),
            [slug]: name,
          }}
          typeLabel="Country"
          typeIcon="mdi:flag-outline"
          code={country.iso2}
          title={name}
          intro={
            country.heroTagline ??
            country.summary ??
            buildLocationDescription({
              name,
              libraryCount,
              typeCounts: country.libraryTypeCounts,
              childLabel: regions.length > 0 ? labels.singular : null,
            })
          }
          stats={stats}
          actions={
            <>
              <LocationHeroAction
                primary
                href={`/libraries?country=${encodeURIComponent(slug)}`}
                icon="mdi:magnify"
              >
                Search libraries in {name}
              </LocationHeroAction>
              <LocationHeroAction href="/contribute/index/new" icon="mdi:plus">
                Add a library
              </LocationHeroAction>
            </>
          }
          aside={
            hasMap ? (
              <LocationHeroMap
                label={`Map of libraries documented in ${name}`}
                caption={
                  points.length > 0
                    ? `Libraries documented per ${labels.singular}. Nearby ${pluralLower} are grouped: select a group to zoom in.`
                    : `No libraries documented in ${name} yet.`
                }
                points={points}
                bounds={bounds}
                childNoun={{ singular: labels.singular, plural: pluralLower }}
              />
            ) : undefined
          }
        />

        <Container>
          <div className="flex flex-col gap-16 pt-14 pb-20">
            {regions.length > 0 ? (
              <LocationChildBrowser
                id="regions"
                title={labels.plural}
                description={country.systemDescription}
                noun={{ singular: labels.singular, plural: pluralLower }}
                addHref="/contribute/index/new"
                items={regions.map((r) => ({
                  slug: r.slug,
                  name: r.name,
                  subtitle: r.typeLabel ?? null,
                  href: `${basePath}/${r.slug}`,
                  count: r.libraryCount ?? 0,
                }))}
              />
            ) : libraryCount > 0 ? (
              <div
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl px-7 py-6"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
                  {formatCount(libraryCount)}{" "}
                  {libraryCount === 1 ? "library is" : "libraries are"}{" "}
                  documented in {name}.
                </p>
                <GlobalLink
                  href={`/libraries?country=${encodeURIComponent(slug)}`}
                  className="inline-flex items-center rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
                  style={{ background: T.accent.primary }}
                >
                  Find libraries in {name}
                </GlobalLink>
              </div>
            ) : (
              <LocationEmptyState name={name || "this country"} />
            )}

            {hasFeaturedLibraries ? (
              <section id="institutions" className="scroll-mt-24">
                <LocationSectionHeading
                  title="Libraries worth knowing"
                  description={`The most significant institutions across ${name}.`}
                />
                <LocationFeaturedLibraries
                  libraries={country.featuredLibraries}
                  placeFor={townOrRegion}
                />
              </section>
            ) : null}

            <LocationAbout name={name} about={country.about} />

            {country.iso2 ? (
              <LocationEventsStrip
                countryCode={country.iso2}
                locationLabel={name}
              />
            ) : null}

            <LocationHelpPanel name={name} body={helpBody} />
          </div>
        </Container>
      </main>
    </div>
  )
}
