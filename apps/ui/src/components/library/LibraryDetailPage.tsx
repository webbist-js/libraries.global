import {
  libraryTypeName,
  hasOpeningHours,
  normalizeMobileTimetable,
  type LibraryNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { DiscussionFeed } from "@/components/discussions/DiscussionFeed"
import type { BreadcrumbItem } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { CurrentLibraryMarker } from "@/components/library/CurrentLibraryMarker"
import { facilityRows } from "@/components/library/facility-rows"
import { LibrariesOnTheMove } from "@/components/library/LibrariesOnTheMove"
import { LIBRARY_ANCHORS } from "@/components/library/library-anchors"
import { toLatLng } from "@/components/library/library-page.helpers"
import { LibraryAmenitiesSection } from "@/components/library/LibraryAdditionalDetails"
import { LibraryAnchorNav } from "@/components/library/LibraryAnchorNav"
import { LibraryAreaSection } from "@/components/library/LibraryArea"
import {
  LibraryCorrectionProvider,
  OpenCorrectionLink,
} from "@/components/library/LibraryCorrection"
import { LibraryEvents } from "@/components/library/LibraryEvents"
import { LibraryFeaturedContribution } from "@/components/library/LibraryFeaturedContribution"
import type { TranslateLocale } from "@/components/library/LibraryHelpPanel"
import { LibraryHero } from "@/components/library/LibraryHero"
import { LibraryNoticeBanners } from "@/components/library/LibraryNoticeBanners"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import {
  hasCollections,
  LibraryChangesSection,
  LibraryCollectionsSection,
  LibraryEventsEmpty,
  LibraryFacilitiesSection,
  LibraryVisitSection,
} from "@/components/library/LibrarySections"
import {
  LibraryClaimNote,
  LibraryLinksPanel,
  LibraryRecordPanel,
  LibraryTasksPanel,
} from "@/components/library/LibrarySidebar"
import { verifyRecordOf } from "@/components/library/verify.logic"
import { StopsTimesSection } from "@/components/mobile/StopsTimesSection"
import { placeAddHref } from "@/lib/contribution-place"
import { T } from "@/lib/design-tokens"
import { routing } from "@/lib/navigation"
import { publicCanonicalUrl } from "@/lib/seo/metadata"
import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"
import type { LibraryAreaData } from "@/lib/strapi-api/content/library-area"
import type {
  LibraryHistoryPage,
  LibraryHistoryStats,
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
  readonly notices?: LibraryNotice[]
  readonly library: PopulatedLibraryData | null
  readonly locale: Locale
  /** Nearby libraries and area figures, from the index. */
  readonly area?: LibraryAreaData
  /** Page 1 of the record's Change Batches; null when unavailable. */
  readonly history?: LibraryHistoryPage | null
  /** The record's change counts for the last 24 months. */
  readonly historyStats?: LibraryHistoryStats | null
  /** The dataset this record was imported from, if any. */
  readonly datasets?: DatasetRecord[]
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
  notices = [],
  library,
  locale,
  area = NO_AREA,
  history = null,
  historyStats = null,
  datasets = [],
  canonicalUrl,
  followers = null,
  untranslatedLocale = null,
  translateLocales = [],
}: LibraryDetailPageProps) {
  const tUi = useUiTranslations("ui")
  const tDiscovery = useUiTranslations("discovery")

  if (library) library = { ...library, notices } as PopulatedLibraryData
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
  const contentLocale =
    typeof rec.locale === "string"
      ? rec.locale
      : untranslatedLocale
        ? routing.defaultLocale
        : locale
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
    { href: "/", label: tUi("home") },
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
  const hasAccess =
    libraryTypeName(library.libraryType) !== "Digital" ||
    facilities.some((row) => row.category === "accessibility") ||
    Boolean(rec.accessibilityNotes)
  const hasFeed = Boolean(rec.hasActiveFeed)
  const collectionsFull = hasCollections(library)
  const mapNeighbours = area.neighbours.flatMap((n) =>
    n.lat !== null && n.lng !== null
      ? [{ id: n.id, name: n.name, href: n.href, lat: n.lat, lng: n.lng }]
      : []
  )

  const anchors = [
    libraryTypeName(library.libraryType) === "Mobile"
      ? LIBRARY_ANCHORS.stops
      : LIBRARY_ANCHORS.visit,
    ...(hasAccess
      ? [{ ...LIBRARY_ANCHORS.access, label: "Accessibility & facilities" }]
      : []),
    ...(facilities.some((row) => row.category === "service") ||
    library.languagesServed?.length ||
    library.classificationSystem
      ? [LIBRARY_ANCHORS.services]
      : []),
    ...(collectionsFull
      ? [
          {
            href: "#about",
            label: "About and collections",
            icon: LIB_ICONS.book,
          },
        ]
      : []),
    LIBRARY_ANCHORS.events,
    ...(libraryTypeName(library.libraryType) === "Digital"
      ? []
      : [
          {
            ...LIBRARY_ANCHORS.area,
            label:
              libraryTypeName(library.libraryType) === "Mobile"
                ? "Base and returns"
                : "Nearby",
          },
        ]),
    { ...LIBRARY_ANCHORS.changes, label: "Sources & reuse" },
  ]

  return (
    <div
      className="relative flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />
      <CurrentLibraryMarker documentId={library.documentId} />

      <LibraryCorrectionProvider
        library={wizardLibrary}
        path={path}
        record={verifyRecordOf(library)}
      >
        <main id="main" className="flex-1">
          <LibraryHero
            contribution={
              <LibraryFeaturedContribution
                library={{
                  documentId: library.documentId,
                  slug: library.slug ?? "",
                  name: library.name ?? "This library",
                  libraryType: libraryTypeName(library.libraryType),
                  verifiedSections: rec.verifiedSections,
                  lastVerifiedAt: rec.lastVerifiedAt,
                  city: library.city,
                  website: library.website,
                  mobileTimetable: rec.mobileTimetable,
                  timezone:
                    typeof rec.timezone === "string" ? rec.timezone : null,
                }}
                unanswered={
                  unanswered.filter((row) => row.category !== "service").length
                }
                hasHours={
                  libraryTypeName(library.libraryType) === "Mobile"
                    ? Boolean(
                        normalizeMobileTimetable(rec.mobileTimetable)?.visits
                          .length
                      )
                    : hasOpeningHours(library.openingTimes)
                }
                hasPhoto={Boolean(heroUrl)}
                path={path}
              />
            }
            coords={coords}
            crumbs={crumbs}
            hasPhoto={Boolean(heroUrl)}
            library={library}
            neighbours={mapNeighbours}
            untranslatedLocale={untranslatedLocale}
            wizardLibrary={wizardLibrary}
          />

          <LibraryAnchorNav items={anchors} />

          <Container className="pt-7 pb-22">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
                {libraryTypeName(library.libraryType) === "Mobile" ? (
                  <StopsTimesSection
                    slug={library.slug ?? undefined}
                    id={library.documentId}
                    name={library.name ?? "Mobile library"}
                    value={rec.mobileTimetable}
                    timezone={String(rec.timezone ?? "UTC")}
                    status={library.operationalStatus}
                    notices={notices}
                    timetableUrl={
                      typeof rec.timetableUrl === "string"
                        ? rec.timetableUrl
                        : null
                    }
                  />
                ) : (
                  <>
                    <LibraryNoticeBanners
                      notices={notices}
                      timezone={
                        typeof rec.timezone === "string" ? rec.timezone : null
                      }
                    />
                    <LibraryVisitSection library={library} />
                  </>
                )}
                {hasAccess ? (
                  <LibraryFacilitiesSection library={library} path={path} />
                ) : null}
                <LibraryAmenitiesSection
                  library={library}
                  includeAmenities={!hasAccess}
                />
                {libraryTypeName(library.libraryType) !== "Mobile" &&
                library.mobileLibraries?.length ? (
                  <LibrariesOnTheMove libraries={library.mobileLibraries} />
                ) : null}

                {collectionsFull ? (
                  <LibraryCollectionsSection
                    library={library}
                    footer={
                      !hasFeed ? (
                        <LibraryEventsEmpty
                          inline
                          documentId={library.documentId}
                          libraryName={library.name ?? ""}
                          librarySlug={library.slug ?? ""}
                        />
                      ) : undefined
                    }
                  />
                ) : null}
                {!hasFeed && !collectionsFull ? (
                  <LibraryEventsEmpty
                    documentId={library.documentId}
                    libraryName={library.name ?? ""}
                    librarySlug={library.slug ?? ""}
                  />
                ) : null}

                {hasFeed ? (
                  <LibrarySectionCard
                    id="events"
                    title={tUi("events")}
                    iconPath={LIB_ICONS.calendar}
                    tone="neutral"
                  >
                    <LibraryEvents
                      entityRef={library.entityRef}
                      hasActiveFeed
                    />
                  </LibrarySectionCard>
                ) : null}

                {libraryTypeName(library.libraryType) === "Mobile" ? (
                  <LibrarySectionCard
                    id="area"
                    title="Base and returns"
                    iconPath={LIB_ICONS.map}
                  >
                    <p>
                      {library.homeLibrary?.name
                        ? `This service is based at ${library.homeLibrary.name}. Check with the service for where borrowed items may be returned.`
                        : "The service’s base and return arrangements are not recorded yet."}
                    </p>
                    <OpenCorrectionLink category="Stops & times">
                      Suggest return arrangements
                    </OpenCorrectionLink>
                  </LibrarySectionCard>
                ) : libraryTypeName(library.libraryType) ===
                  "Digital" ? null : (
                  <LibraryAreaSection
                    addHref={placeAddHref({
                      continent: library.continent?.slug ?? undefined,
                      country: library.country?.slug ?? undefined,
                      region: library.region?.slug ?? undefined,
                    })}
                    area={area}
                    libraryName={library.name ?? "This library"}
                    regionName={library.region?.name}
                  />
                )}
                <LibraryChangesSection
                  library={library}
                  history={history}
                  stats={historyStats}
                  datasets={datasets}
                  reuseUrl={publicCanonicalUrl(canonicalUrl ?? path)}
                />
                <DiscussionFeed
                  target={{
                    uid: "api::library.library",
                    documentId: library.documentId,
                    locale: contentLocale,
                  }}
                  subjectSlug="library-life"
                />
              </div>

              <aside
                aria-label={tUi("about_this_record")}
                className="flex flex-[1_1_280px] flex-col gap-4 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
              >
                <LibraryRecordPanel followers={followers} library={library} />
                <GlobalLink
                  className="mt-4 block rounded-xl border p-4 text-sm font-semibold"
                  href={`/contribute/knowledge/new?type=journal&library=${encodeURIComponent(library.documentId)}`}
                  style={{ borderColor: T.border.line }}
                >
                  {tDiscovery("writeLibrary")}
                </GlobalLink>
                <GlobalLink
                  className="mt-2 block text-sm underline"
                  href={`/journal?origin=all&library=${encodeURIComponent(library.documentId)}`}
                >
                  {tDiscovery("readLibrary")}
                </GlobalLink>
                <LibraryTasksPanel
                  facilityQuestions={
                    unanswered.filter((row) => row.category !== "service")
                      .length
                  }
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
