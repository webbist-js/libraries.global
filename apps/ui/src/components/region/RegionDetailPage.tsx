import { Icon } from "@iconify/react"
import Image from "next/image"
import type { Locale } from "next-intl"

import {
  Breadcrumb,
  CtaBannerSection,
  EditorialSection,
  Eyebrow,
  HeroStat,
  HeroStatsGrid,
  LocationContributeCTA,
  LocationGridBrowser,
  MapSectionHeader,
  SectionHeader,
} from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { LocationTabBar } from "@/components/location/LocationTabBar"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import { T } from "@/lib/design-tokens"
import type {
  PopulatedRegionData,
  EditorialBlock as EditorialBlockType,
  CtaBanner as CtaBannerType,
  PageSection,
  QuickLink,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

// ── Quick link card ──────────────────────────────────────────────────────────

function QuickLinkCard({ link }: { link: QuickLink }) {
  const iconName = link.icon?.iconName ?? null

  return (
    <GlobalLink
      href={link.href}
      className={cn(
        homepagePanelClassName,
        "group flex items-start gap-4 px-5 py-4 transition-[border-color,background-color] duration-300 hover:border-cyan-200/16 hover:bg-white/[0.07]"
      )}
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--t-border-line) bg-(--t-bg-surface) transition-colors duration-300 group-hover:border-(--t-aurora-edge) group-hover:bg-(--t-aurora-soft)">
        {iconName ? (
          <Icon
            icon={iconName}
            className="size-4 text-(--t-ink-dim) transition-colors group-hover:text-(--t-accent-aurora)"
          />
        ) : (
          <Icon
            icon="mdi:arrow-right"
            className="size-4 text-(--t-ink-faint) transition-colors group-hover:text-(--t-accent-aurora)"
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-(--t-ink-dim) transition-colors group-hover:text-(--t-ink-base)">
          {link.label}
        </span>
        {link.description ? (
          <span className="text-xs leading-5 text-(--t-ink-faint)">
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
  const typedSections = (region.sections ?? []) as PageSection[]
  const ctaBanners = typedSections.filter(
    (s): s is CtaBannerType => s.__component === "sections.cta-banner"
  )

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

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "institutions", label: "Libraries" },
    { id: "areas", label: areaTypeLabel },
    { id: "map", label: "Map" },
  ] as const

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          id="overview"
          data-transparent-header=""
          className="relative isolate -mt-14 flex min-h-[60vh] flex-col overflow-hidden pt-28"
          style={{ background: "#030511" }}
        >
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={region.name ?? ""}
              fill
              priority
              className="-z-20 object-cover object-bottom"
            />
          ) : null}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,8,22,0.18)_0%,rgba(5,8,22,0.05)_18%,rgba(5,8,22,0.60)_60%,rgba(5,8,22,0.97)_100%)]" />
          {!heroImageUrl ? (
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_20%_40%,rgba(80,140,80,0.18),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(160,120,40,0.14),transparent_45%),linear-gradient(135deg,#0d1408,#100c04,#050816)]" />
          ) : null}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,8,22,0.55)_0%,transparent_60%)]" />

          <Container className="flex flex-1 flex-col justify-end pb-8 sm:pb-10">
            <div className="grid grid-cols-1 gap-10 pb-6 lg:[grid-template-columns:1.3fr_1fr] lg:gap-14">
              {/* Left column */}
              <div>
                <div className="mb-4">
                  <Breadcrumb
                    labels={{
                      ...(continentSlug && continentName
                        ? { [continentSlug]: continentName }
                        : {}),
                      ...(countrySlug && countryName
                        ? { [countrySlug]: countryName }
                        : {}),
                      [slug]: region.name ?? "",
                    }}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {region.typeLabel ? (
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan-400/60 uppercase">
                      {region.typeLabel}
                    </p>
                  ) : null}

                  <h1 className="font-serif text-[clamp(4rem,10vw,8rem)] leading-[0.85] tracking-[-0.03em] text-white">
                    {region.name}
                  </h1>

                  {region.heroTagline ? (
                    <p className="mt-2 max-w-[48ch] text-lg leading-[1.5] font-light text-white/70">
                      {region.heroTagline}
                    </p>
                  ) : region.summary ? (
                    <p className="mt-2 max-w-[52ch] text-[17px] leading-[1.7] text-white/60">
                      {region.summary}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Right column: stats + inline tabs */}
              <div style={{ paddingBottom: "14px", alignSelf: "flex-end" }}>
                <HeroStatsGrid>
                  <HeroStat
                    label="Libraries"
                    value={
                      typeof region.libraryCount === "number" &&
                      region.libraryCount > 0
                        ? new Intl.NumberFormat().format(region.libraryCount)
                        : "—"
                    }
                  />
                  <HeroStat
                    label={areaTypeLabel}
                    value={
                      typeof region.areaCount === "number" &&
                      region.areaCount > 0
                        ? new Intl.NumberFormat().format(region.areaCount)
                        : "—"
                    }
                  />
                </HeroStatsGrid>
              </div>
            </div>
          </Container>
        </section>

        <LocationTabBar tabs={[...tabs]} />

        {/* ── Pillar Institutions ───────────────────────────────────────────── */}
        {hasFeaturedLibraries ? (
          <section
            id="institutions"
            className="relative overflow-hidden border-t border-(--t-border-line) py-16 sm:py-20"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(79,70,229,0.18),transparent_60%)]" />
            <Container className="relative">
              <div className="mb-8">
                <Eyebrow index={1} bar>
                  Archive Starts
                </Eyebrow>
                <h2 className="font-serif text-3xl font-normal tracking-tight text-(--t-ink-base) sm:text-4xl">
                  Pillar Institutions
                </h2>
              </div>
              <FeaturedLibraryCards libraries={region.featuredLibraries} />
            </Container>
          </section>
        ) : null}

        {/* ── Areas grid ────────────────────────────────────────────────────── */}
        {hasAreas ? (
          <section id="areas" className="py-[70px]">
            <Container>
              <div style={{ marginBottom: "22px" }}>
                <Eyebrow index={2} bar>
                  Browse Within
                </Eyebrow>
              </div>
              <div className="mb-[26px] flex flex-wrap items-end justify-between gap-6">
                <SectionHeader
                  italic={`${areaTypeLabel.toLowerCase()}.`}
                  as="h2"
                >
                  Counties &amp;
                </SectionHeader>
                {typeof region.areaCount === "number" &&
                region.areaCount > region.areas!.length ? (
                  <p
                    style={{
                      color: T.ink.dim,
                      fontSize: "14px",
                      lineHeight: "1.7",
                      fontWeight: 300,
                      maxWidth: "52ch",
                      margin: 0,
                    }}
                  >
                    {region.areaCount} {areaTypeLabel.toLowerCase()} across{" "}
                    {region.name}.
                  </p>
                ) : null}
              </div>
              <LocationGridBrowser
                rankPrefix="A"
                items={region.areas!.map((area) => ({
                  slug: (area as { slug?: string }).slug ?? "",
                  name: (area as { name?: string }).name ?? "",
                  subtitle:
                    (area as { typeLabel?: string | null }).typeLabel ?? null,
                  href: `/${continentSlug}/${countrySlug}/${slug}/${(area as { slug?: string }).slug}`,
                }))}
              />
            </Container>
          </section>
        ) : null}

        {/* ── Interactive Map ───────────────────────────────────────────────── */}
        <section
          id="map"
          className="border-t border-(--t-border-line) py-[70px]"
        >
          <Container>
            <MapSectionHeader locationName={region.name ?? "this region"} />
            <InteractiveMap
              mapConfig={region.mapConfig}
              mode="region"
              regionSlug={slug}
              countrySlug={countrySlug}
              continentSlug={continentSlug}
              locale={locale}
            />
          </Container>
        </section>

        <div
          className="border-t py-10 sm:py-14"
          style={{ borderColor: T.border.line }}
        >
          <Container>
            <LocationEventsStrip
              regionSlug={slug}
              locationLabel={region.name ?? ""}
            />
          </Container>
        </div>

        <LocationContributeCTA
          locationName={region.name ?? undefined}
          entityType="region"
        />

        {/* ── Quick Links ───────────────────────────────────────────────────── */}
        {hasQuickLinks ? (
          <section className="border-t border-(--t-border-line) py-14 sm:py-18">
            <Container>
              <div className="mb-8">
                <Eyebrow>Navigate</Eyebrow>
                <h2 className="font-serif text-3xl font-normal tracking-tight text-(--t-ink-base) sm:text-4xl">
                  Quick Links
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {region.quickLinks!.map((link, i) => (
                  <QuickLinkCard
                    key={((link as { id?: unknown }).id as string) ?? i}
                    link={link}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── Dynamic zone sections ─────────────────────────────────────────── */}
        {typedSections.map((section) => (
          <div key={section.id} className="border-t border-(--t-border-line)">
            {section.__component === "sections.editorial-block" ? (
              <EditorialSection section={section as EditorialBlockType} />
            ) : section.__component === "sections.cta-banner" ? (
              <CtaBannerSection section={section as CtaBannerType} />
            ) : null}
          </div>
        ))}

        {/* ── Journey CTA fallback ──────────────────────────────────────────── */}
        {ctaBanners.length === 0 && typedSections.length === 0 ? (
          <section className="relative overflow-hidden border-t border-(--t-border-line) py-24 sm:py-32">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(127,223,255,0.07),transparent_70%)]" />
            <Container>
              <div className="flex flex-col items-center gap-6 text-center">
                <Eyebrow>Start Exploring</Eyebrow>
                <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.045em] text-(--t-ink-base)">
                  Discover {region.name}
                </h2>
                <p className="max-w-[40ch] text-base leading-7 text-(--t-ink-dim)">
                  Explore the libraries and cultural institutions across{" "}
                  {region.name}.
                </p>
              </div>
            </Container>
          </section>
        ) : null}
      </main>
    </div>
  )
}
