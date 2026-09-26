import Image from "next/image"
import type { Locale } from "next-intl"

import {
  CtaBannerSection,
  EditorialSection,
  LocationContributeCTA,
  LocationGridBrowser,
} from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import {
  LocationEmptyState,
  LocationHero,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import { LocationTabBar } from "@/components/location/LocationTabBar"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import { T } from "@/lib/design-tokens"
import type {
  PopulatedCountryData,
  EditorialBlock as EditorialBlockType,
  CtaBanner as CtaBannerType,
  PageSection,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// ── Page ────────────────────────────────────────────────────────────────────

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
  const typedSections = (country.sections ?? []) as PageSection[]

  const hasFeaturedLibraries =
    Array.isArray(country.featuredLibraries) &&
    country.featuredLibraries.length > 0
  const hasRegions =
    Array.isArray(country.regions) && country.regions.length > 0
  const heroImageUrl = (
    country.heroImage as { url?: string | null } | null | undefined
  )?.url
    ? formatStrapiMediaUrl((country.heroImage as { url: string }).url)
    : null

  const continentName = country.continent?.name
  const browseRegions = country.regions ?? []
  const regionLabel = country.regionTypeLabel ?? "Regions"
  const libraryCount =
    typeof country.libraryCount === "number" && country.libraryCount > 0
      ? country.libraryCount
      : null

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(hasFeaturedLibraries
      ? [{ id: "institutions", label: "Libraries" }]
      : []),
    ...(hasRegions ? [{ id: "regions", label: regionLabel }] : []),
    { id: "map", label: "Map" },
  ]

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1 pb-16">
        <LocationHero
          breadcrumbLabels={{
            ...(continentSlug && continentName
              ? { [continentSlug]: continentName }
              : {}),
            [slug]: country.name ?? "",
          }}
          typeLabel={country.iso2 ? `Country · ${country.iso2}` : "Country"}
          title={country.name ?? ""}
          intro={country.heroTagline ?? country.summary}
          stats={[
            {
              label: "Libraries",
              value: libraryCount
                ? new Intl.NumberFormat().format(libraryCount)
                : "—",
              note: libraryCount ? "Documented so far" : "None documented yet",
            },
            {
              label: regionLabel,
              value:
                typeof country.regionCount === "number" &&
                country.regionCount > 0
                  ? country.regionCount
                  : "—",
            },
            ...(country.capitalCity
              ? [{ label: "Capital", value: country.capitalCity }]
              : []),
          ]}
          aside={
            heroImageUrl ? (
              <figure
                className="relative m-0 hidden h-[200px] w-[300px] overflow-hidden rounded-3xl lg:block"
                style={{ border: `1px solid ${T.border.line}` }}
              >
                <Image
                  src={heroImageUrl}
                  alt={country.name ?? ""}
                  fill
                  priority
                  className="object-cover"
                />
              </figure>
            ) : undefined
          }
        />

        <LocationTabBar tabs={tabs} />

        <Container>
          <div className="flex flex-col gap-12 pt-10">
            {/* ── Pillar Institutions ─────────────────────────────────────── */}
            {hasFeaturedLibraries ? (
              <section id="institutions" className="scroll-mt-28">
                <LocationSectionHeading
                  title="Libraries worth knowing"
                  description={`The most significant institutions across ${country.name}.`}
                />
                <FeaturedLibraryCards libraries={country.featuredLibraries} />
              </section>
            ) : null}

            {/* ── Browse by Region ────────────────────────────────────────── */}
            {hasRegions ? (
              <section id="regions" className="scroll-mt-28">
                <LocationSectionHeading
                  title={`Browse by ${regionLabel.toLowerCase()}`}
                  count={
                    typeof country.regionCount === "number" &&
                    country.regionCount > 0
                      ? `${country.regionCount} ${regionLabel.toLowerCase()}`
                      : null
                  }
                />
                <LocationGridBrowser
                  items={browseRegions.map((region) => ({
                    slug: region.slug ?? "",
                    name: region.name ?? "",
                    subtitle: region.summary ?? null,
                    href: `/${continentSlug}/${slug}/${region.slug}`,
                  }))}
                />
              </section>
            ) : libraryCount ? (
              <div
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl px-7 py-6"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <p className="m-0 text-[16px]" style={{ color: T.ink.dim }}>
                  {libraryCount}{" "}
                  {libraryCount === 1 ? "library is" : "libraries are"}{" "}
                  documented in {country.name} — find them by name or on the map
                  below.
                </p>
                <GlobalLink
                  href={`/index?q=${encodeURIComponent(country.name ?? "")}`}
                  className="inline-flex items-center rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
                  style={{ background: T.accent.primary }}
                >
                  Find libraries in {country.name}
                </GlobalLink>
              </div>
            ) : (
              <LocationEmptyState name={country.name ?? "this country"} />
            )}

            {/* ── Map ─────────────────────────────────────────────────────── */}
            <section id="map" className="scroll-mt-28">
              <LocationSectionHeading
                title={`Map of ${country.name ?? "this country"}`}
                description="Every documented library, plotted. Zoom in to drill down."
              />
              <div
                className="overflow-hidden rounded-3xl"
                style={{ border: `1px solid ${T.border.line}` }}
              >
                <InteractiveMap
                  mapConfig={country.mapConfig}
                  mode="country"
                  countrySlug={slug}
                  continentSlug={continentSlug}
                  locale={locale}
                />
              </div>
            </section>

            {/* ── Events strip ────────────────────────────────────────────── */}
            {country.iso2 ? (
              <section className="scroll-mt-28">
                <LocationEventsStrip
                  countryCode={country.iso2}
                  locationLabel={country.name ?? ""}
                />
              </section>
            ) : null}
          </div>
        </Container>

        <div className="mt-14">
          <LocationContributeCTA
            locationName={country.name ?? undefined}
            entityType="country"
          />
        </div>

        {/* ── Dynamic zone sections ───────────────────────────────────────── */}
        {typedSections.map((section) => (
          <div key={section.id}>
            {section.__component === "sections.editorial-block" ? (
              <EditorialSection section={section as EditorialBlockType} />
            ) : section.__component === "sections.cta-banner" ? (
              <CtaBannerSection section={section as CtaBannerType} />
            ) : null}
          </div>
        ))}

        {/* ── Journey CTA fallback ────────────────────────────────────────── */}
        {typedSections.length === 0 && browseRegions[0] ? (
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
                Discover {country.name}
              </h2>
              <p
                className="mx-auto mt-3 mb-6 max-w-[46ch] text-[16px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                Explore the libraries, archives and cultural institutions across{" "}
                {country.name}.
              </p>
              <GlobalLink
                href={`/${continentSlug}/${slug}/${browseRegions[0].slug}`}
                className="inline-flex items-center rounded-full px-7 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
                style={{ background: T.accent.primary }}
              >
                Browse {browseRegions[0].name}
              </GlobalLink>
            </section>
          </Container>
        ) : null}
      </main>
    </div>
  )
}
