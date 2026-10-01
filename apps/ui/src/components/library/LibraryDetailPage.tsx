import Image from "next/image"
import type { Locale } from "next-intl"

import type { BreadcrumbItem } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { facilityRows } from "@/components/library/facility-rows"
import { LIBRARY_ANCHORS } from "@/components/library/library-anchors"
import { toLatLng } from "@/components/library/library-page.helpers"
import { LibraryAnchorNav } from "@/components/library/LibraryAnchorNav"
import { LibraryAreaSection } from "@/components/library/LibraryArea"
import { LibraryCorrectionProvider } from "@/components/library/LibraryCorrection"
import { LibraryEvents } from "@/components/library/LibraryEvents"
import type { TranslateLocale } from "@/components/library/LibraryHelpPanel"
import { LibraryHero } from "@/components/library/LibraryHero"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import {
  hasCollections,
  LibraryCollectionsSection,
  LibraryEventsEmpty,
  LibraryFacilitiesSection,
  LibraryHistorySection,
  LibraryReuseSection,
  LibrarySourcesSection,
  LibraryVisitSection,
} from "@/components/library/LibrarySections"
import {
  LibraryClaimNote,
  LibraryLinksPanel,
  LibraryRecordPanel,
  LibraryTasksPanel,
} from "@/components/library/LibrarySidebar"
import { T } from "@/lib/design-tokens"
import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"
import type { LibraryAreaData } from "@/lib/strapi-api/content/library-area"
import type {
  LibraryRevision,
  PopulatedLibraryData,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

const NO_AREA: LibraryAreaData = {
  neighbours: [],
  regionTotal: null,
  withinRadius: null,
  sundays: null,
}

interface LibraryDetailPageProps {
  readonly library: PopulatedLibraryData | null
  readonly locale: Locale
  /** Nearby libraries and area figures, from the index. */
  readonly area?: LibraryAreaData
  readonly revisions?: LibraryRevision[]
  /** The dataset this record was imported from, if any. */
  readonly dataset?: DatasetRecord | null
  /** The record's canonical, absolute URL (for the citation). */
  readonly canonicalUrl?: string
  /** People following the library; null leaves the count out. */
  readonly followers?: number | null
  /** Set when this is the default-locale stand-in for a missing translation. */
  readonly untranslatedLocale?: string | null
  /** Strapi's configured locales, for the "Translate this record" link. */
  readonly translateLocales?: readonly TranslateLocale[]
}

export function LibraryDetailPage({
  library,
  locale,
  area = NO_AREA,
  revisions = [],
  dataset = null,
  canonicalUrl,
  followers = null,
  untranslatedLocale = null,
  translateLocales = [],
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
  const heroUrl = formatStrapiMediaUrl(library.heroImage?.url)
  const coords = toLatLng(library.location)

  const locationLine = [
    library.city,
    library.region?.name,
    library.country?.name,
  ]
    .filter(Boolean)
    .join(", ")
  const path =
    library.continent?.slug &&
    library.country?.slug &&
    library.region?.slug &&
    library.slug
      ? `/${library.continent.slug}/${library.country.slug}/${library.region.slug}/${library.slug}`
      : "/libraries"
  const wizardLibrary = {
    slug: library.slug ?? "",
    name: library.name ?? "",
    ...(locationLine ? { place: locationLine } : {}),
  }

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

  const facilities = facilityRows(library)
  const unanswered = facilities.filter((r) => r.state === "unknown")
  const stepFree =
    facilities.find((r) => r.label === "Step-free entrance")?.state ?? "yes"
  const hasFeed = Boolean(rec.hasActiveFeed)
  const collectionsFull = hasCollections(library)
  const mapNeighbours = area.neighbours.flatMap((n) =>
    n.lat !== null && n.lng !== null
      ? [{ id: n.id, name: n.name, href: n.href, lat: n.lat, lng: n.lng }]
      : []
  )

  const anchors = [
    LIBRARY_ANCHORS.visit,
    LIBRARY_ANCHORS.access,
    LIBRARY_ANCHORS.history,
    LIBRARY_ANCHORS.collections,
    LIBRARY_ANCHORS.events,
    LIBRARY_ANCHORS.area,
    LIBRARY_ANCHORS.sources,
    LIBRARY_ANCHORS.reuse,
  ]

  return (
    <div
      className="relative flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <LibraryCorrectionProvider library={wizardLibrary} path={path}>
        <main className="flex-1">
          <LibraryHero
            coords={coords}
            crumbs={crumbs}
            hasPhoto={Boolean(heroUrl)}
            library={library}
            neighbours={mapNeighbours}
            stepFree={stepFree}
            untranslatedLocale={untranslatedLocale}
            wizardLibrary={wizardLibrary}
          />

          <LibraryAnchorNav items={anchors} />

          <Container className="pt-7 pb-22">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
                {heroUrl ? (
                  <figure
                    className="relative m-0 overflow-hidden rounded-3xl"
                    style={{
                      aspectRatio: "16/7",
                      border: `1px solid ${T.border.line}`,
                      background: T.bg.deep,
                    }}
                  >
                    <Image
                      src={heroUrl}
                      alt={
                        library.heroImage?.alternativeText ?? library.name ?? ""
                      }
                      fill
                      sizes="(max-width: 900px) 100vw, 60vw"
                      className="object-cover"
                    />
                  </figure>
                ) : null}

                <LibraryVisitSection library={library} />
                <LibraryFacilitiesSection library={library} path={path} />

                <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  <LibraryHistorySection library={library} />
                  {collectionsFull ? null : (
                    <LibraryCollectionsSection library={library} />
                  )}
                  {hasFeed ? null : <LibraryEventsEmpty />}
                </div>

                {collectionsFull ? (
                  <LibraryCollectionsSection library={library} />
                ) : null}
                {hasFeed ? (
                  <LibrarySectionCard
                    id="events"
                    title="Events"
                    iconPath={LIB_ICONS.calendar}
                    tone="neutral"
                  >
                    <LibraryEvents
                      entityRef={library.entityRef}
                      hasActiveFeed
                    />
                  </LibrarySectionCard>
                ) : null}

                <LibraryAreaSection
                  area={area}
                  libraryName={library.name ?? "This library"}
                  regionName={library.region?.name}
                />
                <LibrarySourcesSection
                  library={library}
                  revisions={revisions}
                  dataset={dataset}
                />
                <LibraryReuseSection
                  library={library}
                  url={canonicalUrl ?? path}
                />
              </div>

              <aside
                aria-label="About this record"
                className="top-32 flex flex-[1_1_280px] flex-col gap-4 lg:sticky lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:overscroll-contain"
              >
                <LibraryRecordPanel followers={followers} library={library} />
                <LibraryTasksPanel
                  facilityQuestions={unanswered.length}
                  library={library}
                  translateLocales={translateLocales}
                />
                <LibraryLinksPanel library={library} />
                <LibraryClaimNote library={library} />
              </aside>
            </div>
          </Container>
        </main>
      </LibraryCorrectionProvider>
    </div>
  )
}

LibraryDetailPage.displayName = "LibraryDetailPage"

export default LibraryDetailPage
