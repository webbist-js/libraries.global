import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import LibraryContent from "@/components/library/LibraryContent"
import LibraryHero from "@/components/library/LibraryHero"
import LibraryInfoCards from "@/components/library/LibraryInfoCards"
import LibraryMap from "@/components/library/LibraryMap"
import LibraryOpeningHours from "@/components/library/LibraryOpeningHours"
import {
  LibraryTabNav,
  LibraryTabPanel,
  LibraryTabsProvider,
} from "@/components/library/LibraryTabs"
import LibraryTagPanel from "@/components/library/LibraryTagPanel"
import LibraryVirtualTour from "@/components/library/LibraryVirtualTour"
import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
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
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function LocationBreadcrumb({ library }: { library: PopulatedLibraryData }) {
  const continentSlug = library.continent?.slug
  const countrySlug = library.country?.slug
  const regionSlug = library.region?.slug

  const parts = [
    continentSlug
      ? { name: library.continent!.name, href: `/${continentSlug}` }
      : null,
    continentSlug && countrySlug
      ? {
          name: library.country!.name,
          href: `/${continentSlug}/${countrySlug}`,
        }
      : null,
    continentSlug && countrySlug && regionSlug
      ? {
          name: library.region!.name,
          href: `/${continentSlug}/${countrySlug}/${regionSlug}`,
        }
      : null,
  ].filter(Boolean) as { name: string; href: string }[]

  if (!parts.length) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/40">
      {parts.map((part, i) => (
        <span key={part.href} className="flex items-center gap-1.5">
          {i > 0 ? <span className="text-white/20">›</span> : null}
          <GlobalLink
            href={part.href}
            className="transition-colors hover:text-white/70"
          >
            {part.name}
          </GlobalLink>
        </span>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LibraryDetailPage({
  library,
  navbar,
  locale,
}: LibraryDetailPageProps) {
  if (!library) {
    return (
      <div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-white/40">Library not found.</p>
        </main>
      </div>
    )
  }

  const toTagItems = (
    items: {
      documentId?: string | null
      id?: number | null
      name: string
      icon?: unknown
      category?: unknown
      summary?: unknown
    }[]
  ) =>
    items.map((item) => ({
      id: item.documentId ?? item.id ?? Math.random(),
      name: item.name,
      category: (item.category as string | null | undefined) ?? null,
      icon: (item.icon as IconHubValue) ?? null,
      summary: (item.summary as string | null | undefined) ?? null,
    }))

  const virtualTourUrl = library.virtualTourEmbed as string | null | undefined

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      {/* Ambient background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(92,149,255,0.08),transparent_34%),radial-gradient(circle_at_75%_60%,rgba(103,221,255,0.06),transparent_28%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        <LibraryTabsProvider defaultTab="overview">
          {/* Tab nav is rendered at the bottom of the hero, over the image */}
          <LibraryHero
            library={library}
            tabNav={
              <LibraryTabNav
                extraTabs={
                  virtualTourUrl
                    ? [{ id: "explore", label: "Explore" }]
                    : undefined
                }
              />
            }
            breadcrumb={<LocationBreadcrumb library={library} />}
          />

          {/* ── Overview ─────────────────────────────────────────────────────── */}
          {/* libraryType, operatorType, foundedYear, openedYear,                */}
          {/* quickLinks, openingTimes, description                               */}
          <LibraryTabPanel id="overview">
            <Container className="py-8 sm:py-12">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                {/* Left: classification card */}
                <div className="space-y-6 lg:col-span-2">
                  <LibraryInfoCards library={library} variant="overview" />
                  <LibraryContent library={library} section="description" />
                </div>

                {/* Right: opening hours */}
                <div>
                  <LibraryOpeningHours
                    openingTimes={
                      library.openingTimes as Parameters<
                        typeof LibraryOpeningHours
                      >[0]["openingTimes"]
                    }
                  />
                </div>
              </div>
            </Container>
          </LibraryTabPanel>

          {/* ── Facilities ───────────────────────────────────────────────────── */}
          {/* services, amenities, accessibility, accessibilityNotes             */}
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

          {/* ── Contact ──────────────────────────────────────────────────────── */}
          {/* streetAddress, city, postalCode, phone, email, website,            */}
          {/* visitNotes, admissionInfo, map + directions                        */}
          <LibraryTabPanel id="contact">
            <Container className="py-8 sm:py-12">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
                {/* Left: map stretches to fill the full height of the right column */}
                <LibraryMap library={library} className="h-full" />

                {/* Right: contact details + visitor info stacked */}
                <div className="space-y-6">
                  <LibraryInfoCards library={library} variant="contact" />
                  <LibraryContent library={library} section="visit-info" />
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
        </LibraryTabsProvider>
      </main>
    </div>
  )
}

LibraryDetailPage.displayName = "LibraryDetailPage"

export default LibraryDetailPage
