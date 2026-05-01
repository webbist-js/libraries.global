import type { Locale } from "next-intl"

import { Breadcrumb, LocationContributeCTA } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import LibraryContactPanel from "@/components/library/LibraryContactPanel"
import LibraryContent from "@/components/library/LibraryContent"
import LibraryExploreNearby from "@/components/library/LibraryExploreNearby"
import LibraryHero from "@/components/library/LibraryHero"
import LibraryInfoCards from "@/components/library/LibraryInfoCards"
import LibraryMap from "@/components/library/LibraryMap"
import LibraryOpeningHours from "@/components/library/LibraryOpeningHours"
import LibraryStats from "@/components/library/LibraryStats"
import {
  LibraryTabNav,
  LibraryTabPanel,
  LibraryTabsProvider,
} from "@/components/library/LibraryTabs"
import LibraryTagPanel from "@/components/library/LibraryTagPanel"
import LibraryVirtualTour from "@/components/library/LibraryVirtualTour"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// The JSON shape returned by @arshiash80/strapi-plugin-iconhub
type IconHubValue = {
  iconData?: string | null
  iconName?: string | null
} | null

interface LibraryDetailPageProps {
  readonly library: PopulatedLibraryData | null
  readonly navbar?: NavbarData
  readonly locale: Locale
  readonly nearbyLibraries?: PopulatedLibraryData[]
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function LocationBreadcrumb({ library }: { library: PopulatedLibraryData }) {
  const continentSlug = library.continent?.slug
  const countrySlug = library.country?.slug
  const regionSlug = library.region?.slug

  const items = [
    { label: "Atlas", href: "/" },
    continentSlug
      ? { label: library.continent!.name, href: `/${continentSlug}` }
      : null,
    continentSlug && countrySlug
      ? {
          label: library.country!.name,
          href: `/${continentSlug}/${countrySlug}`,
        }
      : null,
    continentSlug && countrySlug && regionSlug
      ? {
          label: library.region!.name,
          href: `/${continentSlug}/${countrySlug}/${regionSlug}`,
        }
      : null,
    { label: library.name ?? "" },
  ].filter(Boolean) as { label: string; href?: string }[]

  return <Breadcrumb items={items} />
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LibraryDetailPage({
  library,
  navbar,
  locale,
  nearbyLibraries = [],
}: LibraryDetailPageProps) {
  if (!library) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.space, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-(--t-ink-faint)">Library not found.</p>
        </main>
      </div>
    )
  }

  const toTagItems = (
    items: {
      documentId?: string | null
      id?: string | number | null
      name?: string | null
      icon?: unknown
      category?: unknown
      summary?: unknown
    }[]
  ) =>
    items.map((item) => ({
      id: item.documentId ?? item.id ?? Math.random(),
      name: item.name ?? "",
      category: (item.category as string | null | undefined) ?? null,
      icon: (item.icon as IconHubValue) ?? null,
      summary: (item.summary as string | null | undefined) ?? null,
    }))

  const virtualTourUrl = library.virtualTourEmbed as string | null | undefined

  // Collection stats — repeatable component (value, category, description)
  const rawCollectionStats = (library as Record<string, unknown>)
    .collectionStats
  const libraryStats = Array.isArray(rawCollectionStats)
    ? (rawCollectionStats as {
        value: string
        category?: string | null
        description?: string | null
      }[])
    : []

  // Last verified / entity ref for tab bar
  const lastVerifiedAt = library.lastVerifiedAt as string | null | undefined

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        <LibraryTabsProvider defaultTab="overview">
          {/* Hero — no tab nav passed; nav is rendered as a sibling below */}
          <LibraryHero
            library={library}
            breadcrumb={<LocationBreadcrumb library={library} />}
          />

          {/* Tab nav — sibling of hero so sticky top-14 works correctly.
              Placing it inside overflow-hidden/clip would break sticky. */}
          <LibraryTabNav
            extraTabs={
              virtualTourUrl ? [{ id: "explore", label: "Explore" }] : undefined
            }
            lastVerifiedAt={lastVerifiedAt}
            entityRef={library.entityRef}
          />

          {/* ── Overview ─────────────────────────────────────────────────────── */}
          {/* libraryType, operatorType, foundedYear, architect,                */}
          {/* description, libraryStats                                         */}
          <LibraryTabPanel id="overview">
            <Container className="py-8 sm:py-12">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                {/* Left: classification + description + collection stats */}
                <div className="space-y-6 lg:col-span-2">
                  <LibraryInfoCards library={library} variant="overview" />
                  <LibraryContent library={library} section="description" />
                  {libraryStats.length > 0 ? (
                    <LibraryStats stats={libraryStats} />
                  ) : null}
                </div>

