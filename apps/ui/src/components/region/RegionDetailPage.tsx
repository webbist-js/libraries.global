import { Icon } from "@iconify/react"
import { type GapKey, PANEL_GAPS } from "@repo/shared-data"
import { cookies } from "next/headers"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { DrivesHere } from "@/components/drives/DrivesHere"
import { Container } from "@/components/elementary/Container"
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { FeaturedLibraryCard } from "@/components/library/FeaturedLibraryCard"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
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
import { LocationChildBrowser } from "@/components/location/LocationChildBrowser"
import {
  locationHelpActions,
  LocationHelpPanel,
} from "@/components/location/LocationHelpPanel"
import {
  LocationHero,
  type LocationHeroStat,
  LocationSectionHeading,
} from "@/components/location/LocationHero"
import {
  type HeroMapLibraryPin,
  LocationHeroMap,
} from "@/components/location/LocationHeroMap"
import { placeSummary } from "@/components/location/place-summary"
import { PlaceFeaturedContribution } from "@/components/location/PlaceFeaturedContribution"
import {
  PlaceInsights,
  type PlaceGapInsight,
} from "@/components/location/PlaceInsights"
import { MobilePlaceStops } from "@/components/mobile/MobilePlaceStops"
import {
  NearbyRegions,
  RegionLibraryList,
} from "@/components/region/RegionLibraryList"
import { scalableAtlasEnabled, ATLAS_COHORT_COOKIE } from "@/lib/atlas-rollout"
import { placeAddHref } from "@/lib/contribution-place"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"
import { proposeHref } from "@/lib/drives/propose-link"
import { regionNationalLibraries } from "@/lib/find-search"
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

