import { Icon } from "@iconify/react"
import Image from "next/image"
import type { Locale } from "next-intl"

import { ContinentGlobeCanvas } from "@/components/continent/ContinentGlobeCanvas"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import type {
  PopulatedContinentData,
  ContinentEditorialBlock,
  ContinentCtaBanner,
  ContinentSection,
  IconHubValue,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: string | number
  note?: string
}) {
  return (
    <div
      className={cn(homepagePanelClassName, "flex flex-col gap-1 px-5 py-4")}
    >
      <span className="text-[10px] font-semibold tracking-[0.14em] text-white/36 uppercase">
        {label}
      </span>
      <span className="text-2xl font-bold tracking-tight text-white tabular-nums">
        {value}
      </span>
      {note ? <span className="text-xs text-white/36">{note}</span> : null}
    </div>
  )
}

// ── Country card ───────────────────────────────────────────────────────────

function CountryCard({
  country,
  continentSlug,
}: {
  country: {
    name?: string | null
    slug?: string | null
    summary?: string | null
    capitalCity?: string | null
  }
  continentSlug: string
}) {
  if (!country.slug) return null

  return (
    <GlobalLink
      href={`/${continentSlug}/${country.slug}`}
      className={cn(
        homepagePanelClassName,
        "group relative flex min-h-[10rem] flex-col justify-end overflow-hidden px-5 py-5 transition-[border-color,box-shadow,background-color] duration-500 hover:border-cyan-200/16 hover:bg-white/[0.07] hover:shadow-[0_20px_70px_rgba(6,16,40,0.4)]"
      )}
    >
      {/* Subtle radial glow on hover */}
      <div className="pointer-events-none absolute inset-[-10%] rounded-[38px] bg-[radial-gradient(circle_at_50%_80%,rgba(84,171,255,0.14),transparent_55%)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative z-10 space-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-white transition-[text-shadow] duration-500 group-hover:text-cyan-50 group-hover:[text-shadow:0_0_20px_rgba(148,224,255,0.2)]">
          {country.name ?? ""}
        </h3>
        {country.capitalCity ? (
          <p className="text-xs text-white/40">{country.capitalCity}</p>
        ) : null}
        {country.summary ? (
          <p className="line-clamp-2 text-sm leading-6 text-white/50">
            {country.summary}
          </p>
        ) : null}
        {/* TODO: Add library count once aggregate API endpoint is available */}
      </div>
    </GlobalLink>
  )
}

// ── Service highlight card ─────────────────────────────────────────────────

function ServiceHighlightCard({
  item,
}: {
  item: {
    id?: unknown
    eyebrow?: string | null
    title?: string | null
    summary?: string | null
    icon?: IconHubValue | null
    ctaLabel?: string | null
    ctaUrl?: string | null
  }
}) {
  const iconName = item.icon?.iconName ?? null

  return (
    <div
      className={cn(homepagePanelClassName, "flex flex-col gap-3 px-5 py-5")}
    >
      {/* Icon badge */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
        {iconName ? (
          <Icon icon={iconName} className="size-5 text-indigo-300" />
        ) : (
          <Icon icon="mdi:star-outline" className="size-5 text-indigo-300/40" />
        )}
      </div>

      {item.eyebrow ? (
        <span className="text-[10px] font-semibold tracking-[0.14em] text-cyan-400/70 uppercase">
          {item.eyebrow}
        </span>
      ) : null}
      {item.title ? (
        <h4 className="font-semibold text-white">{item.title}</h4>
      ) : null}
      {item.summary ? (
        <p className="text-sm leading-6 text-white/50">{item.summary}</p>
      ) : null}
      {item.ctaLabel && item.ctaUrl ? (
        <GlobalLink
          href={item.ctaUrl}
          className="mt-auto text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          {item.ctaLabel} →
        </GlobalLink>
      ) : null}
    </div>
  )
}

// ── Editorial block ────────────────────────────────────────────────────────

function EditorialBlock({ section }: { section: ContinentEditorialBlock }) {
  const imageUrl = section.image?.url
    ? formatStrapiMediaUrl(section.image.url)
    : null
  const isImageLeft = section.imagePosition === "left"

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div
          className={cn(
            "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center",
            isImageLeft && imageUrl ? "lg:[&>*:first-child]:order-2" : ""
          )}
        >
          {/* Text */}
          <div className="flex flex-col gap-5">
            {section.eyebrow ? (
              <span className="text-[11px] font-semibold tracking-[0.16em] text-cyan-400/70 uppercase">
                {section.eyebrow}
              </span>
            ) : null}
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em] text-white">
              {section.title}
            </h2>
            {Array.isArray(section.body) && section.body.length > 0 ? (
              <div className="max-w-[52ch] text-white/60">
                <StrapiBlocksContent
                  blocks={
                    section.body as Parameters<
                      typeof StrapiBlocksContent
                    >[0]["blocks"]
                  }
                />
              </div>
            ) : null}
            {(section.primaryCtaLabel && section.primaryCtaUrl) ||
            (section.secondaryCtaLabel && section.secondaryCtaUrl) ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {section.primaryCtaLabel && section.primaryCtaUrl ? (
                  <GlobalLink
                    href={section.primaryCtaUrl}
                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(99,102,241,0.35)] transition-colors hover:bg-indigo-400"
                  >
                    {section.primaryCtaLabel}
                  </GlobalLink>
                ) : null}
                {section.secondaryCtaLabel && section.secondaryCtaUrl ? (
                  <GlobalLink
                    href={section.secondaryCtaUrl}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/14"
                  >
                    {section.secondaryCtaLabel}
                  </GlobalLink>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Image */}
          {imageUrl ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/8">
              <Image
                src={imageUrl}
                alt={section.image?.alternativeText ?? section.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.05),rgba(5,8,22,0.3))]" />
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  )
}

