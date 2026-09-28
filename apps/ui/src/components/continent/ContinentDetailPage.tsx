import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import {
  countNoun,
  formatCount,
} from "@/components/location/location-page.helpers"
import { LocationAbout } from "@/components/location/LocationAbout"
import { LocationChildBrowser } from "@/components/location/LocationChildBrowser"
import { LocationFeaturedLibraries } from "@/components/location/LocationFeaturedLibraries"
import { LocationHelpPanel } from "@/components/location/LocationHelpPanel"
import {
  LocationHero,
  LocationHeroAction,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import {
  type HeroMapCountPoint,
  LocationHeroMap,
} from "@/components/location/LocationHeroMap"
import { T } from "@/lib/design-tokens"
import { buildLocationDescription } from "@/lib/seo/location"
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
}: {
  readonly continent: PopulatedContinentData | null
  readonly locale: Locale
  readonly slug: string
}) {
  if (!continent) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} />
        <main className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>Continent not found.</p>
        </main>
      </div>
    )
  }

  const name = continent.name ?? ""
  const countries = continent.countries ?? []
  const libraryCount = continent.libraryCount ?? 0
  const regionCount = continent.regionCount ?? 0
  const withLibraries = countries.filter((c) => (c.libraryCount ?? 0) > 0)
  const emptyCount = countries.length - withLibraries.length
  const hasFeaturedLibraries = Boolean(continent.featuredLibraries?.length)

  const points: HeroMapCountPoint[] = withLibraries.flatMap((c) =>
    c.center
      ? [
          {
            id: c.slug,
            name: c.name,
            href: `/${slug}/${c.slug}`,
            lat: c.center.lat,
            lng: c.center.lng,
            count: c.libraryCount ?? 0,
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

      <main className="relative z-10 flex-1">
        <LocationHero
          breadcrumbLabels={{ [slug]: name }}
          typeLabel="Continent"
          typeIcon="mdi:earth"
          title={name}
          intro={
            continent.summary ??
            buildLocationDescription({
              name,
              libraryCount,
              typeCounts: continent.libraryTypeCounts,
              childLabel: countries.length > 0 ? "country" : null,
            })
          }
          stats={[
            {
              value: formatCount(libraryCount),
              label: `${countNoun(libraryCount, "Library", "Libraries")} documented`,
            },
            ...(countries.length > 0
              ? [
                  {
                    value:
                      emptyCount > 0
                        ? `${formatCount(withLibraries.length)} of ${formatCount(countries.length)}`
                        : formatCount(countries.length),
                    label: "Countries with libraries",
                  },
                ]
              : []),
            ...(regionCount > 0
              ? [{ value: formatCount(regionCount), label: "Regions indexed" }]
              : []),
          ]}
          actions={
            <>
              <LocationHeroAction
                primary
                href={`/libraries?continent=${encodeURIComponent(slug)}`}
                icon="mdi:magnify"
              >
                Search libraries in {name}
              </LocationHeroAction>
              <LocationHeroAction href="/contribute/add" icon="mdi:plus">
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
                    ? "Libraries documented per country. Nearby countries are grouped: select a group to zoom in."
                    : `No libraries documented in ${name} yet.`
                }
                points={points}
                bounds={bounds}
                childNoun={{ singular: "country", plural: "countries" }}
              />
            ) : undefined
          }
        />

        <Container>
          <div className="flex flex-col gap-16 pt-14 pb-20">
            {countries.length > 0 ? (
              <LocationChildBrowser
                id="countries"
                title="Countries"
                description={countriesNote}
                noun={{ singular: "country", plural: "countries" }}
                addHref="/contribute/add"
                items={countries.map((c) => ({
                  slug: c.slug,
                  name: c.name,
                  subtitle: c.capitalCity ?? null,
                  href: `/${slug}/${c.slug}`,
                  count: c.libraryCount ?? 0,
                }))}
              />
            ) : null}

            {hasFeaturedLibraries ? (
              <section id="institutions" className="scroll-mt-24">
                <LocationSectionHeading
                  title="Libraries worth knowing"
                  description={`The most significant institutions across ${name}.`}
                />
                <LocationFeaturedLibraries
                  libraries={continent.featuredLibraries}
                  placeFor={(library) => library.country?.name ?? null}
                />
              </section>
            ) : null}

            <LocationAbout name={name} about={continent.about} />

            <LocationHelpPanel
              name={name}
              body={
                emptyCount > 0
                  ? "Some countries have no libraries documented yet. Know one? You could add the first."
                  : "Know a library we’ve missed, or seen its hours change? A reviewer checks every addition before it’s published."
              }
            />
          </div>
        </Container>
      </main>
    </div>
  )
}

ContinentDetailPage.displayName = "ContinentDetailPage"

export default ContinentDetailPage
