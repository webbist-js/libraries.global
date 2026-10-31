import {
  libraryTypeName,
  hasOpeningHours,
  normalizeMobileTimetable,
  type LibraryNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import type { BreadcrumbItem } from "@/components/ds"
import { MainContent } from "@/components/ds/MainContent"
import { Container } from "@/components/elementary/Container"
import { CurrentLibraryMarker } from "@/components/library/CurrentLibraryMarker"
import { LibrariesOnTheMove } from "@/components/library/LibrariesOnTheMove"
import { LIBRARY_ANCHORS } from "@/components/library/library-anchors"
import {
  type OpeningTimesValue,
  toLatLng,
} from "@/components/library/library-page.helpers"
import { libraryPresentation } from "@/components/library/library-presentation"
import { LibraryAmenitiesSection } from "@/components/library/LibraryAdditionalDetails"
import { LibraryAnchorNav } from "@/components/library/LibraryAnchorNav"
import { LibraryAreaSection } from "@/components/library/LibraryArea"
import { LibraryCommunity } from "@/components/library/LibraryCommunity"
import { LibraryContributeCta } from "@/components/library/LibraryContributeCta"
import {
  LibraryCorrectionProvider,
  OpenCorrectionLink,
} from "@/components/library/LibraryCorrection"
import { LibraryEvents } from "@/components/library/LibraryEvents"
import { LibraryFeaturedContribution } from "@/components/library/LibraryFeaturedContribution"
import type { TranslateLocale } from "@/components/library/LibraryHelpPanel"
import { LibraryHero } from "@/components/library/LibraryHero"
import { LibraryOpenStatusBadge } from "@/components/library/LibraryHoursTable"
import { LibraryMissingDetails } from "@/components/library/LibraryMissingDetails"
import { LibraryNetworks } from "@/components/library/LibraryNetworks"
import { LibraryNoticeBanners } from "@/components/library/LibraryNoticeBanners"
import { LibraryOverviewMetrics } from "@/components/library/LibraryOverviewMetrics"
import { LibraryReachTeaser } from "@/components/library/LibraryReachTeaser"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import {
  LibraryChangesSection,
  LibraryCollectionsSection,
  LibraryFacilitiesSection,
  LibraryVisitSection,
} from "@/components/library/LibrarySections"
import { LibraryRecordPanel } from "@/components/library/LibrarySidebar"
import { LibraryVisitRail } from "@/components/library/LibraryVisitRail"
import { StaffLibraryEntry } from "@/components/library/StaffLibraryEntry"
import { verifyRecordOf } from "@/components/library/verify.logic"
import { LocationHierarchy } from "@/components/location/LocationSidebar"
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
  neighboursUnavailable: true,
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
  const tPage = useUiTranslations("libraryPage")

  if (library) library = { ...library, notices } as PopulatedLibraryData
  if (!library) {
    return (
      <div
        className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <MainContent className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>Library not found.</p>
        </MainContent>
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

  const parentCrumb = crumbs.at(-2)

  const presentation = libraryPresentation(library, area)
  const {
    mobile,
    digital,
    hasAccess,
    hasServices,
    hasAbout,
    hasEvents,
    hasNearby,
    hasReach,
    missing,
    checklist,
    unanswered,
  } = presentation
  const addHref = placeAddHref({
    continent: library.continent?.slug ?? undefined,
    country: library.country?.slug ?? undefined,
    region: library.region?.slug ?? undefined,
  })
  const mapNeighbours = area.neighbours.flatMap((n) =>
    n.lat !== null && n.lng !== null
      ? [{ id: n.id, name: n.name, href: n.href, lat: n.lat, lng: n.lng }]
      : []
  )

  const anchors = [
    { href: "#overview", label: "Overview", icon: LIB_ICONS.map },
    ...(!mobile && !digital
      ? [{ href: "#hours", label: tUi("opening_hours"), icon: LIB_ICONS.clock }]
      : []),
    {
      ...(mobile ? LIBRARY_ANCHORS.stops : LIBRARY_ANCHORS.visit),
      label: tPage(mobile ? "stops" : digital ? "onlineAccess" : "visit"),
    },
    ...(hasAccess
      ? [{ ...LIBRARY_ANCHORS.access, label: tPage("accessFacilities") }]
      : []),
    ...(hasServices
      ? [{ ...LIBRARY_ANCHORS.services, label: tPage("services") }]
      : []),
    ...(hasAbout
      ? [{ href: "#about", label: tPage("about"), icon: LIB_ICONS.book }]
      : []),
    ...(hasEvents ? [{ ...LIBRARY_ANCHORS.events, label: tUi("events") }] : []),
    ...(mobile || hasNearby
      ? [
          {
            ...LIBRARY_ANCHORS.area,
            label: tPage(mobile ? "baseReturns" : "nearby"),
          },
        ]
      : []),
    ...(missing.length
      ? [
          {
            href: "#missing",
            label: tPage("notRecorded"),
            count: missing.length,
            icon: LIB_ICONS.pencil,
          },
        ]
      : []),
    ...(hasReach && !hasNearby
      ? [{ href: "#reach", label: tPage("reach"), icon: LIB_ICONS.map }]
      : []),
    { ...LIBRARY_ANCHORS.changes, label: tPage("sourcesReuse") },
    { href: "#community", label: tPage("community"), icon: LIB_ICONS.people },
  ]

  return (
    <div
      className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CurrentLibraryMarker documentId={library.documentId} />

      <LibraryCorrectionProvider
        library={wizardLibrary}
        path={path}
        record={verifyRecordOf(library)}
      >
        <DashboardPage
          mobileSections={anchors}
          routeKey={path}
          title={library.name ?? "Library"}
          eyebrow={libraryTypeName(library.libraryType) ?? "Library"}
          navigation={
            <>
              <LibraryAnchorNav items={anchors} sidebar />
              <LocationHierarchy
                entries={crumbs.slice(1).map((crumb, index, rows) => ({
                  href: crumb.href ?? path,
                  label: crumb.label,
                  depth: index,
                  current: index === rows.length - 1,
                }))}
              />
            </>
          }
          className="dashboard-library-record"
          toolbar={<RecordToolbar items={crumbs} citeHref="#reuse" />}
          overview={
            <>
              <LibraryHero
                coords={coords}
                library={library}
                neighbours={mapNeighbours}
                untranslatedLocale={untranslatedLocale}
                wizardLibrary={wizardLibrary}
              />
              <LibraryOverviewMetrics library={library} />
            </>
          }
          navigationHeading={
            <RecordContextIdentity
              title={library.name ?? "Library"}
              eyebrow={libraryTypeName(library.libraryType) ?? "Library"}
              parent={
                parentCrumb?.href
                  ? { href: parentCrumb.href, label: parentCrumb.label }
                  : undefined
              }
            >
              {!mobile && !digital ? (
                <LibraryOpenStatusBadge
                  openingTimes={
                    library.openingTimes as OpeningTimesValue | null
                  }
                  timezone={
                    typeof rec.timezone === "string" ? rec.timezone : null
                  }
                  operationalStatus={library.operationalStatus}
                  notices={notices}
                />
              ) : null}
            </RecordContextIdentity>
          }
          navigationFooter={
            <>
              <LibraryContributeCta
                documentId={library.documentId}
                slug={library.slug ?? ""}
              />
              <StaffLibraryEntry
                card
                libraryDocumentId={library.documentId}
                librarySlug={library.slug ?? ""}
                libraryName={library.name ?? ""}
                libraryEntityRef={library.entityRef ?? undefined}
                libraryType={libraryTypeName(library.libraryType)}
                hasActiveFeed={Boolean(rec.hasActiveFeed)}
              />
            </>
          }
          context={
            <>
              {mobile ? <LibraryVisitRail library={library} /> : null}
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
                unanswered={unanswered}
                gaps={checklist.items
                  .filter((item) => !item.done)
                  .map((item) => item.key)}
                translateLocales={translateLocales}
                hasHours={
                  libraryTypeName(library.libraryType) === "Mobile"
                    ? Boolean(
                        normalizeMobileTimetable(rec.mobileTimetable)?.visits
                          .length
                      )
                    : hasOpeningHours(library.openingTimes)
                }
                hasPhoto={Boolean(heroUrl || library.gallery?.length)}
                path={path}
              />
            </>
          }
        >
          <MainContent id="main" className="flex-1">
            <Container className="pb-10">
              <div className="dashboard-record-content">
                <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
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

                  <div className="record-module-pair">
                    {hasServices ? (
                      <LibraryAmenitiesSection
                        library={library}
                        includeAmenities={!hasAccess}
                      />
                    ) : null}
                    <LibraryMissingDetails
                      library={library}
                      missing={missing}
                      addHref={addHref}
                    />
                  </div>
                  {libraryTypeName(library.libraryType) !== "Mobile" &&
                  library.mobileLibraries?.length ? (
                    <LibrariesOnTheMove libraries={library.mobileLibraries} />
                  ) : null}

                  {hasAbout ? (
                    <LibraryCollectionsSection library={library} />
                  ) : null}

                  {hasEvents ? (
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
                  ) : hasNearby ? (
                    <LibraryAreaSection
                      libraryId={library.documentId}
                      addHref={addHref}
                      showReach={hasReach}
                      area={area}
                      libraryName={library.name ?? "This library"}
                      regionName={library.region?.name}
                    />
                  ) : null}

                  {hasReach && !hasNearby ? (
                    <LibrarySectionCard
                      id="reach"
                      title={tPage("reach")}
                      iconPath={LIB_ICONS.map}
                    >
                      <LibraryReachTeaser
                        libraryId={library.documentId}
                        embedded
                      />
                    </LibrarySectionCard>
                  ) : null}
                  <LibraryChangesSection
                    library={library}
                    recordStatus={
                      <LibraryRecordPanel
                        library={library}
                        followers={followers}
                        embedded
                      />
                    }
                    history={history}
                    stats={historyStats}
                    datasets={datasets}
                    reuseUrl={publicCanonicalUrl(canonicalUrl ?? path)}
                  />
                  <LibraryNetworks
                    libraryId={library.documentId}
                    networks={library.networks}
                  />
                  <LibraryCommunity
                    id={library.documentId}
                    locale={locale}
                    contentLocale={contentLocale}
                  />
                </div>
              </div>
            </Container>
          </MainContent>
        </DashboardPage>
      </LibraryCorrectionProvider>
    </div>
  )
}

LibraryDetailPage.displayName = "LibraryDetailPage"

export default LibraryDetailPage