// ── CTA banner section ─────────────────────────────────────────────────────

function CtaBannerSection({ section }: { section: ContinentCtaBanner }) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(79,70,229,0.18),transparent_70%)]" />
      <Container>
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-bold tracking-[-0.04em] text-white">
            {section.title}
          </h2>
          {section.subtitle ? (
            <p className="max-w-[42ch] text-base leading-7 text-white/55">
              {section.subtitle}
            </p>
          ) : null}
          {section.ctaLabel && section.ctaUrl ? (
            <GlobalLink
              href={section.ctaUrl}
              className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-7 py-3 text-sm font-semibold text-white shadow-[0_4px_32px_rgba(99,102,241,0.4)] transition-colors hover:bg-indigo-400"
            >
              {section.ctaLabel}
            </GlobalLink>
          ) : null}
        </div>
      </Container>
    </section>
  )
}

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

  // Determine which countries to feature in "Top Jurisdictions"
  const topCountries =
    (continent.featuredCountries?.length
      ? continent.featuredCountries
      : continent.countries
    )?.slice(0, 6) ?? []

  const hasFeaturedLibraries =
    Array.isArray(continent.featuredLibraries) &&
    continent.featuredLibraries.length > 0

  const hasServiceHighlights =
    Array.isArray(continent.serviceHighlights) &&
    continent.serviceHighlights.length > 0

  const hasSections =
    Array.isArray(continent.sections) && continent.sections.length > 0
  const hasDescription =
    Array.isArray(continent.description) &&
    (continent.description as unknown[]).length > 0

  // Separate editorial blocks and CTA banners from sections
  // Cast to ContinentSection[] so the discriminated union type predicates work correctly
  const typedSections = (continent.sections ?? []) as ContinentSection[]
  const editorialBlocks = typedSections.filter(
    (s): s is ContinentEditorialBlock =>
      s.__component === "sections.editorial-block"
  )
  const ctaBanners = typedSections.filter(
    (s): s is ContinentCtaBanner => s.__component === "sections.cta-banner"
  )

  const countryCount = continent.countries?.length ?? 0

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      {/* Ambient radial gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(92,149,255,0.09),transparent_38%),radial-gradient(circle_at_82%_70%,rgba(103,221,255,0.06),transparent_30%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative isolate flex min-h-[82vh] flex-col justify-end overflow-hidden">
          {/* Three.js globe canvas — full-width background, zoomed in on this continent */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <ContinentGlobeCanvas
              continentSlug={slug}
              className="h-full w-full"
            />
          </div>

          {/* Layered gradients to anchor content and create depth */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,8,22,0.35)_0%,rgba(5,8,22,0.0)_35%,rgba(5,8,22,0.0)_55%,rgba(5,8,22,0.92)_88%,rgba(5,8,22,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_12%_35%,rgba(79,70,229,0.18),transparent_55%)]" />

          <Container className="pt-16 pb-0 sm:pt-24">
            <div className="max-w-[56ch]">
              {/* Eyebrow */}
              <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-cyan-400/60 uppercase">
                Libraries Global · {continent.name}
              </p>

              {/* Title */}
              <h1 className="text-[clamp(3.5rem,8vw,7rem)] leading-[0.9] font-bold tracking-[-0.045em] text-white [text-shadow:0_2px_60px_rgba(0,0,0,0.6)]">
                {continent.name}
              </h1>

              {continent.summary ? (
                <p className="mt-5 max-w-[44ch] text-base leading-7 text-white/58 sm:text-[17px]">
                  {continent.summary}
                </p>
              ) : null}
            </div>

            {/* ── Stats row ─────────────────────────────────────────────────── */}
            <div className="mt-10 grid grid-cols-2 gap-3 pb-10 sm:grid-cols-4 sm:pb-14">
              <StatCard label="Countries" value={countryCount || "—"} />
              <StatCard
                label="Libraries"
                value={
                  typeof continent.libraryCount === "number" &&
                  continent.libraryCount > 0
                    ? new Intl.NumberFormat().format(continent.libraryCount)
                    : "—"
                }
              />
              <StatCard
                label="Regions"
                value={
                  typeof continent.regionCount === "number" &&
                  continent.regionCount > 0
                    ? new Intl.NumberFormat().format(continent.regionCount)
                    : "—"
                }
              />
              <StatCard
                label="Featured"
                value={
                  hasFeaturedLibraries
                    ? continent.featuredLibraries!.length
                    : "—"
                }
              />
            </div>
          </Container>
        </section>

        {/* ── Pillar Institutions (featured libraries) ───────────────────────── */}
        {hasFeaturedLibraries ? (
          <section className="relative overflow-hidden border-t border-white/6 py-14 sm:py-18">
            {/* Indigo radial accent — marks this as a "featured" section */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(79,70,229,0.18),transparent_60%)]" />
            <Container className="relative">
              <div className="mb-8">
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-indigo-400/80 uppercase">
                  Archive Starts
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Pillar Institutions
                </h2>
              </div>
              <FeaturedLibraryCards libraries={continent.featuredLibraries} />
            </Container>
          </section>
        ) : null}

        {/* ── Top Jurisdictions ─────────────────────────────────────────────── */}
        {topCountries.length > 0 ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                    Top Jurisdictions
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Browse by Country
                  </h2>
                </div>
                {/* Only show "View All" if there are more countries than shown */}
                {(continent.countries?.length ?? 0) > topCountries.length ? (
                  <span className="text-sm text-white/36">
                    {continent.countries!.length} countries total
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topCountries.map((country, i) => (
                  <CountryCard
                    key={(country as { slug?: string }).slug ?? i}
                    country={
                      country as {
                        name?: string | null
                        slug?: string | null
                        summary?: string | null
                        capitalCity?: string | null
                      }
                    }
                    continentSlug={slug}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── Service Highlights ────────────────────────────────────────────── */}
        {hasServiceHighlights ? (
          <section className="relative overflow-hidden border-t border-white/6 py-14 sm:py-18">
            {/* Faint cyan gradient stripe to break this section from plain dark neighbours */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(6,182,212,0.07),transparent_65%)]" />
            <Container className="relative">
              <div className="mb-8">
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Specialised Disciplines
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  What You&apos;ll Find
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {continent.serviceHighlights!.map((item, i) => (
                  <ServiceHighlightCard
                    key={((item as { id?: unknown }).id as string) ?? i}
                    item={
                      item as {
                        id?: unknown
                        eyebrow?: string | null
                        title?: string | null
                        summary?: string | null
                        icon?: IconHubValue | null
                        ctaLabel?: string | null
                        ctaUrl?: string | null
                      }
                    }
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : /* TODO: Populate serviceHighlights in Strapi for this continent
             to show a "Specialised Disciplines" grid (Study Spaces, Digital Archives,
             Rare Manuscripts, etc.) — uses the shared.highlight-card component */
        null}

        {/* ── Interactive Cartography ────────────────────────────────────────── */}
        <section className="border-t border-white/6 py-14 sm:py-18">
          <Container>
            <div className="mb-6">
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                Interactive Cartography
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Explore {continent.name ?? "the Continent"}
              </h2>
            </div>
            <InteractiveMap
              mode="continent"
              continentSlug={slug}
              locale={locale}
            />
          </Container>
        </section>

        {/* ── Editorial sections (from dynamic zone) ────────────────────────── */}
        {editorialBlocks.map((section) => (
          <div key={section.id} className="border-t border-white/6">
            <EditorialBlock section={section} />
          </div>
        ))}

        {/* ── Description (fallback content) ────────────────────────────────── */}
        {!hasSections && hasDescription ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mx-auto max-w-[65ch] text-white/65">
                <StrapiBlocksContent
                  blocks={
                    continent.description as Parameters<
                      typeof StrapiBlocksContent
                    >[0]["blocks"]
                  }
                />
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── CTA Banner sections (from dynamic zone) ────────────────────────── */}
        {ctaBanners.map((section) => (
          <div key={section.id} className="border-t border-white/6">
            <CtaBannerSection section={section} />
          </div>
        ))}

        {/* ── Journey CTA (fallback if no CTA banner in sections) ────────────── */}
        {ctaBanners.length === 0 ? (
          <section className="relative overflow-hidden border-t border-white/6 py-24 sm:py-32">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(79,70,229,0.18),transparent_70%)]" />
            <Container>
              <div className="flex flex-col items-center gap-6 text-center">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Archive Starts
                </p>
                <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.045em] text-white">
                  Your Journey Starts Now
                </h2>
                <p className="max-w-[40ch] text-base leading-7 text-white/50">
                  Thousands of libraries across {continent.name} are waiting to
                  be explored.
                </p>
                {topCountries[0] ? (
                  <GlobalLink
                    href={`/${slug}/${topCountries[0].slug}`}
                    className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_32px_rgba(99,102,241,0.4)] transition-colors hover:bg-indigo-400"
                  >
                    Start Exploring
                  </GlobalLink>
                ) : (
                  <GlobalLink
                    href="/"
                    className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_32px_rgba(99,102,241,0.4)] transition-colors hover:bg-indigo-400"
                  >
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
