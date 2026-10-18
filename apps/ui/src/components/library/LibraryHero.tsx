import { Icon } from "@iconify/react"
import {
  libraryTypeName,
  normalizeMobileTimetable,
  type LibraryNotice,
  type TimetableNotice,
} from "@repo/shared-data"

import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import { Breadcrumb, type BreadcrumbItem } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import { facilityRows } from "@/components/library/facility-rows"
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
import {
  FactCard,
  LibraryOpenStatusBadge,
} from "@/components/library/LibraryHoursTable"
import { LIB_ICONS, LibIcon } from "@/components/library/LibrarySectionCard"
import { sectionCheckedAt } from "@/components/library/verify.logic"
import { summariseWeek } from "@/components/location/location-page.helpers"
import { MobileHeroFacts } from "@/components/mobile/MobileHeroFacts"
import { MobileTodayStrip } from "@/components/mobile/MobileTodayStrip"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { clampDescription } from "@/lib/seo/metadata"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

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
  untranslatedLocale = null,
  contribution,
}: {
  readonly library: PopulatedLibraryData
  readonly crumbs: BreadcrumbItem[]
  readonly wizardLibrary: WizardLibrary
  readonly coords: LatLng | null
  readonly neighbours: LibraryMapNeighbour[]
  readonly contribution?: React.ReactNode
  readonly hasPhoto: boolean
  /** Set when this is the default-locale stand-in for a missing translation. */
  readonly untranslatedLocale?: string | null
}) {
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
  const accessRows = facilityRows(library).filter(
    (row) => row.category !== "service"
  )
  const accessRecorded = accessRows.filter(
    (row) => row.state !== "unknown"
  ).length
  const checked = sectionCheckedAt(library, "hours")
  const facts = [
    ...(!digital
      ? [
          {
            icon: "mdi:clock-outline",
            label: "Opening hours",
            value: summariseWeek(openingTimes) ?? "Hours not recorded yet",
            note: checked
              ? "Checked " +
                new Date(checked).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Not yet checked · see the full week",
            href: "#visit",
          },
        ]
      : []),
    ...(!digital
      ? [
          {
            icon: "mdi:train",
            label: "Getting there",
            value:
              typeof rec.nearestStation === "string" && rec.nearestStation
                ? clampDescription(rec.nearestStation, 120)!
                : "Nearest station not recorded",
            href: "#visit",
          },
        ]
      : []),
    ...(!digital
      ? [
          {
            icon: "mdi:human",
            label: "Accessibility & facilities",
            value:
              accessRecorded + " of " + accessRows.length + " details recorded",
            note:
              accessRows.length > accessRecorded
                ? "Help answer what’s missing"
                : "See recorded access information",
            href: "#access",
          },
        ]
      : []),
    {
      icon: "mdi:card-account-details-outline",
      label: digital ? "Online access" : "Admission",
      value:
        typeof rec.admissionInfo === "string" && rec.admissionInfo
          ? clampDescription(
              rec.admissionInfo.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ??
                rec.admissionInfo,
              110
            )!
          : "Admission details not recorded",
      href: "#visit",
    },
  ]

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
              <span
                className="inline-flex min-h-7 items-center rounded-full border bg-white px-2.5 text-[12px] font-semibold"
                style={{ borderColor: T.border.line, color: T.ink.dim }}
              >
                {rec.hasStaff
                  ? "Maintained by library staff"
                  : "Community maintained"}
              </span>
            </div>

            <h1
              className="m-0 max-w-[12ch] text-[clamp(44px,5.8vw,80px)] leading-[.95] tracking-[-0.03em] text-balance"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
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
                  prominent
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
                catalogueUrl={
                  typeof rec.catalogueUrl === "string" ? rec.catalogueUrl : null
                }
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
            ) : (
              <div className="mt-5 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
                {facts.map((fact) => (
                  <a
                    key={fact.label}
                    href={fact.href}
                    className="block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <FactCard {...fact} className="h-full" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <LibraryHeroMedia
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
                )
              }
            />
          </div>
        </div>
        {contribution ? <div className="mt-8">{contribution}</div> : null}
      </Container>
    </section>
  )
}
