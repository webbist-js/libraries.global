import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { DrivesHere } from "@/components/drives/DrivesHere"
import { MainContent } from "@/components/ds/MainContent"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
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
  LocationHero,
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
import type { PopulatedContinentData } from "@/lib/strapi-api/content/server"

/**
 * Notes under a continent's Countries heading, for lists that need
 * explaining. Keyed by continent slug.
 */
const COUNTRY_NOTES: Record<string, { slugs: string[]; note: string }> = {
  europe: {
    slugs: ["england", "scotland", "wales", "northern-ireland"],
    note: "England, Scotland, Wales and Northern Ireland are listed separately because each runs its own library services.",
  },
}

export async function ContinentDetailPage({
  continent,
  locale,
  slug,
  drives = [],
  gapRows = null,
  untranslatedLocale = null,
}: {
  readonly continent: PopulatedContinentData | null
  readonly locale: Locale
  readonly untranslatedLocale?: string | null
  readonly slug: string
  readonly gapRows?: readonly PlaceGapInsight[] | null
  readonly drives?: readonly { view: DriveView; here: number }[] | null
}) {
  const tUi = await getUiTranslations("ui")

  if (!continent) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} />
        <MainContent className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>Continent not found.</p>
        </MainContent>
      </div>
    )
  }

  const name = continent.name ?? ""
  const place = { continent: slug }
  const addHref = placeAddHref(place)
  const countsAvailable = continent.statistics?.libraries !== false
  const childrenAvailable = continent.statistics?.children !== false
  const countries = continent.countries ?? []
  const libraryCount = continent.libraryCount ?? 0
  const regionCount = continent.regionsWithLibraries
  const withLibraries = countries.filter((c) => (c.libraryCount ?? 0) > 0)
  const emptyCount = countries.length - withLibraries.length
  const hasFeaturedLibraries = Boolean(continent.featuredLibraries?.length)

  const points: HeroMapCountPoint[] = withLibraries.flatMap((c) =>
    c.center && (c.placeBasedCount ?? 0) > 0
      ? [
          {
            id: c.slug,
            name: c.name,
            href: `/${slug}/${c.slug}`,
            lat: c.center.lat,
            lng: c.center.lng,
            count: c.placeBasedCount ?? 0,
          },
        ]
      : []
  )
  const bounds = {
    ne: continent.mapConfig?.boundingBoxNE,
    sw: continent.mapConfig?.boundingBoxSW,
  }
  const hasMap = points.length > 0 || Boolean(bounds.ne && bounds.sw)

  const noteEntry = COUNTRY_NOTES[slug]
  const countriesNote =
    noteEntry &&
    noteEntry.slugs.every((s) => countries.some((c) => c.slug === s))
      ? noteEntry.note
      : null

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <MainContent id="main" className="relative z-10 flex-1">
        <LocationHero
          untranslatedLocale={untranslatedLocale}
          breadcrumbLabels={{ [slug]: name }}
          typeLabel="Continent"
          typeIcon="mdi:earth"
          title={name}
          contribution={
            <PlaceFeaturedContribution
              gaps={gapRows}
              level="continent"
              slug={slug}
              name={name}
              place={place}
              childPlaces={countries}
              childrenAvailable={childrenAvailable}
              drives={drives}
            />
          }
          intro={placeSummary({
            name,
            total: libraryCount,
            children: countries,
            noun: { singular: "country", plural: "countries" },
            available: countsAvailable,
            childrenAvailable,
          })}
          stats={[
            {
              value: countsAvailable
                ? formatCount(libraryCount)
                : "Unavailable",
              label: `${countNoun(libraryCount, tUi("library"), tUi("libraries"))} documented`,
              note: "Each library counted once",
            },
            ...(childrenAvailable && countries.length > 0
              ? [
                  {
                    value:
                      emptyCount > 0
                        ? `${formatCount(withLibraries.length)} of ${formatCount(countries.length)}`
                        : formatCount(countries.length),
                    label: "Countries with libraries",
                    note: emptyCount
                      ? formatCount(emptyCount) + " await their first record"
                      : "Every listed country has records",
                  },
                ]
              : []),
            ...(childrenAvailable && regionCount != null && regionCount > 0
              ? [
                  {
                    value:
                      continent.regionCount != null
                        ? formatCount(regionCount) +
                          " of " +
                          formatCount(continent.regionCount)
                        : formatCount(regionCount),
                    label: "Regions with documented libraries",
                    note: "Recorded across these countries",
                  },
                ]
              : []),
          ]}
          search={{ level: "continent", slug }}
          aside={
            hasMap ? (
              <LocationHeroMap
                label={`Map of place-based libraries documented in ${name}`}
                caption={
                  points.length > 0
                    ? "Place-based libraries documented per country. Select a group to zoom in."
                    : `No place-based libraries mapped in ${name} yet.`
                }
                countryRecords={
                  childrenAvailable
                    ? countries.map((country) => ({
                        iso2: country.iso2,
                        count: country.placeBasedCount ?? 0,
                      }))
                    : []
                }
                listHref="#countries"
                points={points}
                bounds={bounds}
                childNoun={{ singular: "country", plural: "countries" }}
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
                level="continent"
                slug={slug}
                total={libraryCount}
                types={continent.libraryTypeCounts}
                typesAvailable={continent.statistics?.types !== false}
                childrenAvailable={
                  childrenAvailable &&
                  countries.every(
                    (child) => child.placeBasedCount !== undefined
                  )
                }
                childPlaces={countries.map((child) => ({
                  slug: child.slug,
                  name: child.name,
                  count: child.placeBasedCount ?? 0,
                }))}
              />
            ) : null}
            {countries.length > 0 ? (
              <LocationChildBrowser
                coverageLabel="Regions with records"
                id="countries"
                title={tUi("countries")}
                description={countriesNote}
                totalCount={
                  libraryCount -
                  ((continent.libraryTypeCounts ?? []).find(
                    (row) => row.type === "Digital"
                  )?.count ?? 0)
                }
                shareLabel={
                  "Share of " + name + "’s documented place-based libraries"
                }
                countsAvailable={childrenAvailable}
                noun={{ singular: "country", plural: "countries" }}
                addHref={addHref}
                items={countries.map((c) => ({
                  slug: c.slug,
                  name: c.name,
                  subtitle: c.capitalCity ?? null,
                  coverage:
                    c.descendantWithRecords != null
                      ? formatCount(c.descendantWithRecords) +
                        (c.descendantTotal != null
                          ? " of " + formatCount(c.descendantTotal)
                          : "") +
                        " " +
                        (c.descendantTotal === 1 ||
                        (c.descendantTotal == null &&
                          c.descendantWithRecords === 1)
                          ? lowerFirst(placeLabels(c).region.singular)
                          : lowerFirst(placeLabels(c).region.plural))
                      : null,
                  href: `/${slug}/${c.slug}`,
                  count: c.libraryCount ?? 0,
                  shareCount: c.placeBasedCount ?? 0,
                  addHref: placeAddHref({ ...place, country: c.slug }),
                }))}
              />
            ) : null}

            {hasFeaturedLibraries ? (
              <section id="institutions" className="scroll-mt-24">
                <LocationSectionHeading
                  title={tUi("libraries_worth_knowing")}
                  description={`The most significant institutions across ${name}.`}
                />
                <LocationFeaturedLibraries
                  libraries={continent.featuredLibraries}
                  placeFor={(library) => library.country?.name ?? null}
                />
              </section>
            ) : null}

            <LocationAbout name={name} about={continent.about} />

            <DrivesHere
              placeName={name}
              items={drives}
              addHref={addHref}
              proposeHref={proposeHref({ places: { continent: [slug] } })}
            />

            <LocationHelpPanel
              addHref={addHref}
              name={name}
              body={
                emptyCount > 0
                  ? "Some countries have no libraries documented yet. Know one? You could add the first."
                  : "Know a library we’ve missed, or seen its hours change? A reviewer checks every addition before it’s published."
              }
              actions={locationHelpActions({
                propose: {
                  placeName: name,
                  href: proposeHref({ places: { continent: [slug] } }),
                },
              })}
            />
          </div>
        </Container>
      </MainContent>
    </div>
  )
}

ContinentDetailPage.displayName = "ContinentDetailPage"

export default ContinentDetailPage