                {/* Right: opening hours + contact & location */}
                <div className="space-y-6">
                  <LibraryOpeningHours
                    openingTimes={
                      library.openingTimes as Parameters<
                        typeof LibraryOpeningHours
                      >[0]["openingTimes"]
                    }
                  />
                  <LibraryContactPanel library={library} />
                </div>
              </div>
            </Container>
          </LibraryTabPanel>

          {/* ── Hours ────────────────────────────────────────────────────────── */}
          <LibraryTabPanel id="hours">
            <Container className="py-8 sm:py-12">
              <LibraryOpeningHours
                openingTimes={
                  library.openingTimes as Parameters<
                    typeof LibraryOpeningHours
                  >[0]["openingTimes"]
                }
                alwaysExpanded
              />
            </Container>
          </LibraryTabPanel>

          {/* ── Visit & Access ───────────────────────────────────────────────── */}
          {/* visitNotes, admissionInfo, accessibilityNotes                      */}
          <LibraryTabPanel id="visit">
            <Container className="py-8 sm:py-12">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <LibraryContent library={library} section="visit-info" />
                <LibraryTagPanel
                  title="Accessibility"
                  headerIcon="mdi:wheelchair-accessibility"
                  items={toTagItems(library.accessibility ?? [])}
                >
                  {Array.isArray(library.accessibilityNotes) &&
                  library.accessibilityNotes.length > 0 ? (
                    <StrapiBlocksContent
                      blocks={
                        library.accessibilityNotes as Parameters<
                          typeof StrapiBlocksContent
                        >[0]["blocks"]
                      }
                    />
                  ) : null}
                </LibraryTagPanel>
              </div>
            </Container>
          </LibraryTabPanel>

          {/* ── Collections ──────────────────────────────────────────────────── */}
          {/* libraryStats, iiifEndpoint, classificationSystem               */}
          <LibraryTabPanel id="collections">
            <Container className="py-8 sm:py-12">
              {libraryStats.length > 0 ? (
                <div className="mb-6">
                  <LibraryStats stats={libraryStats} />
                </div>
              ) : null}

              {/* TODO: integrate IIIF viewer when iiifEndpoint is set */}
              {(library as Record<string, unknown>).iiifEndpoint ? (
                <p className="text-sm text-(--t-ink-faint) italic">
                  {/* TODO: render IIIF viewer for digital collection browsing */}
                  Digital collection available — IIIF viewer coming soon.
                </p>
              ) : (
                <p className="text-sm text-(--t-ink-faint) italic">
                  Collection details not yet available for this library.
                </p>
              )}

              {/* TODO: add events listing once events content type is built */}
            </Container>
          </LibraryTabPanel>

          {/* ── Facilities ───────────────────────────────────────────────────── */}
          {/* services, amenities                                                */}
          <LibraryTabPanel id="facilities">
            <Container className="py-8 sm:py-12">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <LibraryTagPanel
                  title="Services"
                  headerIcon="mdi:briefcase-outline"
                  items={toTagItems(library.services ?? [])}
                />

                <LibraryTagPanel
                  title="Amenities"
                  headerIcon="mdi:sofa-outline"
                  items={toTagItems(library.amenities ?? [])}
                />
              </div>
            </Container>
          </LibraryTabPanel>

          {/* ── Contact ──────────────────────────────────────────────────────── */}
          {/* streetAddress, city, postalCode, phone, email, website, map      */}
          <LibraryTabPanel id="contact">
            <Container className="py-8 sm:py-12">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
                {/* Left: map stretches to fill the full height of the right column */}
                <LibraryMap library={library} className="h-full" />

                {/* Right: contact details */}
                <div className="space-y-6">
                  <LibraryInfoCards library={library} variant="contact" />
                </div>
              </div>
            </Container>
          </LibraryTabPanel>

          {/* ── Explore ──────────────────────────────────────────────────────── */}
          {/* Virtual tour — only rendered when virtualTourEmbed is present     */}
          {virtualTourUrl ? (
            <LibraryTabPanel id="explore">
              <Container className="py-8 sm:py-12">
                <LibraryVirtualTour url={virtualTourUrl} />
              </Container>
            </LibraryTabPanel>
          ) : null}

          {/* ── Explore Nearby ───────────────────────────────────────────────── */}
          {/* TODO: expand to cross-region when data grows */}
          <LibraryTabPanel id="nearby">
            <Container className="py-8 sm:py-12">
              {nearbyLibraries.length > 0 ? (
                <LibraryExploreNearby
                  libraries={nearbyLibraries}
                  regionName={library.region?.name}
                />
              ) : (
                <p className="text-sm text-(--t-ink-faint) italic">
                  No other libraries found in this region yet.
                </p>
              )}
            </Container>
          </LibraryTabPanel>
        </LibraryTabsProvider>
      </main>

      {/* Know something we don't? */}
      <LocationContributeCTA
        entityType="library"
        locationName={library.name ?? "this library"}
      />
    </div>
  )
}

LibraryDetailPage.displayName = "LibraryDetailPage"

export default LibraryDetailPage
