import Image from "next/image"
import type { Locale } from "next-intl"

import {
  Breadcrumb,
  CtaBannerSection,
  EditorialSection,
  Eyebrow,
  HeroStat,
  HeroStatsGrid,
  HeroTitle,
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
import { auroraCtaLg } from "@/lib/styles"

// ── Country fact row ─────────────────────────────────────────────────────────

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: "12px",
        padding: "8px 0",
        borderBottom: `1px dashed ${T.border.line}`,
        fontSize: "13px",
      }}
    >
      <dt
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.low,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          paddingTop: "2px",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          color: T.ink.base,
          fontSize: "13.5px",
          lineHeight: "1.5",
          margin: 0,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

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
  const ctaBanners = typedSections.filter(
    (s): s is CtaBannerType => s.__component === "sections.cta-banner"
  )

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
  const continentHref = `/${continentSlug}`

  const browseRegions = country.regions ?? []
  const regionLabel = country.regionTypeLabel ?? "Regions"

  const breadcrumbItems = [
    { label: "Atlas", href: "/" },
    ...(continentName ? [{ label: continentName, href: continentHref }] : []),
    { label: country.name ?? "" },
  ]

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "institutions", label: "Libraries" },
    { id: "regions", label: regionLabel },
    { id: "map", label: "Map" },
  ] as const

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section
          id="overview"
          data-transparent-header=""
          className="relative isolate -mt-14 overflow-hidden pt-[110px]"
          style={{ minHeight: "560px", background: "#030511" }}
        >
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={country.name ?? ""}
              fill
              priority
              className="-z-20 object-cover object-bottom"
            />
          ) : null}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(3,5,17,.2) 0%, rgba(3,5,17,.4) 50%, var(--t-bg-void) 100%)",
            }}
          />
          {!heroImageUrl ? (
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,rgba(79,70,229,0.18),transparent_60%)]" />
          ) : null}

          <Container>
            <div className="grid grid-cols-1 gap-10 pt-[70px] pb-14 lg:[grid-template-columns:1.3fr_1fr] lg:gap-14">
              {/* Left column */}
              <div>
                <Breadcrumb items={breadcrumbItems} />

                {country.iso2 ? (
                  <div className="mt-6">
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        border: `1px solid ${T.border.hi}`,
                        background: "rgba(8,12,30,.6)",
                        backdropFilter: "blur(8px)",
                        fontFamily: T.font.mono,
                        fontSize: "11px",
                        letterSpacing: ".14em",
                        color: T.ink.dim,
                        textTransform: "uppercase",
                      }}
                    >
                      <span>{country.iso2}</span>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: "18px" }}>
                  <HeroTitle>{country.name}</HeroTitle>
                </div>

                {country.heroTagline ? (
                  <p
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 300,
                      fontSize: "22px",
                      lineHeight: "1.45",
                      color: T.ink.dim,
                      maxWidth: "52ch",
                      margin: "10px 0 0",
                      letterSpacing: "-.01em",
                    }}
                  >
                    {country.heroTagline}
                  </p>
                ) : country.summary ? (
                  <p
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 300,
                      fontSize: "20px",
                      lineHeight: "1.5",
                      color: T.ink.dim,
                      maxWidth: "52ch",
                      margin: "10px 0 0",
                      letterSpacing: "-.01em",
                    }}
                  >
                    {country.summary}
                  </p>
                ) : null}
              </div>

              {/* Right column: stats + tabs */}
              <div style={{ paddingBottom: "14px" }}>
                <HeroStatsGrid>
                  <HeroStat
                    label="Libraries"
                    value={
                      typeof country.libraryCount === "number" &&
                      country.libraryCount > 0
                        ? new Intl.NumberFormat().format(country.libraryCount)
                        : "—"
                    }
                    note="Open to the public"
                  />
                  <HeroStat
                    label="Pillar Institutions"
                    value={
                      hasFeaturedLibraries
                        ? country.featuredLibraries!.length
                        : "—"
                    }
                    note="Legal-deposit status"
                  />
                  <HeroStat
                    label={regionLabel}
                    value={
                      typeof country.regionCount === "number" &&
                      country.regionCount > 0
                        ? country.regionCount
                        : "—"
                    }
                  />
                  <HeroStat
                    label={country.capitalCity ? "Capital" : "ISO Code"}
                    value={country.capitalCity ?? country.iso2 ?? "—"}
                  />
                </HeroStatsGrid>
              </div>
            </div>
          </Container>
        </section>

        <LocationTabBar tabs={[...tabs]} />

        {/* ── Pillar Institutions ─────────────────────────────────────────────── */}
        {hasFeaturedLibraries ? (
          <section
            id="institutions"
            className="relative overflow-hidden border-b border-(--t-border-line) py-[70px]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(79,70,229,0.18),transparent_60%)]" />
            <Container className="relative">
              <div style={{ marginBottom: "22px" }}>
                <Eyebrow index={1} bar>
                  Pillar institutions
                </Eyebrow>
              </div>
              <SectionHeader italic="institutions." as="h2">
                Pillar
              </SectionHeader>

              <div className="mt-8 grid grid-cols-1 gap-10 lg:[grid-template-columns:1.1fr_.9fr]">
                <FeaturedLibraryCards libraries={country.featuredLibraries} />

                {/* Side facts */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      border: `1px solid ${T.border.line}`,
                      borderRadius: "18px",
                      padding: "22px 24px",
                      background: T.bg.surface,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: "10px",
                        letterSpacing: ".22em",
                        textTransform: "uppercase",
                        color: T.ink.low,
                        marginBottom: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      Country facts
                      <span
                        style={{
                          flex: 1,
                          height: "1px",
                          background: T.border.line,
                          display: "inline-block",
                        }}
                      />
                    </div>
                    <dl style={{ display: "grid", gap: "0", margin: 0 }}>
                      {country.iso2 ? (
                        <FactRow label="ISO" value={country.iso2} />
                      ) : null}
                      {country.capitalCity ? (
                        <FactRow label="Capital" value={country.capitalCity} />
                      ) : null}
                      {typeof country.libraryCount === "number" &&
                      country.libraryCount > 0 ? (
                        <FactRow
                          label="Libraries"
                          value={new Intl.NumberFormat().format(
                            country.libraryCount
                          )}
                        />
                      ) : null}
                      {typeof country.regionCount === "number" &&
                      country.regionCount > 0 ? (
                        <FactRow
                          label={regionLabel}
                          value={String(country.regionCount)}
                        />
                      ) : null}
                    </dl>
                  </div>
                </div>
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── Browse by Region ────────────────────────────────────────────────── */}
        {hasRegions ? (
          <section id="regions" className="py-[70px]">
            <Container>
              <div style={{ marginBottom: "22px" }}>
                <Eyebrow index={2} bar>
                  Browse by region
                </Eyebrow>
              </div>
              <div className="mb-[26px] flex flex-wrap items-end justify-between gap-6">
                <SectionHeader italic="boroughs." as="h2">
                  Counties &amp;
                </SectionHeader>
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
                  Every library is cross-filed by {regionLabel.toLowerCase()},{" "}
                  unitary authority, and administrative area.
                </p>
              </div>
              <LocationGridBrowser
                rankPrefix="R"
                items={browseRegions.map((region) => ({
                  slug: region.slug ?? "",
                  name: region.name ?? "",
                  subtitle: region.summary ?? null,
                  href: `/${continentSlug}/${slug}/${region.slug}`,
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
            <MapSectionHeader locationName={country.name ?? "this country"} />
            <InteractiveMap
              mapConfig={country.mapConfig}
              mode="country"
              countrySlug={slug}
              continentSlug={continentSlug}
              locale={locale}
            />
          </Container>
        </section>

        {country.iso2 ? (
          <div
            className="border-t py-10 sm:py-14"
            style={{ borderColor: T.border.line }}
          >
            <Container>
              <LocationEventsStrip
                countryCode={country.iso2}
                locationLabel={country.name ?? ""}
              />
            </Container>
          </div>
        ) : null}

        <LocationContributeCTA
          locationName={country.name ?? undefined}
          entityType="country"
        />

        {/* ── Dynamic zone sections ────────────────────────────────────────────── */}
        {typedSections.map((section) => (
          <div key={section.id} className="border-t border-(--t-border-line)">
            {section.__component === "sections.editorial-block" ? (
              <EditorialSection section={section as EditorialBlockType} />
            ) : section.__component === "sections.cta-banner" ? (
              <CtaBannerSection section={section as CtaBannerType} />
            ) : null}
          </div>
        ))}

        {/* ── Journey CTA fallback ─────────── */}
        {ctaBanners.length === 0 && typedSections.length === 0 ? (
          <section className="relative overflow-hidden border-t border-(--t-border-line) py-24 sm:py-32">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(127,223,255,0.07),transparent_70%)]" />
            <Container>
              <div className="flex flex-col items-center gap-6 text-center">
                <Eyebrow>Archive Starts</Eyebrow>
                <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.045em] text-(--t-ink-base)">
                  Discover {country.name}
                </h2>
                <p className="max-w-[40ch] text-base leading-7 text-(--t-ink-dim)">
                  Explore the libraries, archives and cultural institutions
                  across {country.name}.
                </p>
                {browseRegions[0] ? (
                  <GlobalLink
                    href={`/${continentSlug}/${slug}/${browseRegions[0].slug}`}
                    className={auroraCtaLg}
                  >
                    Browse {browseRegions[0].name}
                  </GlobalLink>
                ) : null}
              </div>
            </Container>
          </section>
        ) : null}
      </main>
    </div>
  )
}
