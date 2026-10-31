import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { DrivesHere } from "@/components/drives/DrivesHere"
import { MainContent } from "@/components/ds/MainContent"
import { Container } from "@/components/elementary/Container"
import { LibraryAnchorNav } from "@/components/library/LibraryAnchorNav"
import { LIB_ICONS } from "@/components/library/LibrarySectionCard"
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
import {
  LocationHierarchy,
  LocationSidebarCta,
} from "@/components/location/LocationSidebar"
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
import { sidebarLibraryPreview } from "@/lib/location-sidebar-server"
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
  const d = await getUiTranslations("dashboard")

  if (!continent) {
    return (
      <div
        className="relative isolate flex min-h-0 w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
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

  const hierarchyLibraries =
    countsAvailable && libraryCount > 0
      ? await sidebarLibraryPreview("continent", slug, locale)
      : []

  const dashboardContext = (
    <>
      <DrivesHere
        placeName={name}
        items={drives}
        addHref={addHref}
        proposeHref={proposeHref({ places: { continent: [slug] } })}
      />
      <PlaceFeaturedContribution
        gaps={gapRows}
        level="continent"
        slug={slug}
        name={name}
        place={place}
        childPlaces={countries}
        childrenAvailable={childrenAvailable}
        drives={[]}
      />
    </>
  )

  const sectionItems = [
    { href: "#overview", label: "Overview", icon: LIB_ICONS.map },

    { href: "#countries", label: "Countries", icon: LIB_ICONS.list },
    {
      href: "#drives-here",
      label: d("getInvolved"),
      icon: LIB_ICONS.people,
    },
  ]

  return (
    <DashboardPage
      mobileSections={sectionItems}
      routeKey={`/${slug}`}
      title={name}
      navigationHeading={
        <RecordContextIdentity
          title={name}
          eyebrow="Continent"
          parent={{ href: "/map", label: tUi("atlas") }}
        >
          <p className="record-context-summary">
            {countsAvailable ? (
              <>
                {formatCount(libraryCount)}{" "}
                {countNoun(libraryCount, tUi("library"), tUi("libraries"))}
                {childrenAvailable ? (
                  <> · {countries.length + " countries"}</>
                ) : null}
              </>
            ) : (
              "Library counts unavailable"
            )}
          </p>
        </RecordContextIdentity>
      }
      navigationFooter={
        <LocationSidebarCta
          name={name}
          addHref={addHref}
          proposeHref={proposeHref({ places: { continent: [slug] } })}
        />
      }
      eyebrow="Continent"
      className="dashboard-place-record"
      toolbar={<RecordToolbar labels={{ [slug]: name }} />}
      overview={
        <LocationHero
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
          search={{ level: "continent", slug }}
          untranslatedLocale={untranslatedLocale}
          typeLabel="Continent"
          typeIcon="mdi:earth"
          title={name}
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
        />
      }
      context={dashboardContext}
      navigation={
        <>
          <LibraryAnchorNav sidebar items={sectionItems} />
          <LocationHierarchy
            entries={[
              {
                href: `/${slug}`,
                label: name,
                current: true,
                count: countsAvailable ? libraryCount : undefined,
              },
              ...countries
                .filter((child) => (child.libraryCount ?? 0) > 0)
                .slice(0, 8)
                .flatMap((child) => [
                  {
                    href: `/${slug}/${child.slug}`,
                    label: child.name,
                    count: childrenAvailable ? child.libraryCount : undefined,
                    depth: 1,
                  },
                  ...Array.from(
                    new Set(
                      hierarchyLibraries
                        .filter((lib) => lib.country_slug === child.slug)
                        .map((lib) => lib.region_slug)
                        .filter(Boolean)
                    )
                  ).flatMap((regionSlug) => [
                    {
                      href: `/${slug}/${child.slug}/${regionSlug}`,
                      label:
                        hierarchyLibraries.find(
                          (lib) => lib.region_slug === regionSlug
                        )?.region_name ?? regionSlug!,
                      depth: 2,
                    },
                    ...hierarchyLibraries
                      .filter(
                        (lib) =>
                          lib.country_slug === child.slug &&
                          lib.region_slug === regionSlug
                      )
                      .map((lib) => ({
                        href: `/${slug}/${child.slug}/${regionSlug}/${lib.slug}`,
                        label: lib.name,
                        depth: 3,
                      })),
                  ]),
                ]),
            ]}
          />
        </>
      }
    >
      <div
        className="relative isolate flex min-h-0 w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <MainContent id="main" className="relative z-10 flex-1">
          <Container>
            <div className="record-section-stack flex flex-col">
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

              <LocationAbout name={name} about={continent.about} />

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
    </DashboardPage>
  )
}

ContinentDetailPage.displayName = "ContinentDetailPage"

export default ContinentDetailPage
