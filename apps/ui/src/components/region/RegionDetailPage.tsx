import { Icon } from "@iconify/react"
import { type GapKey, PANEL_GAPS } from "@repo/shared-data"
import type { Locale } from "next-intl"

import { DrivesHere } from "@/components/drives/DrivesHere"
import { Container } from "@/components/elementary/Container"
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
  countNoun,
  formatCount,
  GAP_DEFS,
  type LocationGapKey,
  lowerFirst,
  pickNearby,
  placeLabels,
  recordGaps,
  regionHelpBody,
  toCoord,
} from "@/components/location/location-page.helpers"
import {
  locationHelpActions,
  LocationHelpPanel,
} from "@/components/location/LocationHelpPanel"
import {
  LocationHero,
  LocationHeroAction,
  type LocationHeroStat,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import {
  type HeroMapLibraryPin,
  LocationHeroMap,
} from "@/components/location/LocationHeroMap"
import { MobilePlaceStops } from "@/components/mobile/MobilePlaceStops"
import {
  NearbyRegions,
  RegionLibraryList,
} from "@/components/region/RegionLibraryList"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"
import { proposeHref } from "@/lib/drives/propose-link"
import type {
  PopulatedRegionData,
  QuickLink,
} from "@/lib/strapi-api/content/server"

// ── Quick link card ──────────────────────────────────────────────────────────

function QuickLinkCard({ link }: { link: QuickLink }) {
  const iconName = link.icon?.iconName ?? null

  return (
    <GlobalLink
      href={link.href}
      className="group flex items-start gap-4 rounded-2xl px-5 py-4 transition-colors hover:bg-(--t-bg-surface)"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: T.accent.chip, color: T.accent.primary }}
      >
        <Icon icon={iconName ?? "mdi:arrow-right"} className="size-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {link.label}
        </span>
        {link.description ? (
          <span className="text-[13px] leading-5" style={{ color: T.ink.dim }}>
            {link.description}
          </span>
        ) : null}
      </div>
    </GlobalLink>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function RegionDetailPage({
  region,
  locale,
  slug,
  countrySlug,
  continentSlug,
  gapCounts,
  drives = [],
}: {
  region: PopulatedRegionData
  locale: Locale
  slug: string
  countrySlug: string
  continentSlug: string
  gapCounts: {
    total: number
    gaps: Partial<Record<GapKey, number>>
  } | null
  drives?: readonly { view: DriveView; here: number }[]
}) {
  const name = region.name ?? ""
  const countryName = region.country?.name
  const continentName =
    region.continent?.name ?? region.country?.continent?.name
  const basePath = `/${continentSlug}/${countrySlug}/${slug}`
  const libraryCount = region.libraryCount ?? 0
  const libraries = region.libraries ?? []
  const hasQuickLinks = Boolean(region.quickLinks?.length)

  // ── Record gaps ─────────────────────────────────────────────────────────────
  const gapsBySlug: Record<string, LocationGapKey[]> = Object.fromEntries(
    libraries.map((library) => [library.slug, recordGaps(library)])
  )
  const withGaps = libraries.filter((l) => gapsBySlug[l.slug]!.length > 0)
  const missingCount = withGaps.reduce(
    (sum, l) => sum + gapsBySlug[l.slug]!.length,
    0
  )
  const firstWith = (gap: LocationGapKey) =>
    libraries.find((l) => gapsBySlug[l.slug]!.includes(gap))
  const asWizardLibrary = (l: (typeof libraries)[number] | undefined) =>
    l ? { slug: l.slug, name: l.name, place: l.city ?? undefined } : null

  const helpBody = regionHelpBody({
    placeName: name,
    loaded: libraries.map((l) => ({ name: l.name, gaps: gapsBySlug[l.slug]! })),
    gapCounts,
  })

  // The commonest fillable gap here, as a bonus prefill for the propose link.
  const commonestGap = gapCounts
    ? PANEL_GAPS.reduce<{
        key: (typeof PANEL_GAPS)[number]
        count: number
      } | null>((best, key) => {
        const count = gapCounts.gaps[key] ?? 0

        return count > 0 && (!best || count > best.count)
          ? { key, count }
          : best
      }, null)
    : null

  // ── Hero ────────────────────────────────────────────────────────────────────
  const intro =
    region.heroTagline ??
    region.summary ??
    (libraryCount === 0
      ? `No libraries in ${name} are documented yet. Know one? Add it and we’ll review it.`
      : `${libraryCount === 1 ? "One library" : `${formatCount(libraryCount)} libraries`} in ${name} ${libraryCount === 1 ? "is" : "are"} documented so far. Know another? Add it and we’ll review it.`)

  const stats: LocationHeroStat[] = [
    {
      value: formatCount(libraryCount),
      label: `${countNoun(libraryCount, "Library", "Libraries")} documented`,
    },
  ]
  if (libraries.length > 0) {
    const missingTotal = gapCounts
      ? GAP_DEFS.reduce((sum, g) => sum + (gapCounts.gaps[g.key] ?? 0), 0)
      : missingCount
    stats.push({
      value: formatCount(missingTotal),
      label: `${countNoun(missingTotal, "Detail", "Details")} still missing`,
      note:
        !gapCounts && libraryCount > libraries.length
          ? `Across the first ${formatCount(libraries.length)} records`
          : undefined,
    })
  }

  const pins: HeroMapLibraryPin[] = libraries.flatMap((l) => {
    const lat = toCoord(l.location?.lat)
    const lng = toCoord(l.location?.lng)

    return lat !== null && lng !== null
      ? [
          {
            id: l.documentId,
            name: l.name,
            href: `${basePath}/${l.slug}`,
            lat,
            lng,
            libraryType: l.libraryType,
          },
        ]
      : []
  })
  const bounds = {
    ne: region.mapConfig?.boundingBoxNE,
    sw: region.mapConfig?.boundingBoxSW,
  }
  const hasMap = pins.length > 0 || Boolean(bounds.ne && bounds.sw)

  // ── Nearby ──────────────────────────────────────────────────────────────────
  const labels = placeLabels(region.country).region
  const nearby = pickNearby(region.center, region.siblings ?? [])
  const nearbyTitle =
    nearby.mode === "nearby"
      ? `Nearby ${lowerFirst(labels.plural)}`
      : `More in ${countryName ?? "this country"}`

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <LocationHero
          breadcrumbLabels={{
            ...(continentSlug && continentName
              ? { [continentSlug]: continentName }
              : {}),
            ...(countrySlug && countryName
              ? { [countrySlug]: countryName }
              : {}),
            [slug]: name,
          }}
          typeLabel={region.typeLabel?.trim() || labels.name}
          typeIcon="mdi:map-outline"
          title={name}
          intro={intro}
          stats={stats}
          actions={
            <>
              <LocationHeroAction
                primary
                href={`/libraries?region=${encodeURIComponent(slug)}`}
                icon="mdi:magnify"
              >
                Search libraries in {name}
              </LocationHeroAction>
              <LocationHeroAction href="/contribute/index/new" icon="mdi:plus">
                Add a library
              </LocationHeroAction>
            </>
          }
          aside={
            hasMap ? (
              <LocationHeroMap
                label={`Map of libraries documented in ${name}`}
                caption={
                  pins.length > 0
                    ? `${countNoun(pins.length, "Library", "Libraries")} documented in ${name}`
                    : `No libraries documented in ${name} yet.`
                }
                pins={pins}
                bounds={bounds}
              />
            ) : undefined
          }
        />

        <Container>
          <div className="flex flex-col gap-16 pt-14 pb-20">
            <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section id="libraries" className="scroll-mt-24">
                <LocationSectionHeading title={`Libraries in ${name}`} />
                {libraries.length === 0 ? (
                  <p
                    className="mt-0 mb-4 text-[16px]"
                    style={{ color: T.ink.dim }}
                  >
                    No libraries in {name} are documented yet.
                  </p>
                ) : null}
                <RegionLibraryList
                  regionName={name}
                  basePath={basePath}
                  libraries={libraries}
                  gapsBySlug={gapsBySlug}
                  total={libraryCount}
                  findHref={`/libraries?region=${encodeURIComponent(slug)}`}
                />
              </section>

              {nearby.items.length > 0 ? (
                <aside className="lg:sticky lg:top-20">
                  <NearbyRegions
                    title={nearbyTitle}
                    regions={nearby.items}
                    basePath={`/${continentSlug}/${countrySlug}`}
                  />
                </aside>
              ) : null}
            </div>

            <LocationEventsStrip regionSlug={slug} locationLabel={name} />
            <MobilePlaceStops level="region" slug={slug} name={name} />

            {hasQuickLinks ? (
              <section className="scroll-mt-24">
                <LocationSectionHeading title="Quick links" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {region.quickLinks!.map((link, i) => (
                    <QuickLinkCard
                      key={((link as { id?: unknown }).id as string) ?? i}
                      link={link}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <DrivesHere placeName={name} items={drives} />

            <LocationHelpPanel
              name={name}
              body={helpBody}
              actions={locationHelpActions({
                hoursLibrary: asWizardLibrary(firstWith("hours")),
                photoLibrary: asWizardLibrary(firstWith("photo")),
                propose: {
                  placeName: name,
                  href: proposeHref({
                    places: { region: [slug] },
                    ...(commonestGap ? { gaps: [commonestGap.key] } : {}),
                  }),
                },
              })}
            />
          </div>
        </Container>
      </main>
    </div>
  )
}
