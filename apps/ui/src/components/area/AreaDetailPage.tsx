import Image from "next/image"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import type { PopulatedAreaData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
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
    </div>
  )
}

// ── Library card ──────────────────────────────────────────────────────────────

function LibraryCard({
  library,
  href,
}: {
  library: {
    name: string
    slug: string
    summary?: string | null
    libraryType?: string | null
    heroImage?: { url?: string | null; alternativeText?: string | null } | null
  }
  href: string
}) {
  const imageUrl = library.heroImage?.url
    ? formatStrapiMediaUrl(library.heroImage.url)
    : null

  return (
    <GlobalLink
      href={href}
      className={cn(
        homepagePanelClassName,
        "group relative flex min-h-[11rem] flex-col justify-end overflow-hidden transition-[border-color,background-color] duration-500 hover:border-cyan-200/16 hover:bg-white/[0.07]"
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={library.heroImage?.alternativeText ?? library.name}
          fill
          className="-z-10 object-cover opacity-20 transition-opacity duration-500 group-hover:opacity-30"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(5,8,22,0.85)_100%)]" />
      <div className="relative z-10 space-y-1 p-5">
        {library.libraryType ? (
          <p className="text-[10px] font-semibold tracking-[0.14em] text-cyan-400/70 uppercase">
            {library.libraryType}
          </p>
        ) : null}
        <h3 className="font-semibold text-white transition-colors group-hover:text-cyan-50">
          {library.name}
        </h3>
        {library.summary ? (
          <p className="line-clamp-2 text-sm leading-6 text-white/50">
            {library.summary}
          </p>
        ) : null}
      </div>
    </GlobalLink>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AreaDetailPage({
  area,
  navbar,
  locale,
  slug,
  regionSlug,
  countrySlug,
  continentSlug,
}: {
  readonly area: PopulatedAreaData | null
  readonly navbar?: NavbarData
  readonly locale: Locale
  readonly slug: string
  readonly regionSlug: string
  readonly countrySlug: string
  readonly continentSlug: string
}) {
  if (!area) {
    return (
      <div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-white/40">Area not found.</p>
        </main>
      </div>
    )
  }

  const hasLibraries =
    Array.isArray(area.libraries) && area.libraries.length > 0

  const regionName = area.region?.name
  const regionHref = `/${continentSlug}/${countrySlug}/${regionSlug}`
  const countryName = area.region?.country?.name
  const countryHref = `/${continentSlug}/${countrySlug}`
  const continentName = area.region?.country?.continent?.name
  const continentHref = `/${continentSlug}`

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(92,149,255,0.09),transparent_38%),radial-gradient(circle_at_82%_70%,rgba(103,221,255,0.06),transparent_30%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative isolate flex min-h-[42vh] flex-col justify-end overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,8,22,0.45)_0%,rgba(5,8,22,0.92)_65%,rgba(5,8,22,1)_100%)]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,rgba(79,70,229,0.16),transparent_60%)]" />

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
              {regionName ? (
                <>
                  <span>/</span>
                  <GlobalLink
                    href={regionHref}
                    className="transition-colors hover:text-white/60"
                  >
                    {regionName}
                  </GlobalLink>
                </>
              ) : null}
              <span>/</span>
              <span className="text-white/60">{area.name}</span>
            </div>

            <div className="flex flex-col gap-3">
              {area.typeLabel ? (
                <p className="text-[11px] font-semibold tracking-[0.16em] text-cyan-400/60 uppercase">
                  {area.typeLabel}
                </p>
              ) : null}
              <h1 className="text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.04em] text-white">
                {area.name}
              </h1>
              {area.summary ? (
                <p className="max-w-[52ch] text-base leading-7 text-white/55">
                  {area.summary}
                </p>
              ) : null}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Libraries"
                value={
                  typeof area.libraryCount === "number" && area.libraryCount > 0
                    ? new Intl.NumberFormat().format(area.libraryCount)
                    : "—"
                }
              />
            </div>
          </Container>
        </section>

        {/* ── Interactive Map ───────────────────────────────────────────────── */}
        <section className="border-t border-white/6 py-14 sm:py-18">
          <Container>
            <div className="mb-6">
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                Spatial View
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {area.name ? `Libraries in ${area.name}` : "Map View"}
              </h2>
            </div>
            <InteractiveMap
              mapConfig={area.mapConfig}
              mode="region"
              regionSlug={regionSlug}
              countrySlug={countrySlug}
              continentSlug={continentSlug}
              locale={locale}
            />
          </Container>
        </section>

        {/* ── Libraries in this area ────────────────────────────────────────── */}
        {hasLibraries ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-8">
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Browse
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Libraries in {area.name}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {area.libraries!.map((library) => (
                  <LibraryCard
                    key={library.slug}
                    library={library}
                    href={`/${continentSlug}/${countrySlug}/${regionSlug}/${slug}/${library.slug}`}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── Fallback CTA ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-white/6 py-24 sm:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(79,70,229,0.18),transparent_70%)]" />
          <Container>
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                Start Exploring
              </p>
              <h2 className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.93] font-bold tracking-[-0.045em] text-white">
                Discover {area.name}
              </h2>
              <p className="max-w-[40ch] text-base leading-7 text-white/50">
                Explore the libraries and cultural institutions across{" "}
                {area.name}.
              </p>
              <GlobalLink
                href={regionHref}
                className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/14"
              >
                Back to {regionName ?? "Region"}
              </GlobalLink>
            </div>
          </Container>
        </section>
      </main>
    </div>
  )
}

AreaDetailPage.displayName = "AreaDetailPage"

export default AreaDetailPage
