import { Icon } from "@iconify/react"
import Image from "next/image"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import type {
  PopulatedRegionData,
  EditorialBlock as EditorialBlockType,
  CtaBanner as CtaBannerType,
  PageSection,
  QuickLink,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Stat card ────────────────────────────────────────────────────────────────

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
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6 transition-colors duration-300 group-hover:border-cyan-400/20 group-hover:bg-cyan-500/10">
        {iconName ? (
          <Icon
            icon={iconName}
            className="size-4 text-white/60 transition-colors group-hover:text-cyan-300"
          />
        ) : (
          <Icon
            icon="mdi:arrow-right"
            className="size-4 text-white/30 transition-colors group-hover:text-cyan-300"
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-white/80 transition-colors group-hover:text-white">
          {link.label}
        </span>
        {link.description ? (
          <span className="text-xs leading-5 text-white/40">
            {link.description}
          </span>
        ) : null}
      </div>
    </GlobalLink>
  )
}

// ── Editorial block ──────────────────────────────────────────────────────────

function EditorialBlock({ section }: { section: EditorialBlockType }) {
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

// ── CTA banner ───────────────────────────────────────────────────────────────

function CtaBannerSection({ section }: { section: CtaBannerType }) {
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

// ── Page ─────────────────────────────────────────────────────────────────────

export function RegionDetailPage({
  region,
  navbar,
  locale,
  slug,
  countrySlug,
  continentSlug,
}: {
  region: PopulatedRegionData
  navbar: NavbarData
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
  const countryHref = `/${continentSlug}/${countrySlug}`
  const continentName =
    region.continent?.name ?? region.country?.continent?.name
  const continentHref = `/${continentSlug}`

  // Determine area label (e.g., "Boroughs", "Districts") from first area's typeLabel
  const areaTypeLabel = hasAreas
    ? ((region.areas![0] as { typeLabel?: string | null }).typeLabel ?? "Areas")
    : "Areas"

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(92,149,255,0.09),transparent_38%),radial-gradient(circle_at_82%_70%,rgba(103,221,255,0.06),transparent_30%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative isolate flex min-h-[52vh] flex-col justify-end overflow-hidden">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={region.name ?? ""}
              fill
              priority
              className="-z-20 object-cover object-bottom"
            />
          ) : null}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,8,22,0.45)_0%,rgba(5,8,22,0.88)_55%,rgba(5,8,22,1)_100%)]" />
          {!heroImageUrl ? (
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,rgba(79,70,229,0.18),transparent_60%)]" />
          ) : null}

          <Container className="pt-20 pb-8 sm:pt-24 sm:pb-10">
            {/* Breadcrumb */}
            <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-white/36">
              <GlobalLink
                href="/"
                className="transition-colors hover:text-white/60"
              >
                Global
              </GlobalLink>
              {continentName ? (
                <>
                  <span>/</span>
                  <GlobalLink
                    href={continentHref}
                    className="transition-colors hover:text-white/60"
                  >
                    {continentName}
                  </GlobalLink>
                </>
              ) : null}
              {countryName ? (
                <>
                  <span>/</span>
                  <GlobalLink
                    href={countryHref}
                    className="transition-colors hover:text-white/60"
                  >
                    {countryName}
                  </GlobalLink>
                </>
              ) : null}
              <span>/</span>
              <span className="text-white/60">{region.name}</span>
            </div>

            <div className="flex flex-col gap-3">
              {region.typeLabel ? (
                <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan-400/60 uppercase">
                  {region.typeLabel}
                </p>
              ) : null}

              <h1 className="text-[clamp(3rem,8vw,6rem)] leading-[0.92] font-bold tracking-[-0.04em] text-white">
                {region.name}
              </h1>

              {region.heroTagline ? (
                <p className="max-w-[48ch] text-lg leading-[1.5] font-light text-white/70">
                  {region.heroTagline}
                </p>
              ) : region.summary ? (
                <p className="max-w-[52ch] text-base leading-7 text-white/55">
                  {region.summary}
                </p>
              ) : null}
            </div>

            {/* Stats row */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Libraries"
                value={
                  typeof region.libraryCount === "number" &&
                  region.libraryCount > 0
                    ? new Intl.NumberFormat().format(region.libraryCount)
                    : "—"
                }
              />
              {typeof region.areaCount === "number" && region.areaCount > 0 ? (
                <StatCard
                  label={areaTypeLabel}
                  value={new Intl.NumberFormat().format(region.areaCount)}
                />
              ) : null}
            </div>
          </Container>
        </section>

        {/* ── Interactive Map ───────────────────────────────────────────────── */}
        <section className="border-t border-white/6 py-14 sm:py-18">
          <Container>
            <div className="mb-6">
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                Spatial Distribution
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {region.name ? `Libraries in ${region.name}` : "Map View"}
              </h2>
            </div>
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

        {/* ── Pillar Institutions ───────────────────────────────────────────── */}
        {hasFeaturedLibraries ? (
          <section className="relative overflow-hidden border-t border-white/6 py-14 sm:py-18">
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
              <FeaturedLibraryCards libraries={region.featuredLibraries} />
            </Container>
          </section>
        ) : null}

        {/* ── Areas grid ────────────────────────────────────────────────────── */}
        {hasAreas ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                    Browse Within
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {areaTypeLabel}
                  </h2>
                </div>
                {typeof region.areaCount === "number" &&
                region.areaCount > region.areas!.length ? (
                  <span className="text-sm text-white/36">
                    {region.areaCount} {areaTypeLabel.toLowerCase()} total
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {region.areas!.map((area, i) => (
                  <GlobalLink
                    key={(area as { slug?: string }).slug ?? i}
                    href={`/${continentSlug}/${countrySlug}/${slug}/${(area as { slug?: string }).slug}`}
                    className={cn(
                      homepagePanelClassName,
                      "group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-[border-color,background-color] duration-300 hover:border-cyan-200/20 hover:bg-white/[0.08]"
                    )}
                  >
                    <span className="font-medium text-white/80 group-hover:text-white">
                      {(area as { name?: string }).name}
                    </span>
                    {(area as { typeLabel?: string | null }).typeLabel ? (
                      <span className="text-xs text-white/30">
                        {(area as { typeLabel: string }).typeLabel}
                      </span>
                    ) : null}
                  </GlobalLink>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── Quick Links ───────────────────────────────────────────────────── */}
        {hasQuickLinks ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-8">
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Navigate
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
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

        {/* ── Dynamic zone sections (in CMS order) ─────────────────────────── */}
        {typedSections.map((section) => (
          <div key={section.id} className="border-t border-white/6">
            {section.__component === "sections.editorial-block" ? (
              <EditorialBlock section={section as EditorialBlockType} />
            ) : section.__component === "sections.cta-banner" ? (
              <CtaBannerSection section={section as CtaBannerType} />
            ) : null}
          </div>
        ))}

        {/* ── Journey CTA fallback ──────────────────────────────────────────── */}
        {ctaBanners.length === 0 && typedSections.length === 0 ? (
          <section className="relative overflow-hidden border-t border-white/6 py-24 sm:py-32">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(79,70,229,0.18),transparent_70%)]" />
            <Container>
              <div className="flex flex-col items-center gap-6 text-center">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Start Exploring
                </p>
                <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.045em] text-white">
                  Discover {region.name}
                </h2>
                <p className="max-w-[40ch] text-base leading-7 text-white/50">
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
