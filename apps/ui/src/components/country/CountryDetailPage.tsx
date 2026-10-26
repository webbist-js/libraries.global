import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { DrivesHere } from "@/components/drives/DrivesHere"
import { MainContent } from "@/components/ds/MainContent"
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
import {
  locationHelpActions,
  LocationHelpPanel,
} from "@/components/location/LocationHelpPanel"
import {
  LocationEmptyState,
  LocationHero,
  type LocationHeroStat,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import {
  type HeroMapCountPoint,
  LocationHeroMap,
} from "@/components/location/LocationHeroMap"
import { placeSummary } from "@/components/location/place-summary"
import { PlaceFeaturedContribution } from "@/components/location/PlaceFeaturedContribution"
import {
  PlaceInsights,
  type PlaceGapInsight,
} from "@/components/location/PlaceInsights"
import { placeAddHref } from "@/lib/contribution-place"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"
import { proposeHref } from "@/lib/drives/propose-link"
import { Link } from "@/lib/navigation"
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
  drives = [],
  gapRows = null,
  untranslatedLocale = null,
}: {
  country: PopulatedCountryData
  locale: Locale
  readonly untranslatedLocale?: string | null
  slug: string
  continentSlug: string
  gapRows?: readonly PlaceGapInsight[] | null
  drives?: readonly { view: DriveView; here: number }[] | null
}) {
  const tUi = useUiTranslations("ui")

  const name = country.name ?? ""
  const place = { continent: continentSlug, country: slug }
  const addHref = placeAddHref(place)
  const countsAvailable = country.statistics?.libraries !== false
  const childrenAvailable = country.statistics?.children !== false
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
    (top.libraryCount ?? 0) > 0 &&
    (top.libraryCount ?? 0) > (runnerUp?.libraryCount ?? 0)
      ? top
      : null

  const stats: LocationHeroStat[] = [
    {
      value: countsAvailable ? formatCount(libraryCount) : "Unavailable",
      label: `${countNoun(libraryCount, "Library", "Libraries")} documented`,
      note: "Each library counted once",
    },
  ]
  if (childrenAvailable && regions.length > 0) {
    stats.push({
      value:
        emptyCount > 0
          ? `${formatCount(withLibraries.length)} of ${formatCount(regions.length)}`
          : formatCount(regions.length),
      label: `${labels.plural} with libraries`,
      note: emptyCount
        ? formatCount(emptyCount) + " await their first record"
        : "Every listed place has records",
    })
  }
  if (childrenAvailable && leader) {
    stats.push({
      value: formatCount(leader.libraryCount ?? 0),
      label: `In ${leader.name}`,
      note: `The most records of any ${labels.singular}`,
    })
  }

  const points: HeroMapCountPoint[] = withLibraries.flatMap((r) =>
    r.center && (r.placeBasedCount ?? 0) > 0
      ? [
          {
            id: r.slug,
            name: r.name,
            href: `${basePath}/${r.slug}`,
            lat: r.center.lat,
            lng: r.center.lng,
            count: r.placeBasedCount ?? 0,
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

      <MainContent id="main" className="relative z-10 flex-1">
        <LocationHero
          untranslatedLocale={untranslatedLocale}
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
          contribution={
            <PlaceFeaturedContribution
              gaps={gapRows}
              level="country"
              slug={slug}
              name={name}
              place={place}
              childPlaces={regions}
              childNoun={labels.singular}
              childrenAvailable={childrenAvailable}
              drives={drives}
            />
          }
          intro={placeSummary({
            name,
            total: libraryCount,
            children: regions,
            noun: { singular: labels.singular, plural: pluralLower },
            available: countsAvailable,
            childrenAvailable,
          })}
          stats={stats}
          search={{ level: "country", slug }}
          aside={
            hasMap ? (
              <LocationHeroMap
                label={`Map of place-based libraries documented in ${name}`}
                caption={
                  points.length > 0
                    ? `Place-based libraries documented per ${labels.singular}. Select a group to zoom in.`
                    : `No place-based libraries mapped in ${name} yet.`
                }
                listHref="#regions"
                points={points}
                bounds={bounds}
                childNoun={{ singular: labels.singular, plural: pluralLower }}
              />
            ) : undefined
          }
        />

        <Container>
          <div className="flex flex-col gap-16 pt-14 pb-20">
            {countsAvailable ? (
              <PlaceInsights
                gapRows={gapRows}
                name={name}
                level="country"
                slug={slug}
                total={libraryCount}
                types={country.libraryTypeCounts}
                typesAvailable={country.statistics?.types !== false}
                childrenAvailable={
                  childrenAvailable &&
                  regions.every((child) => child.placeBasedCount !== undefined)
                }
                childPlaces={regions.map((child) => ({
                  slug: child.slug,
                  name: child.name,
                  count: child.placeBasedCount ?? 0,
                }))}
              />
            ) : null}
            <p className="mb-6">
              <Link
                className="font-semibold underline underline-offset-4"
                href={`${basePath}/library-services`}
              >
                Explore library services and networks in {name}
              </Link>
            </p>
            {regions.length > 0 ? (
              <LocationChildBrowser
                id="regions"
                title={labels.plural}
                description={country.systemDescription}
                totalCount={
                  libraryCount -
                  ((country.libraryTypeCounts ?? []).find(
                    (row) => row.type === "Digital"
                  )?.count ?? 0)
                }
                shareLabel={
                  "Share of " + name + "’s documented place-based libraries"
                }
                countsAvailable={childrenAvailable}
                noun={{ singular: labels.singular, plural: pluralLower }}
                addHref={addHref}
                items={regions.map((r) => ({
                  slug: r.slug,
                  name: r.name,
                  subtitle: r.typeLabel ?? null,
                  coverage:
                    r.descendantWithRecords != null
                      ? formatCount(r.descendantWithRecords) +
                        (r.descendantTotal != null
                          ? " of " + formatCount(r.descendantTotal)
                          : "") +
                        " " +
                        (r.descendantTotal === 1 ||
                        (r.descendantTotal == null &&
                          r.descendantWithRecords === 1)
                          ? lowerFirst(placeLabels(country, r).area.singular)
                          : lowerFirst(placeLabels(country, r).area.plural))
                      : null,
                  href: `${basePath}/${r.slug}`,
                  count: r.libraryCount ?? 0,
                  shareCount: r.placeBasedCount ?? 0,
                  addHref: placeAddHref({ ...place, region: r.slug }),
                }))}
              />
            ) : !countsAvailable ? (
              <p role="status">
                Library statistics are temporarily unavailable. You can still
                use Find libraries.
              </p>
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
                  title={tUi("libraries_worth_knowing")}
                  description={`The most significant institutions across ${name}.`}
                />
                <LocationFeaturedLibraries
                  libraries={country.featuredLibraries}
                  placeFor={townOrRegion}
                />
              </section>
            ) : null}

            <LocationAbout name={name} about={country.about} />

            <LocationEventsStrip
              countrySlug={country.slug ?? undefined}
              locationLabel={name}
            />

            <DrivesHere
              placeName={name}
              items={drives}
              addHref={addHref}
              proposeHref={proposeHref({ places: { country: [slug] } })}
            />

            <LocationHelpPanel
              addHref={addHref}
              name={name}
              body={helpBody}
              actions={locationHelpActions({
                propose: {
                  placeName: name,
                  href: proposeHref({ places: { country: [slug] } }),
                },
              })}
            />
          </div>
        </Container>
      </MainContent>
    </div>
  )
}
