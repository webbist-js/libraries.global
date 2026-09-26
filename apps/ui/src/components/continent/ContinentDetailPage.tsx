import type { Locale } from "next-intl"

import { ContinentHeroGlobe } from "@/components/continent/ContinentHeroGlobe"
import { LocationContributeCTA, LocationGridBrowser } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import {
  hasLocationAbout,
  LocationAbout,
} from "@/components/location/LocationAbout"
import {
  LocationEmptyState,
  LocationHero,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import { LocationTabBar } from "@/components/location/LocationTabBar"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import { T } from "@/lib/design-tokens"
import { buildLocationDescription } from "@/lib/seo/location"
import type { PopulatedContinentData } from "@/lib/strapi-api/content/server"

// ── Data ───────────────────────────────────────────────────────────────────

/** Published record coordinates for this continent — plotted on the hero globe. */
async function fetchContinentMarkers(slug: string) {
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${STRAPI}/api/libraries?pagination[pageSize]=500&fields[0]=location&fields[1]=featured&filters[continent][slug][$eq]=${encodeURIComponent(slug)}&status=published`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        location?: { lat?: number | string; lng?: number | string } | null
        featured?: boolean | null
      }[]
    }

    return (json.data ?? [])
      .map((entry) => ({
        lat: Number(entry.location?.lat),
        lng: Number(entry.location?.lng),
        featured: entry.featured === true,
      }))
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
  } catch {
    return []
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

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

  const allCountries = continent.countries ?? []
  const globeMarkers = await fetchContinentMarkers(slug)

  const hasFeaturedLibraries =
    Array.isArray(continent.featuredLibraries) &&
    continent.featuredLibraries.length > 0

  const libraryCount =
    typeof continent.libraryCount === "number" && continent.libraryCount > 0
      ? continent.libraryCount
      : null

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(hasFeaturedLibraries
      ? [{ id: "institutions", label: "Libraries" }]
      : []),
    ...(allCountries.length > 0
      ? [{ id: "countries", label: "Countries" }]
      : []),
    { id: "map", label: "Map" },
    ...(hasLocationAbout(continent.about)
      ? [{ id: "about", label: "About" }]
      : []),
  ]

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1 pb-16">
        <LocationHero
          breadcrumbLabels={{ [slug]: continent.name ?? "" }}
          typeLabel="Continent"
          title={continent.name ?? ""}
          intro={
            continent.summary ??
            buildLocationDescription({
              name: continent.name ?? "",
              libraryCount: continent.libraryCount,
              typeCounts: continent.libraryTypeCounts,
              childLabel: allCountries.length > 0 ? "country" : null,
            })
          }
          stats={[
            {
              label: "Countries",
              value: allCountries.length || "—",
            },
            {
              label: "Libraries",
              value: libraryCount
                ? new Intl.NumberFormat().format(libraryCount)
                : "—",
              note: libraryCount ? undefined : "None documented yet",
            },
            {
              label: "Regions",
              value:
                typeof continent.regionCount === "number" &&
                continent.regionCount > 0
                  ? new Intl.NumberFormat().format(continent.regionCount)
                  : "—",
            },
          ]}
          aside={<ContinentHeroGlobe slug={slug} markers={globeMarkers} />}
        />

        <LocationTabBar tabs={tabs} />

        <Container>
          <div className="flex flex-col gap-12 pt-10">
            {/* ── Pillar Institutions ─────────────────────────────────────── */}
            {hasFeaturedLibraries ? (
              <section id="institutions" className="scroll-mt-28">
                <LocationSectionHeading
                  title="Libraries worth knowing"
                  description={`The most significant institutions across ${continent.name}.`}
                />
                <FeaturedLibraryCards libraries={continent.featuredLibraries} />
              </section>
            ) : null}

            {/* ── Browse by Country ───────────────────────────────────────── */}
            {allCountries.length > 0 ? (
              <section id="countries" className="scroll-mt-28">
                <LocationSectionHeading
                  title="Browse by country"
                  count={`${allCountries.length} ${allCountries.length === 1 ? "country" : "countries"}`}
                />
                <LocationGridBrowser
                  items={(
                    allCountries as {
                      name: string
                      slug: string
                      capitalCity?: string | null
                    }[]
                  ).map((country) => ({
                    slug: country.slug,
                    name: country.name,
                    subtitle: country.capitalCity ?? null,
                    href: `/${slug}/${country.slug}`,
                  }))}
                />
              </section>
            ) : (
              <LocationEmptyState name={continent.name ?? "this continent"} />
            )}

            {/* ── Map ─────────────────────────────────────────────────────── */}
            <section id="map" className="scroll-mt-28">
              <LocationSectionHeading
                title={`Map of ${continent.name ?? "the continent"}`}
                description="Every documented library, plotted. Zoom in to drill down."
              />
              <div
                className="overflow-hidden rounded-3xl"
                style={{ border: `1px solid ${T.border.line}` }}
              >
                <InteractiveMap
                  mode="continent"
                  continentSlug={slug}
                  locale={locale}
                />
              </div>
            </section>

            {/* ── About (optional CMS copy) ───────────────────────────────── */}
            <LocationAbout
              name={continent.name ?? ""}
              about={continent.about}
            />
          </div>
        </Container>

        <div className="mt-14">
          <LocationContributeCTA
            locationName={continent.name ?? undefined}
            entityType="continent"
          />
        </div>

        {/* ── Journey CTA fallback ────────────────────────────────────────── */}
        {allCountries.length > 0 ? (
          <Container>
            <section
              className="mt-14 rounded-3xl px-8 py-14 text-center"
              style={{ background: T.bg.space }}
            >
              <h2
                className="m-0 text-[clamp(28px,4vw,44px)]"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  color: T.ink.base,
                }}
              >
                Start exploring {continent.name}
              </h2>
              <p
                className="mx-auto mt-3 mb-6 max-w-[46ch] text-[16px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                Libraries across {continent.name} are waiting to be explored —
                country by country, shelf by shelf.
              </p>
              <GlobalLink
                href={`/${slug}/${allCountries[0]!.slug}`}
                className="inline-flex items-center rounded-full px-7 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
                style={{ background: T.accent.primary }}
              >
                Start exploring
              </GlobalLink>
            </section>
          </Container>
        ) : null}
      </main>
    </div>
  )
}

ContinentDetailPage.displayName = "ContinentDetailPage"

export default ContinentDetailPage
