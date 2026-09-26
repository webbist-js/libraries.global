import { Icon } from "@iconify/react"
import Image from "next/image"
import type { Locale } from "next-intl"

import { LocationContributeCTA, LocationGridBrowser } from "@/components/ds"
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
import { buildLocationDescription } from "@/lib/seo/location"
import type {
  PopulatedRegionData,
  QuickLink,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// ── Quick link card ──────────────────────────────────────────────────────────

function QuickLinkCard({ link }: { link: QuickLink }) {
  const iconName = link.icon?.iconName ?? null

  return (
    <GlobalLink
      href={link.href}
      className="group flex items-start gap-4 rounded-2xl px-5 py-4 transition-colors hover:bg-(--t-bg-surface)"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: T.accent.chip, color: T.accent.primary }}
      >
        <Icon icon={iconName ?? "mdi:arrow-right"} className="size-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {link.label}
        </span>
        {link.description ? (
          <span className="text-[13px] leading-5" style={{ color: T.ink.dim }}>
            {link.description}
          </span>
        ) : null}
      </div>
    </GlobalLink>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function RegionDetailPage({
  region,
  locale,
  slug,
  countrySlug,
  continentSlug,
}: {
  region: PopulatedRegionData
  locale: Locale
  slug: string
  countrySlug: string
  continentSlug: string
}) {
  const hasFeaturedLibraries =
    Array.isArray(region.featuredLibraries) &&
    region.featuredLibraries.length > 0
  const hasQuickLinks =
    Array.isArray(region.quickLinks) && region.quickLinks.length > 0
  const hasAreas = Array.isArray(region.areas) && region.areas.length > 0

  const heroImageUrl = (
    region.heroImage as { url?: string | null } | null | undefined
  )?.url
    ? formatStrapiMediaUrl((region.heroImage as { url: string }).url)
    : null

  const countryName = region.country?.name
  const continentName =
    region.continent?.name ?? region.country?.continent?.name

  const areaTypeLabel = hasAreas
    ? ((region.areas![0] as { typeLabel?: string | null }).typeLabel ?? "Areas")
    : "Areas"
  const libraryCount =
    typeof region.libraryCount === "number" && region.libraryCount > 0
      ? region.libraryCount
      : null

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(hasFeaturedLibraries
      ? [{ id: "institutions", label: "Libraries" }]
      : []),
    ...(hasAreas ? [{ id: "areas", label: areaTypeLabel }] : []),
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
            ...(countrySlug && countryName
              ? { [countrySlug]: countryName }
              : {}),
            [slug]: region.name ?? "",
          }}
          typeLabel={region.typeLabel ?? "Region"}
          title={region.name ?? ""}
          intro={
            region.heroTagline ??
            region.summary ??
            buildLocationDescription({
              name: region.name ?? "",
              libraryCount: region.libraryCount,
              typeCounts: region.libraryTypeCounts,
              childLabel: hasAreas ? areaTypeLabel : null,
            })
          }
          stats={[
            {
              label: "Libraries",
              value: libraryCount
                ? new Intl.NumberFormat().format(libraryCount)
                : "—",
              note: libraryCount ? undefined : "None documented yet",
            },
            {
              label: areaTypeLabel,
              value:
                typeof region.areaCount === "number" && region.areaCount > 0
                  ? new Intl.NumberFormat().format(region.areaCount)
                  : "—",
            },
          ]}
          aside={
            heroImageUrl ? (
              <figure
                className="relative m-0 hidden h-[200px] w-[300px] overflow-hidden rounded-3xl lg:block"
                style={{ border: `1px solid ${T.border.line}` }}
              >
                <Image
                  src={heroImageUrl}
                  alt={region.name ?? ""}
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
                  description={`The most significant institutions across ${region.name}.`}
                />
                <FeaturedLibraryCards libraries={region.featuredLibraries} />
              </section>
            ) : null}

            {/* ── Areas grid ──────────────────────────────────────────────── */}
            {hasAreas ? (
              <section id="areas" className="scroll-mt-28">
                <LocationSectionHeading
                  title={`Browse by ${areaTypeLabel.toLowerCase()}`}
                  count={
                    typeof region.areaCount === "number" && region.areaCount > 0
                      ? `${region.areaCount} ${areaTypeLabel.toLowerCase()}`
                      : null
                  }
                />
                <LocationGridBrowser
                  items={region.areas!.map((area) => ({
                    slug: (area as { slug?: string }).slug ?? "",
                    name: (area as { name?: string }).name ?? "",
                    subtitle:
                      (area as { typeLabel?: string | null }).typeLabel ?? null,
                    href: `/${continentSlug}/${countrySlug}/${slug}/${(area as { slug?: string }).slug}`,
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
                  documented in {region.name} — find them by name or on the map
                  below.
                </p>
                <GlobalLink
                  href={`/index?q=${encodeURIComponent(region.name ?? "")}`}
                  className="inline-flex items-center rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
                  style={{ background: T.accent.primary }}
                >
                  Find libraries in {region.name}
                </GlobalLink>
              </div>
            ) : (
              <LocationEmptyState name={region.name ?? "this region"} />
            )}

            {/* ── Map ─────────────────────────────────────────────────────── */}
            <section id="map" className="scroll-mt-28">
              <LocationSectionHeading
                title={`Map of ${region.name ?? "this region"}`}
                description="Every documented library, plotted. Zoom in to drill down."
              />
              <div
                className="overflow-hidden rounded-3xl"
                style={{ border: `1px solid ${T.border.line}` }}
              >
                <InteractiveMap
                  mapConfig={region.mapConfig}
                  mode="region"
                  regionSlug={slug}
                  countrySlug={countrySlug}
                  continentSlug={continentSlug}
                  locale={locale}
                />
              </div>
            </section>

            {/* ── Events strip ────────────────────────────────────────────── */}
            <section className="scroll-mt-28">
              <LocationEventsStrip
                regionSlug={slug}
                locationLabel={region.name ?? ""}
              />
            </section>

            {/* ── Quick Links ─────────────────────────────────────────────── */}
            {hasQuickLinks ? (
              <section className="scroll-mt-28">
                <LocationSectionHeading title="Quick links" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {region.quickLinks!.map((link, i) => (
                    <QuickLinkCard
                      key={((link as { id?: unknown }).id as string) ?? i}
                      link={link}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </Container>

        <div className="mt-14">
          <LocationContributeCTA
            locationName={region.name ?? undefined}
            entityType="region"
          />
        </div>
      </main>
    </div>
  )
}
