import { libraryTypeName } from "@repo/shared-data"

import { facilityRows } from "@/components/library/facility-rows"
import {
  type OpeningTimesValue,
  recordChecklist,
  toLatLng,
} from "@/components/library/library-page.helpers"
import type { LibraryAreaData } from "@/lib/strapi-api/content/library-area"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

type Lib = PopulatedLibraryData
const asRecord = (library: Lib) => library as unknown as Record<string, unknown>

/** The same eight core details used by the index completeness score. */
export function libraryChecklist(library: Lib) {
  const rec = asRecord(library)

  return recordChecklist({
    libraryType: libraryTypeName(library.libraryType),
    mobileTimetable: rec.mobileTimetable,
    homeLibrary: rec.homeLibrary,
    heroImage: library.heroImage,
    openingTimes: library.openingTimes as OpeningTimesValue | null,
    streetAddress: library.streetAddress,
    location: library.location,
    accessibility: library.accessibility as unknown[] | null,
    services: library.services as unknown[] | null,
    amenities: library.amenities as unknown[] | null,
    absentFacilities: rec.absentFacilities,
    summary: library.summary,
    description: library.description,
    collectionStats: rec.collectionStats as unknown[] | null,
    foundedYear: rec.foundedYear as string | null,
    openedYear: rec.openedYear as string | null,
    website: rec.website as string | null,
    phone: rec.phone as string | null,
    email: rec.email as string | null,
  })
}

const hasText = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim())

function hasDescription(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((block) => {
      if (!block || typeof block !== "object") return false
      const entry = block as Record<string, unknown>
      const image = entry.image as { url?: unknown } | undefined

      return (
        hasText(entry.text) ||
        (entry.type === "image" && hasText(image?.url)) ||
        hasDescription(entry.children)
      )
    })
  )
}

export function hasLibraryAbout(library: Lib): boolean {
  const rec = asRecord(library)

  return (
    hasText(library.summary) ||
    hasDescription(library.description) ||
    (Array.isArray(rec.collectionStats) &&
      rec.collectionStats.some((stat) => hasText(stat?.value))) ||
    (Array.isArray(rec.libraryStats) &&
      rec.libraryStats.some(
        (stat) => hasText(stat?.value) && hasText(stat?.label)
      )) ||
    [
      rec.buildingInfo,
      rec.architect,
      rec.foundedYear,
      rec.openedYear,
      rec.closedYear,
    ].some(hasText)
  )
}

/** Derive presentation from recorded data; never store a sparse/full flag. */
export function libraryPresentation(library: Lib, area: LibraryAreaData) {
  const rec = asRecord(library)
  const type = libraryTypeName(library.libraryType)
  const mobile = type === "Mobile"
  const digital = type === "Digital"
  const rows = facilityRows(library)
  const accessRows = rows.filter((row) => row.category !== "service")
  const hasAccess = accessRows.length > 0 || Boolean(rec.accessibilityNotes)
  const hasServices =
    rows.some((row) => row.category === "service" && row.state !== "unknown") ||
    Boolean(library.languagesServed?.length || library.classificationSystem)
  const hasAbout = hasLibraryAbout(library)
  const hasEvents = Boolean(rec.hasActiveFeed)
  const hasNearby =
    !mobile &&
    !digital &&
    (area.neighbours.length > 0 || Boolean(area.neighboursUnavailable))
  const country = library.country?.slug ?? ""
  const hasReach =
    !mobile &&
    !digital &&
    Boolean(toLatLng(library.location)) &&
    [
      "england",
      "wales",
      "scotland",
      "northern-ireland",
      "united-kingdom",
    ].includes(country)
  const missing = [
    ...(!hasAbout ? ["about" as const] : []),
    ...(!hasEvents ? ["events" as const] : []),
    ...(!mobile && !digital && !rec.transitInfo && !rec.nearestStation
      ? ["transport" as const]
      : []),
    ...(!mobile && !rec.admissionInfo ? ["admission" as const] : []),
    ...(!mobile && !digital && !hasNearby ? ["nearby" as const] : []),
  ]

  return {
    mobile,
    digital,
    hasAccess,
    hasServices,
    hasAbout,
    hasEvents,
    hasNearby,
    hasReach,
    missing,
    unanswered: accessRows.filter((row) => row.state === "unknown").length,
    checklist: libraryChecklist(library),
  }
}
