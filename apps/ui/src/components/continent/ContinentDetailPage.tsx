import type { Locale } from "next-intl"

import { ContinentGlobeCanvas } from "@/components/continent/ContinentGlobeCanvas"
import {
  CtaBannerSection,
  EditorialSection,
  Eyebrow,
  HeroInlineTabNav,
  HeroStat,
  HeroStatsGrid,
  LocationContributeCTA,
  LocationGridBrowser,
  MapSectionHeader,
  SectionHeader,
} from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import type {
  PopulatedContinentData,
  ContinentEditorialBlock,
  ContinentCtaBanner,
  ContinentSection,
} from "@/lib/strapi-api/content/server"
import { auroraCtaLg } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Page ───────────────────────────────────────────────────────────────────

export function ContinentDetailPage({
  continent,
  navbar,
  locale,
  slug,
}: {
  readonly continent: PopulatedContinentData | null
  readonly navbar?: NavbarData
  readonly locale: Locale
  readonly slug: string
}) {
  if (!continent) {
    return (
      <div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-white/40">Continent not found.</p>
        </main>
      </div>
    )
  }

  const allCountries = continent.countries ?? []

  const hasFeaturedLibraries =
    Array.isArray(continent.featuredLibraries) &&
    continent.featuredLibraries.length > 0

  const typedSections = (continent.sections ?? []) as ContinentSection[]
  const editorialBlocks = typedSections.filter(
    (s): s is ContinentEditorialBlock =>
      s.__component === "sections.editorial-block"
  )
  const ctaBanners = typedSections.filter(
    (s): s is ContinentCtaBanner => s.__component === "sections.cta-banner"
  )

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "institutions", label: "Libraries" },
    { id: "countries", label: "Countries" },
    { id: "map", label: "Map" },
  ] as const

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          id="overview"
          data-transparent-header=""
          className="relative isolate -mt-14 flex min-h-[82vh] flex-col justify-end overflow-hidden pt-28"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <ContinentGlobeCanvas
              continentSlug={slug}
              className="h-full w-full"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,8,22,0.35)_0%,rgba(5,8,22,0.0)_35%,rgba(5,8,22,0.0)_55%,rgba(5,8,22,0.92)_88%,rgba(5,8,22,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_12%_35%,rgba(79,70,229,0.18),transparent_55%)]" />

          <Container>
            <div className="grid grid-cols-1 gap-10 pt-[70px] pb-14 lg:[grid-template-columns:1.3fr_1fr] lg:gap-14">
              {/* Left column */}
              <div>
                <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-cyan-400/60 uppercase">
                  Libraries Global · {continent.name}
                </p>
                <h1 className="font-serif text-[clamp(4.5rem,12vw,9rem)] leading-[0.85] tracking-[-0.03em] text-white [text-shadow:0_4px_80px_rgba(0,0,0,0.8)]">
                  {continent.name}
                </h1>
                {continent.summary ? (
                  <p className="mt-5 max-w-[44ch] text-[17px] leading-[1.7] text-white/70">
                    {continent.summary}
                  </p>
                ) : null}
              </div>

              {/* Right column: stats + inline tabs */}
              <div style={{ paddingBottom: "14px" }}>
                <HeroStatsGrid>
                  <HeroStat
                    label="Countries"
                    value={allCountries.length || "—"}
                  />
                  <HeroStat
                    label="Libraries"
                    value={
                      typeof continent.libraryCount === "number" &&
                      continent.libraryCount > 0
                        ? new Intl.NumberFormat().format(continent.libraryCount)
                        : "—"
                    }
                  />
                  <HeroStat
                    label="Regions"
                    value={
                      typeof continent.regionCount === "number" &&
                      continent.regionCount > 0
                        ? new Intl.NumberFormat().format(continent.regionCount)
                        : "—"
                    }
                  />
                  <HeroStat
                    label="Featured"
                    value={
                      hasFeaturedLibraries
                        ? continent.featuredLibraries!.length
                        : "—"
                    }
                  />
                </HeroStatsGrid>
                <HeroInlineTabNav tabs={tabs} />
              </div>
            </div>
          </Container>
        </section>

        {/* ── Pillar Institutions ─────────────────────────────────────────── */}
        {hasFeaturedLibraries ? (
          <section
            id="institutions"
            className="relative overflow-hidden border-b border-white/6 py-16 sm:py-20"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(79,70,229,0.18),transparent_60%)]" />
            <Container className="relative">
              <div className="mb-8">
                <Eyebrow index={1} bar>
                  Archive Starts
                </Eyebrow>
                <h2 className="font-serif text-3xl font-normal tracking-tight text-white sm:text-4xl">
                  Pillar Institutions
                </h2>
              </div>
              <FeaturedLibraryCards libraries={continent.featuredLibraries} />
            </Container>
          </section>
        ) : null}

        {/* ── Browse by Country ───────────────────────────────────────────── */}
        {allCountries.length > 0 ? (
          <section id="countries" className="py-16 sm:py-20">
            <Container>
              <div style={{ marginBottom: "22px" }}>
                <Eyebrow index={2} bar>
                  Jurisdictions
                </Eyebrow>
              </div>
              <div className="mb-[26px] flex flex-wrap items-end justify-between gap-6">
                <SectionHeader italic="countries." as="h2">
                  Browse by
                </SectionHeader>
              </div>
              <LocationGridBrowser
                rankPrefix="C"
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
            </Container>
          </section>
        ) : null}

        {/* ── Interactive Cartography ─────────────────────────────────────── */}
        <section id="map" className="border-t border-white/6 py-[70px]">
          <Container>
            <MapSectionHeader
              locationName={continent.name ?? "the Continent"}
            />
            <InteractiveMap
              mode="continent"
              continentSlug={slug}
              locale={locale}
            />
          </Container>
        </section>

        <LocationContributeCTA
          locationName={continent.name ?? undefined}
          entityType="continent"
        />

        {/* ── Editorial sections ──────────────────────────────────────────── */}
        {editorialBlocks.map((section) => (
          <div key={section.id} className="border-t border-white/6">
            <EditorialSection section={section} />
          </div>
        ))}

        {/* ── CTA Banner sections ─────────────────────────────────────────── */}
        {ctaBanners.map((section) => (
          <div key={section.id} className="border-t border-white/6">
            <CtaBannerSection section={section} />
          </div>
        ))}

        {/* ── Journey CTA fallback ────────────────────────────────────────── */}
        {ctaBanners.length === 0 ? (
          <section className="relative overflow-hidden border-t border-white/6 py-24 sm:py-32">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(127,223,255,0.07),transparent_70%)]" />
            <Container>
              <div className="flex flex-col items-center gap-6 text-center">
                <Eyebrow>Archive Starts</Eyebrow>
                <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.045em] text-white">
                  Your Journey Starts Now
                </h2>
                <p className="max-w-[40ch] text-base leading-7 text-white/50">
                  Thousands of libraries across {continent.name} are waiting to
                  be explored.
                </p>
                {allCountries[0] ? (
                  <GlobalLink
                    href={`/${slug}/${allCountries[0].slug}`}
                    className={auroraCtaLg}
                  >
                    Start Exploring
                  </GlobalLink>
                ) : (
                  <GlobalLink href="/" className={auroraCtaLg}>
                    Start Exploring
                  </GlobalLink>
                )}
              </div>
            </Container>
          </section>
        ) : null}
      </main>
    </div>
  )
}

ContinentDetailPage.displayName = "ContinentDetailPage"

export default ContinentDetailPage
