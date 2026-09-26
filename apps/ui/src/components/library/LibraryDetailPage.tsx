import Image from "next/image"
import type { Locale } from "next-intl"

import {
  Breadcrumb,
  type BreadcrumbItem,
  LocationContributeCTA,
} from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import {
  LIBRARY_ANCHORS,
  LibraryAnchorNav,
  type AnchorItem,
} from "@/components/library/LibraryAnchorNav"
import { LibraryCatalogueCheck } from "@/components/library/LibraryCatalogueCheck"
import { LibraryEvents } from "@/components/library/LibraryEvents"
import LibraryExploreNearby from "@/components/library/LibraryExploreNearby"
import { LibraryHeroActions } from "@/components/library/LibraryHeroActions"
import { LibraryOpenStatusBadge } from "@/components/library/LibraryHoursTable"
import {
  LIB_ICONS,
  LibIcon,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import {
  LibraryCollectionsSection,
  LibraryFacilitiesSection,
  LibraryHistorySection,
  LibrarySourcesSection,
  LibraryVisitSection,
} from "@/components/library/LibrarySections"
import {
  LibraryLinksPanel,
  LibraryMapPanel,
  LibraryRecordPanel,
} from "@/components/library/LibrarySidebar"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import type {
  LibraryCatalogueSummary,
  LibraryRevision,
  PopulatedLibraryData,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

interface LibraryDetailPageProps {
  readonly library: PopulatedLibraryData | null
  readonly locale: Locale
  readonly nearbyLibraries?: PopulatedLibraryData[]
  readonly revisions?: LibraryRevision[]
  readonly catalogue?: LibraryCatalogueSummary | null
}

export function LibraryDetailPage({
  library,
  locale,
  nearbyLibraries = [],
  revisions = [],
  catalogue = null,
}: LibraryDetailPageProps) {
  if (!library) {
    return (
      <div
        className="relative flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} />
        <main className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>Library not found.</p>
        </main>
      </div>
    )
  }

  const rec = library as unknown as Record<string, unknown>
  const tint = tintForLibraryType(library.libraryType)
  const typeLabel = library.libraryType
    ? library.libraryType === "Other"
      ? "Library"
      : `${library.libraryType} library`
    : null
  const heroUrl = formatStrapiMediaUrl(library.heroImage?.url)
  const openingTimes =
    (library.openingTimes as OpeningTimesValue | null) ?? null
  const timezone = (rec.timezone as string | null) ?? null

  const locationLine = [
    library.city,
    library.region?.name,
    library.country?.name,
  ]
    .filter(Boolean)
    .join(", ")

  const shortName = (rec.shortName as string | null) ?? null

  const hasHistory = Boolean(rec.foundedYear || rec.openedYear)
  const anchors: AnchorItem[] = [
    LIBRARY_ANCHORS.photos,
    LIBRARY_ANCHORS.visit,
    LIBRARY_ANCHORS.access,
    LIBRARY_ANCHORS.collections,
    ...(hasHistory ? [LIBRARY_ANCHORS.history] : []),
    LIBRARY_ANCHORS.events,
    LIBRARY_ANCHORS.sources,
  ]

  const crumbs: BreadcrumbItem[] = [
    { href: "/", label: "Home" },
    ...(library.continent?.slug
      ? [
          {
            href: `/${library.continent.slug}`,
            label: library.continent.name ?? "",
          },
        ]
      : []),
    ...(library.continent?.slug && library.country?.slug
      ? [
          {
            href: `/${library.continent.slug}/${library.country.slug}`,
            label: library.country.name ?? "",
          },
        ]
      : []),
    ...(library.continent?.slug && library.country?.slug && library.region?.slug
      ? [
          {
            href: `/${library.continent.slug}/${library.country.slug}/${library.region.slug}`,
            label: library.region.name ?? "",
          },
        ]
      : []),
    { label: library.name ?? "" },
  ]

  return (
    <div
      className="relative flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-22 sm:px-8 sm:pt-10">
        {/* Breadcrumb */}
        <Breadcrumb items={crumbs} />

        {/* Hero */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-[1_1_520px]">
            <div className="mb-3.5 flex flex-wrap gap-2">
              {typeLabel ? (
                <span
                  className="flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[14px] font-semibold"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  <LibIcon d={LIB_ICONS.building} size={16} />
                  {typeLabel}
                </span>
              ) : null}
              <LibraryOpenStatusBadge
                openingTimes={openingTimes}
                timezone={timezone}
              />
            </div>
            <h1
              className="m-0 text-[clamp(44px,6vw,76px)] leading-none tracking-[-0.02em]"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              {library.name}
            </h1>
            <p
              className="mt-3 mb-0 flex flex-wrap items-center gap-1.5 text-[17px]"
              style={{ color: T.ink.dim }}
            >
              <LibIcon d={LIB_ICONS.pin} size={18} />
              {shortName ? (
                <>
                  Also known as{" "}
                  <span style={{ color: T.ink.base }}>{shortName}</span>
                  {locationLine ? " · " : ""}
                </>
              ) : null}
              {locationLine}
            </p>
          </div>

          <LibraryHeroActions
            librarySlug={library.slug ?? ""}
            libraryName={library.name ?? ""}
            libraryDocumentId={library.documentId ?? ""}
          />
        </div>

        {/* On this page */}
        <LibraryAnchorNav items={anchors} />

        {/* Content: main column + sidebar */}
        <div className="mt-7 flex flex-wrap items-start gap-7">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            {/* Photos */}
            <div
              id="photos"
              className="relative scroll-mt-32 overflow-hidden rounded-3xl"
              style={{
                aspectRatio: "16/8",
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
              }}
            >
              {heroUrl ? (
                <Image
                  src={heroUrl}
                  alt={library.heroImage?.alternativeText ?? library.name ?? ""}
                  fill
                  sizes="(max-width: 900px) 100vw, 60vw"
                  className="rounded-[18px] object-cover p-2"
                />
              ) : (
                <div
                  className="absolute inset-2 flex items-center justify-center rounded-[18px]"
                  style={{ background: tint.bg }}
                >
                  <span
                    aria-hidden="true"
                    className="text-[64px]"
                    style={{ fontFamily: T.font.serif, color: tint.fg }}
                  >
                    {(library.name ?? "?").charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <p className="-mt-2 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
              {heroUrl ? "Have a better photo? " : "No community photos yet. "}
              <GlobalLink
                href="/contribute"
                className="underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Add a photo you took or have permission to share
              </GlobalLink>{" "}
              (CC BY or CC BY-SA).
            </p>

            <LibraryVisitSection library={library} />
            <LibraryFacilitiesSection library={library} />
            <LibraryCollectionsSection library={library} />

            <CatalogueSection library={library} catalogue={catalogue} />
            <LibraryHistorySection library={library} />

            {/* Events */}
            {(rec.hasActiveFeed as boolean) ? (
              <LibrarySectionCard
                id="events"
                title="Events"
                iconPath={LIB_ICONS.calendar}
              >
                <LibraryEvents entityRef={library.entityRef} hasActiveFeed />
              </LibrarySectionCard>
            ) : (
              <LibrarySectionCard
                id="events"
                title="Events"
                iconPath={LIB_ICONS.calendar}
                dashed
              >
                <p
                  className="m-0 text-[17px] leading-normal"
                  style={{ color: T.ink.dim }}
                >
                  No events listed. If you run events here, you can add them or
                  link your events calendar.
                </p>
                <GlobalLink
                  href="/contribute/event-feed"
                  className="mt-3 inline-block font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  Add an event
                </GlobalLink>
              </LibrarySectionCard>
            )}

            <LibrarySourcesSection library={library} revisions={revisions} />

            {/* Nearby */}
            {nearbyLibraries.length > 0 ? (
              <LibrarySectionCard
                id="nearby"
                title="Nearby libraries"
                iconPath={LIB_ICONS.pin}
              >
                <LibraryExploreNearby
                  libraries={nearbyLibraries}
                  regionName={library.region?.name}
                />
              </LibrarySectionCard>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="top-24 flex flex-[1_1_300px] flex-col gap-4 lg:sticky">
            <LibraryRecordPanel library={library} />
            <LibraryLinksPanel library={library} />
            <LibraryMapPanel library={library} />
          </aside>
        </div>
      </main>

      <LocationContributeCTA
        entityType="library"
        locationName={library.name ?? "this library"}
      />
    </div>
  )
}

/** Live availability check, shown when the Library's catalogue is connected. */
function CatalogueSection({
  library,
  catalogue,
}: {
  readonly library: PopulatedLibraryData
  readonly catalogue: LibraryCatalogueSummary | null
}) {
  if (!catalogue || catalogue.status === "unsupported" || !library.documentId)
    return null

  return (
    <LibrarySectionCard
      id="catalogue"
      title="Check the catalogue"
      iconPath={LIB_ICONS.search}
      intro="See whether a book is on the shelf here, or at another branch."
    >
      <LibraryCatalogueCheck
        libraryDocumentId={library.documentId}
        catalogueName={catalogue.name}
        catalogueUrl={catalogue.url}
      />
    </LibrarySectionCard>
  )
}

LibraryDetailPage.displayName = "LibraryDetailPage"

export default LibraryDetailPage
