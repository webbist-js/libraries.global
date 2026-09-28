import { Icon } from "@iconify/react"

import {
  hubHref,
  PHOTO_LICENCE,
  type WizardLibrary,
} from "@/components/contribute/wizard.logic"
import { Breadcrumb, type BreadcrumbItem } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import type { FacilityState } from "@/components/library/facility-rows"
import {
  type LatLng,
  type OpeningTimesValue,
  summariseHours,
} from "@/components/library/library-page.helpers"
import { OpenCorrectionLink } from "@/components/library/LibraryCorrection"
import { LibraryHeroActions } from "@/components/library/LibraryHeroActions"
import {
  type LibraryMapNeighbour,
  LibraryHeroMap,
} from "@/components/library/LibraryHeroMap"
import {
  FactCard,
  LibraryOpenStatusBadge,
  LibraryTodayFact,
} from "@/components/library/LibraryHoursTable"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

/**
 * The library page's hero band (the atlas pages' LocationHero pattern):
 * breadcrumb, badges, serif name, place, actions and quick facts on the
 * left; the MapLibre map with this library and its neighbours on the right.
 */
export function LibraryHero({
  library,
  crumbs,
  wizardLibrary,
  coords,
  neighbours,
  stepFree,
  hasPhoto,
}: {
  readonly library: PopulatedLibraryData
  readonly crumbs: BreadcrumbItem[]
  readonly wizardLibrary: WizardLibrary
  readonly coords: LatLng | null
  readonly neighbours: LibraryMapNeighbour[]
  /** yes: documented; no: confirmed absent; unknown: not documented. */
  readonly stepFree: FacilityState
  readonly hasPhoto: boolean
}) {
  const rec = library as unknown as Record<string, unknown>
  const tint = tintForLibraryType(library.libraryType)
  const typeLabel = library.libraryType
    ? library.libraryType === "Other"
      ? "Library"
      : `${library.libraryType} library`
    : null
  const openingTimes =
    (library.openingTimes as OpeningTimesValue | null) ?? null
  const timezone = (rec.timezone as string | null) ?? null
  const shortName = (rec.shortName as string | null) ?? null
  const hours = summariseHours(openingTimes)
  const locationLine = [
    library.city,
    library.region?.name,
    library.country?.name,
  ]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(", ")

  const directionsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : null
  const atlasHref =
    coords && library.documentId
      ? `/map?${new URLSearchParams({
          lib: library.documentId,
          v: `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)},14.00`,
        }).toString()}`
      : "/map"

  return (
    <section
      id="overview"
      className="border-b"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <Container className="pt-6 pb-8 sm:pt-8 sm:pb-10">
        <Breadcrumb items={crumbs} />

        <div className="mt-5 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {typeLabel ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  <LibIcon d={LIB_ICONS.building} size={14} />
                  {typeLabel}
                </span>
              ) : null}
              <LibraryOpenStatusBadge
                openingTimes={openingTimes}
                timezone={timezone}
              />
              <span
                className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold"
                style={{ color: T.ink.base }}
              >
                <span style={{ color: T.ink.dim }}>
                  <LibIcon d={LIB_ICONS.people} size={15} />
                </span>
                Community maintained
              </span>
            </div>

            <h1
              className="m-0 text-[clamp(40px,5.6vw,68px)] leading-[1.02] tracking-[-0.02em] text-balance"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              {library.name}
            </h1>

            {locationLine || shortName ? (
              <p
                className="mt-3 mb-0 flex flex-wrap items-center gap-1.5 text-[15.5px]"
                style={{ color: T.ink.dim }}
              >
                <LibIcon d={LIB_ICONS.pin} size={16} />
                {shortName ? (
                  <>
                    Also known as{" "}
                    <span style={{ color: T.ink.base }}>{shortName}</span>
                    {locationLine ? " · " : ""}
                  </>
                ) : null}
                {locationLine}
              </p>
            ) : null}

            <div className="mt-5">
              <LibraryHeroActions
                libraryDocumentId={library.documentId ?? ""}
                libraryName={library.name ?? ""}
                librarySlug={library.slug ?? ""}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 xl:grid-cols-3">
              <LibraryTodayFact
                openingTimes={openingTimes}
                timezone={timezone}
              />
              {hours ? (
                <>
                  <FactCard
                    icon="mdi:weather-night"
                    label={hours.lateLabel}
                    value={hours.lateValue}
                  />
                  <FactCard
                    icon="mdi:white-balance-sunny"
                    label="Sundays"
                    value={hours.sunday}
                  />
                </>
              ) : null}
              <FactCard
                icon="mdi:wheelchair-accessibility"
                label="Step-free access"
                value={
                  stepFree === "yes"
                    ? "Yes"
                    : stepFree === "no"
                      ? "No"
                      : "Not documented yet"
                }
              />
            </div>

            <p
              className="mt-4 mb-0 flex flex-wrap items-center gap-1.5 text-[13.5px]"
              style={{ color: T.ink.dim }}
            >
              <LibIcon d={LIB_ICONS.photos} size={15} />
              {hasPhoto ? "Have a better photo?" : "No photos yet."}{" "}
              <GlobalLink
                href={hubHref("photo", wizardLibrary)}
                className="font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Add one you took
              </GlobalLink>{" "}
              ({PHOTO_LICENCE}).
            </p>
          </div>

          <div className="min-w-0">
            {coords && directionsUrl ? (
              <LibraryHeroMap
                atlasHref={atlasHref}
                directionsUrl={directionsUrl}
                lat={coords.lat}
                lng={coords.lng}
                name={library.name ?? ""}
                neighbours={neighbours}
              />
            ) : (
              <div
                className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-3xl px-8 text-center"
                style={{
                  background: T.bg.deep,
                  border: `1px dashed ${T.border.hi}`,
                }}
              >
                <Icon
                  aria-hidden="true"
                  height={30}
                  icon="mdi:map-marker-question-outline"
                  style={{ color: T.ink.low }}
                  width={30}
                />
                <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                  This record has no map location yet.
                </p>
                <OpenCorrectionLink
                  category="Address or location"
                  className="text-[14px] font-semibold underline underline-offset-[3px]"
                >
                  Add the location
                </OpenCorrectionLink>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}
