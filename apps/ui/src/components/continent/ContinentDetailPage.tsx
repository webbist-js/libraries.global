import Image from "next/image"
import type { Locale } from "next-intl"

import { ContinentGlobeCanvas } from "@/components/continent/ContinentGlobeCanvas"
import { CountryBrowser } from "@/components/continent/CountryBrowser"
import { Card, Eyebrow, StatBlock } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import type {
  PopulatedContinentData,
  ContinentEditorialBlock,
  ContinentCtaBanner,
  ContinentSection,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

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

  const allCountries = continent.countries ?? []

  const hasFeaturedLibraries =
    Array.isArray(continent.featuredLibraries) &&
    continent.featuredLibraries.length > 0

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
              <Card style={{ padding: "16px 20px" }}>
                <StatBlock
                  value={allCountries.length || "—"}
                  label="Countries"
                  size="sm"
                />
              </Card>
              <Card style={{ padding: "16px 20px" }}>
                <StatBlock
                  value={
                    typeof continent.libraryCount === "number" &&
                    continent.libraryCount > 0
                      ? new Intl.NumberFormat().format(continent.libraryCount)
                      : "—"
                  }
                  label="Libraries"
                  size="sm"
                />
              </Card>
              <Card style={{ padding: "16px 20px" }}>
                <StatBlock
                  value={
                    typeof continent.regionCount === "number" &&
                    continent.regionCount > 0
                      ? new Intl.NumberFormat().format(continent.regionCount)
                      : "—"
                  }
                  label="Regions"
                  size="sm"
                />
              </Card>
              <Card style={{ padding: "16px 20px" }}>
                <StatBlock
                  value={
                    hasFeaturedLibraries
                      ? continent.featuredLibraries!.length
                      : "—"
                  }
                  label="Featured"
                  size="sm"
                />
              </Card>
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
                <Eyebrow>Archive Starts</Eyebrow>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Pillar Institutions
                </h2>
              </div>
              <FeaturedLibraryCards libraries={continent.featuredLibraries} />
            </Container>
          </section>
        ) : null}

        {/* ── Browse by Country ──────────────────────────────────────────────── */}
        {allCountries.length > 0 ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-8">
                <Eyebrow>Jurisdictions</Eyebrow>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Browse by Country
                </h2>
              </div>

              <CountryBrowser
                countries={
                  allCountries as {
                    name: string
                    slug: string
                    capitalCity?: string | null
                  }[]
                }
                continentSlug={slug}
              />
            </Container>
          </section>
        ) : null}

        {/* ── Interactive Cartography ────────────────────────────────────────── */}
        <section className="border-t border-white/6 py-14 sm:py-18">
          <Container>
            <div className="mb-6">
              <Eyebrow>Interactive Cartography</Eyebrow>
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
