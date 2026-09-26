import Image from "next/image"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
  LocationEmptyState,
  LocationHero,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import { LocationTabBar } from "@/components/location/LocationTabBar"
import { InteractiveMap } from "@/components/map/InteractiveMap"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import type { PopulatedAreaData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// ── Library card (v2 — tinted monogram, white card) ───────────────────────────

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
  const tint = tintForLibraryType(library.libraryType)

  return (
    <GlobalLink
      href={href}
      className="group flex flex-col overflow-hidden rounded-3xl transition-[border-color,box-shadow] hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,0.08)]"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div className="relative m-2 h-[130px] overflow-hidden rounded-2xl">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={library.heroImage?.alternativeText ?? library.name}
            fill
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center"
            style={{ background: tint.bg }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: 48,
                fontWeight: 500,
                color: tint.fg,
              }}
            >
              {library.name.charAt(0)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-5 pt-1 pb-5">
        {library.libraryType ? (
          <span
            className="self-start rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {library.libraryType}
          </span>
        ) : null}
        <h3
          className="m-0 text-[22px] leading-[1.15]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {library.name}
        </h3>
        {library.summary ? (
          <p
            className="m-0 line-clamp-2 text-[14px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
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
  locale,
  slug,
  regionSlug,
  countrySlug,
  continentSlug,
}: {
  readonly area: PopulatedAreaData | null
  readonly locale: Locale
  readonly slug: string
  readonly regionSlug: string
  readonly countrySlug: string
  readonly continentSlug: string
}) {
  if (!area) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} />
        <main className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>Area not found.</p>
        </main>
      </div>
    )
  }

  const hasLibraries =
    Array.isArray(area.libraries) && area.libraries.length > 0

  const regionName = area.region?.name
  const regionHref = `/${continentSlug}/${countrySlug}/${regionSlug}`
  const countryName = area.region?.country?.name
  const continentName = area.region?.country?.continent?.name
  const libraryCount =
    typeof area.libraryCount === "number" && area.libraryCount > 0
      ? area.libraryCount
      : null

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(hasLibraries ? [{ id: "libraries", label: "Libraries" }] : []),
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
            ...(regionSlug && regionName ? { [regionSlug]: regionName } : {}),
            [slug]: area.name ?? "",
          }}
          typeLabel={area.typeLabel ?? "Area"}
          title={area.name ?? ""}
          intro={area.summary}
          stats={[
            {
              label: "Libraries",
              value: libraryCount
                ? new Intl.NumberFormat().format(libraryCount)
                : "—",
              note: libraryCount ? undefined : "None documented yet",
            },
          ]}
        />

        <LocationTabBar tabs={tabs} />

        <Container>
          <div className="flex flex-col gap-12 pt-10">
            {/* ── Libraries in this area ──────────────────────────────────── */}
            {hasLibraries ? (
              <section id="libraries" className="scroll-mt-28">
                <LocationSectionHeading
                  title={`Libraries in ${area.name}`}
                  count={
                    libraryCount
                      ? `${libraryCount} ${libraryCount === 1 ? "library" : "libraries"}`
                      : null
                  }
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {area.libraries!.map((library) => (
                    <LibraryCard
                      key={library.slug}
                      library={library}
                      href={`/${continentSlug}/${countrySlug}/${regionSlug}/${slug}/${library.slug}`}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <LocationEmptyState name={area.name ?? "this area"} />
            )}

            {/* ── Map ─────────────────────────────────────────────────────── */}
            <section id="map" className="scroll-mt-28">
              <LocationSectionHeading
                title={area.name ? `Libraries in ${area.name}` : "Map view"}
                description="Every documented library, plotted."
              />
              <div
                className="overflow-hidden rounded-3xl"
                style={{ border: `1px solid ${T.border.line}` }}
              >
                <InteractiveMap
                  mapConfig={area.mapConfig}
                  mode="region"
                  regionSlug={regionSlug}
                  countrySlug={countrySlug}
                  continentSlug={continentSlug}
                  locale={locale}
                />
              </div>
            </section>

            {/* ── Back link ───────────────────────────────────────────────── */}
            <div>
              <GlobalLink
                href={regionHref}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface)"
                style={{
                  border: `1px solid ${T.border.hi}`,
                  color: T.ink.base,
                  background: T.bg.deep,
                }}
              >
                ← Back to {regionName ?? "region"}
              </GlobalLink>
            </div>
          </div>
        </Container>
      </main>
    </div>
  )
}

AreaDetailPage.displayName = "AreaDetailPage"

export default AreaDetailPage