export async function RegionDetailPage({
  region,
  locale,
  slug,
  countrySlug,
  continentSlug,
  gapCounts,
  drives = [],
  gapRows = null,
  untranslatedLocale = null,
}: {
  region: PopulatedRegionData
  locale: Locale
  readonly untranslatedLocale?: string | null
  slug: string
  countrySlug: string
  continentSlug: string
  gapCounts: {
    total: number
    gaps: Partial<Record<GapKey, number>>
  } | null
  gapRows?: readonly PlaceGapInsight[] | null
  drives?: readonly { view: DriveView; here: number }[] | null
}) {
  const tUi = await getUiTranslations("ui")

  const name = region.name ?? ""
  const place = { continent: continentSlug, country: countrySlug, region: slug }
  const addHref = placeAddHref(place)
  const countsAvailable = region.statistics?.libraries !== false
  const childrenAvailable = region.statistics?.children !== false
  const countryName = region.country?.name
  const continentName =
    region.continent?.name ?? region.country?.continent?.name
  const basePath = `/${continentSlug}/${countrySlug}/${slug}`
  const libraryCount = region.libraryCount ?? 0
  const libraries = region.libraries ?? []
  const nationalSelection =
    (libraryCount > 0 || !countsAvailable) &&
    (!region.libraryTypeCounts ||
      region.statistics?.types === false ||
      region.libraryTypeCounts?.some(
        (row) => row.type === "National" && row.count > 0
      ))
      ? await regionNationalLibraries(slug, locale)
      : null
  const nationalLibraries = nationalSelection?.libraries ?? []
  const hasQuickLinks = Boolean(region.quickLinks?.length)

  // ── Record gaps ─────────────────────────────────────────────────────────────
  const gapsBySlug: Record<string, LocationGapKey[]> = Object.fromEntries(
    libraries.map((library) => [library.slug, recordGaps(library)])
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
  const intro = placeSummary({
    name,
    total: libraryCount,
    children: region.areas ?? [],
    noun: placeLabels(region.country, region).area,
    available: countsAvailable,
    childrenAvailable,
  })

  const stats: LocationHeroStat[] = [
    {
      value: countsAvailable ? formatCount(libraryCount) : "Unavailable",
      label: `${countNoun(libraryCount, "Library", "Libraries")} documented`,
    },
  ]
  const areaLabels = placeLabels(region.country, region).area
  if (childrenAvailable && region.areas?.length)
    stats.push({
      value: `${region.areas.filter((area) => (area.libraryCount ?? 0) > 0).length} of ${region.areas.length}`,
      label: `${areaLabels.plural} with documented libraries`,
    })
  if (gapCounts && commonestGap)
    stats.push({
      value: formatCount(commonestGap.count),
      label: `Records needing ${GAP_DEFS.find((gap) => gap.key === commonestGap.key)?.label.toLowerCase() ?? commonestGap.key}`,
      note: `Of ${formatCount(gapCounts.total)} documented records`,
    })

  const pins: HeroMapLibraryPin[] = libraries
    .filter((library) => library.libraryType !== "Digital")
    .flatMap((l) => {
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
  const scalableMap = scalableAtlasEnabled(
    (await cookies()).get(ATLAS_COHORT_COOKIE)?.value
  )
  const hasMap =
    scalableMap || pins.length > 0 || Boolean(bounds.ne && bounds.sw)

  // ── Nearby ──────────────────────────────────────────────────────────────────
  const labels = placeLabels(region.country).region
  const nearby = pickNearby(region.center, region.siblings ?? [])
  const nearbyTitle =
    nearby.mode === "nearby"
      ? `Nearby ${lowerFirst(labels.plural)}`
      : `More in ${countryName ?? "this country"}`

  const areaFirst = libraryCount >= 60
  const areaBrowser = region.areas?.length ? (
    <LocationChildBrowser
      id="areas"
      title={areaLabels.plural}
      description={`Explore ${lowerFirst(areaLabels.plural)} in ${name}. Counts describe this index, not all libraries that exist.`}
      noun={{
        singular: areaLabels.singular,
        plural: lowerFirst(areaLabels.plural),
      }}
      totalCount={Math.max(
        0,
        libraryCount -
          (region.libraryTypeCounts?.find((row) => row.type === "Digital")
            ?.count ?? 0)
      )}
      shareLabel={`Share of ${name}’s documented place-based libraries`}
      countsAvailable={childrenAvailable}
      addHref={addHref}
      items={region.areas.map((area) => ({
        slug: area.slug,
        name: area.name,
        count: area.libraryCount ?? 0,
        shareCount: area.placeBasedCount ?? area.libraryCount ?? 0,
        href: `/libraries?area=${encodeURIComponent(area.slug)}`,
        addHref: placeAddHref({ ...place, area: area.slug }),
      }))}
    />
  ) : null

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main id="main" className="relative z-10 flex-1">
        <LocationHero
          untranslatedLocale={untranslatedLocale}
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
          contribution={
            <PlaceFeaturedContribution
              gaps={gapRows}
              level="region"
              slug={slug}
              name={name}
              place={place}
              childPlaces={region.areas ?? []}
              siblingPlaces={region.siblings ?? []}
              childNoun={areaLabels.singular}
              childrenAvailable={childrenAvailable}
              drives={drives}
              task={
                commonestGap
                  ? {
                      gapKey: commonestGap.key,
                      title:
                        commonestGap.key === "hours"
                          ? `Help people plan a visit to a library in ${name}.`
                          : `Help fill a gap in ${name}`,
                      description: `${formatCount(commonestGap.count)} records need ${GAP_DEFS.find((gap) => gap.key === commonestGap.key)?.label.toLowerCase() ?? commonestGap.key}. Choose a library you know and add a source.`,
                      label: "Find a library to improve",
                      href: `/libraries?region=${encodeURIComponent(slug)}&needs=${commonestGap.key}`,
                    }
                  : null
              }
            />
          }
          intro={intro}
          stats={stats}
          search={{ level: "region", slug }}
          aside={
            hasMap ? (
              <LocationHeroMap
                atlasPlace={
                  scalableMap
                    ? { level: "region", id: region.documentId }
                    : undefined
                }
                label={`Map of libraries documented in ${name}`}
                caption={
                  pins.length > 0
                    ? `${countNoun(pins.length, tUi("library"), tUi("libraries"))} documented in ${name}`
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
            {countsAvailable ? (
              <PlaceInsights
                gapRows={gapRows}
                name={name}
                level="region"
                slug={slug}
                total={libraryCount}
                types={region.libraryTypeCounts}
                typesAvailable={region.statistics?.types !== false}
                childrenAvailable={
                  childrenAvailable &&
                  (region.areas ?? []).every(
                    (child) => child.placeBasedCount !== undefined
                  )
                }
                childPlaces={(region.areas ?? []).map((child) => ({
                  slug: child.slug,
                  name: child.name,
                  count: child.placeBasedCount ?? 0,
                }))}
              />
            ) : null}
            {areaFirst ? areaBrowser : null}

            {nationalLibraries.length > 0 ? (
              <section aria-label={`National libraries in ${name}`}>
                <LocationSectionHeading
                  title={`National libraries in ${name}`}
                  description="Explore the national libraries documented in this region."
                />
                <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
                  {nationalLibraries.map((library, index) => (
                    <li key={library.documentId}>
                      <FeaturedLibraryCard
                        name={library.name}
                        libraryType={library.libraryType}
                        city={library.city}
                        countryName={countryName}
                        imageUrl={library.heroImage?.url}
                        openingTimes={
                          library.openingTimes as OpeningTimesValue | null
                        }
                        href={`${basePath}/${library.slug}`}
                        index={index}
                      />
                    </li>
                  ))}
                </ul>
                {(nationalSelection?.total ?? 0) > nationalLibraries.length ? (
                  <GlobalLink
                    href={`/libraries?region=${encodeURIComponent(slug)}&type=National`}
                    className="mt-5 inline-flex min-h-11 items-center font-semibold underline underline-offset-3"
                    style={{ color: T.accent.primary }}
                  >
                    See all {formatCount(nationalSelection?.total ?? 0)}{" "}
                    national libraries in {name}
                  </GlobalLink>
                ) : null}
              </section>
            ) : null}

            <div>
              <section id="libraries" className="scroll-mt-24">
                <LocationSectionHeading title={`Libraries in ${name}`} />
                {libraries.length === 0 ? (
                  <p
                    className="mt-0 mb-4 text-[16px]"
                    style={{ color: T.ink.dim }}
                  >
                    {countsAvailable &&
                    region.statistics?.preview !== false &&
                    libraryCount === 0
                      ? `No libraries in ${name} are documented yet.`
                      : "Library results are temporarily unavailable. Use Find libraries to try again."}
                  </p>
                ) : null}
                <RegionLibraryList
                  addHref={addHref}
                  regionName={name}
                  basePath={basePath}
                  libraries={libraries}
                  featuredIds={nationalLibraries.map(
                    (library) => library.documentId
                  )}
                  typeCounts={Object.fromEntries(
                    (region.libraryTypeCounts ?? []).map((row) => [
                      row.type,
                      row.count,
                    ])
                  )}
                  nearby={
                    nearby.items.length > 0 ? (
                      <NearbyRegions
                        title={nearbyTitle}
                        regions={nearby.items}
                        basePath={`/${continentSlug}/${countrySlug}`}
                      />
                    ) : null
                  }
                  gapsBySlug={gapsBySlug}
                  gapCounts={gapCounts?.gaps}
                  total={libraryCount}
                  countsAvailable={countsAvailable}
                  findHref={`/libraries?region=${encodeURIComponent(slug)}`}
                />
              </section>
            </div>

            {!areaFirst ? areaBrowser : null}

            <LocationEventsStrip regionSlug={slug} locationLabel={name} />
            <MobilePlaceStops level="region" slug={slug} name={name} />

            {hasQuickLinks ? (
              <section className="scroll-mt-24">
                <LocationSectionHeading title={tUi("quick_links")} />
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

            <DrivesHere
              placeName={name}
              items={drives}
              addHref={addHref}
              proposeHref={proposeHref({ places: { region: [slug] } })}
            />

            <LocationHelpPanel
              addHref={addHref}
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
