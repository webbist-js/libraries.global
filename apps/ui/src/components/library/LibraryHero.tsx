import { Icon } from "@iconify/react"
import {
  libraryTypeName,
  normalizeMobileTimetable,
  type LibraryNotice,
  type TimetableNotice,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"

import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import { Container } from "@/components/elementary/Container"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import type {
  LatLng,
  OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { OpenCorrectionLink } from "@/components/library/LibraryCorrection"
import { LibraryHeroActions } from "@/components/library/LibraryHeroActions"
import {
  type LibraryMapNeighbour,
  LibraryHeroMap,
} from "@/components/library/LibraryHeroMap"
import { LibraryHeroMedia } from "@/components/library/LibraryHeroMedia"
import { LibraryOpenStatusBadge } from "@/components/library/LibraryHoursTable"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { MobileHeroFacts } from "@/components/mobile/MobileHeroFacts"
import { MobileTodayStrip } from "@/components/mobile/MobileTodayStrip"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { clampDescription } from "@/lib/seo/metadata"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

/**
 * Contained library identity and existing media/actions. The record shell
 * owns breadcrumbs, supporting tasks and the separate metric strip.
 */
export function LibraryHero({
  library,
  wizardLibrary,
  coords,
  neighbours,
  untranslatedLocale = null,
}: {
  readonly library: PopulatedLibraryData
  readonly wizardLibrary: WizardLibrary
  readonly coords: LatLng | null
  readonly neighbours: LibraryMapNeighbour[]
  /** Set when this is the default-locale stand-in for a missing translation. */
  readonly untranslatedLocale?: string | null
}) {
  const t = useTranslations("libraryPage")
  const rec = library as unknown as Record<string, unknown>
  const mobile = libraryTypeName(library.libraryType) === "Mobile"
  const timetable = normalizeMobileTimetable(rec.mobileTimetable)
  const tint = tintForLibraryType(libraryTypeName(library.libraryType))
  const typeLabel = libraryTypeName(library.libraryType)
    ? libraryTypeName(library.libraryType) === "Other"
      ? "Library"
      : `${libraryTypeName(library.libraryType)} library`
    : null
  const openingTimes =
    (library.openingTimes as OpeningTimesValue | null) ?? null
  const timezone = (rec.timezone as string | null) ?? null
  const shortName = (rec.shortName as string | null) ?? null
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

  const digital = libraryTypeName(library.libraryType) === "Digital"

  return (
    <section id="overview" className="record-hero library-record-hero">
      <Container className="record-hero-inner">
        <div className="library-hero-layout record-hero-layout">
          <div className="min-w-0">
            <div className="record-hero-badges flex flex-wrap items-center gap-2">
              {typeLabel ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  <LibIcon d={LIB_ICONS.building} size={14} />
                  {typeLabel}
                </span>
              ) : null}
              <span
                className="inline-flex min-h-7 items-center rounded-full border bg-(--t-bg-deep) px-2.5 text-xs font-semibold"
                style={{ borderColor: T.border.line, color: T.ink.dim }}
              >
                {rec.hasStaff
                  ? "Maintained by library staff"
                  : "Community maintained"}
              </span>
            </div>

            <h1
              tabIndex={-1}
              className="type-page-compact m-0 text-balance"
              style={{
                color: T.ink.base,
              }}
            >
              {library.name}
            </h1>
            {untranslatedLocale ? (
              <NotTranslatedNote locale={untranslatedLocale} />
            ) : null}

            {locationLine || shortName ? (
              <p
                className="mt-3 mb-0 flex flex-wrap items-center gap-1.5 text-base"
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

            {library.summary ? (
              <p
                className="mt-4 max-w-[60ch] text-base leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                {clampDescription(
                  library.summary.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ??
                    library.summary,
                  160
                )}
              </p>
            ) : null}
            {!mobile && libraryTypeName(library.libraryType) !== "Digital" ? (
              <div className="mt-4">
                <LibraryOpenStatusBadge
                  openingTimes={openingTimes}
                  timezone={timezone}
                  operationalStatus={library.operationalStatus}
                  notices={rec.notices as LibraryNotice[] | undefined}
                />
              </div>
            ) : null}
            <div className="mt-5">
              <LibraryHeroActions
                directionsUrl={
                  libraryTypeName(library.libraryType) === "Digital" || mobile
                    ? null
                    : directionsUrl
                }
                website={library.website}
                libraryDocumentId={library.documentId ?? ""}
                libraryName={library.name ?? ""}
                librarySlug={library.slug ?? ""}
              />
            </div>

            {mobile ? (
              <div className="mt-5">
                {timetable ? (
                  <MobileTodayStrip
                    id={library.documentId}
                    tt={timetable}
                    notices={(rec.notices as TimetableNotice[]) ?? []}
                    timezone={timezone ?? "UTC"}
                    status={library.operationalStatus}
                  />
                ) : null}
                <MobileHeroFacts
                  status={library.operationalStatus}
                  tt={timetable}
                  notices={(rec.notices as TimetableNotice[]) ?? []}
                  timezone={timezone ?? "UTC"}
                />
                <p className="mt-3 text-sm" style={{ color: T.ink.dim }}>
                  {typeof rec.operatorName === "string" && rec.operatorName
                    ? `Run by ${rec.operatorName}`
                    : ""}
                  {library.homeLibrary?.name
                    ? ` · Based at ${library.homeLibrary.name}`
                    : ""}
                </p>
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <LibraryHeroMedia
              atlasHref={!mobile && !digital && coords ? atlasHref : null}
              photoAction={
                !library.heroImage?.url && !library.gallery?.length ? (
                  <OpenCorrectionLink
                    category="Photo"
                    className="inline-flex min-h-11 items-center rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold shadow-sm"
                  >
                    {t("addPhoto")}
                  </OpenCorrectionLink>
                ) : undefined
              }
              photo={formatStrapiMediaUrl(library.heroImage?.url) ?? null}
              name={
                library.heroImage?.alternativeText || library.name || "Library"
              }
              caption={library.heroImage?.caption}
              gallery={(
                (library.gallery ?? []) as {
                  url?: string
                  alternativeText?: string | null
                  caption?: string | null
                }[]
              ).flatMap((media) => {
                const url = formatStrapiMediaUrl(media.url)

                return url
                  ? [
                      {
                        url,
                        alt: media.alternativeText,
                        caption: media.caption,
                      },
                    ]
                  : []
              })}
              tourUrl={
                typeof rec.virtualTourUrl === "string"
                  ? rec.virtualTourUrl
                  : null
              }
              mapLabel={
                mobile ? "Route and stops" : digital ? "Online access" : "Map"
              }
              map={
                mobile ? (
                  <a
                    href="#stops"
                    className="flex min-h-60 items-center justify-center rounded-3xl border p-8 text-center"
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    Explore the route and stops in the timetable below
                  </a>
                ) : libraryTypeName(library.libraryType) === "Digital" ? (
                  <div
                    className="flex min-h-60 items-center justify-center rounded-3xl border p-8"
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    Online library · use the official access links
                  </div>
                ) : coords && directionsUrl ? (
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
                    <p className="m-0 text-base" style={{ color: T.ink.dim }}>
                      This record has no map location yet.
                    </p>
                    <OpenCorrectionLink
                      category="Address or location"
                      className="text-sm font-semibold underline underline-offset-[3px]"
                    >
                      Add the location
                    </OpenCorrectionLink>
                  </div>
                )
              }
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
