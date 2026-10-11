import { normalizeMobileTimetable } from "@repo/shared-data"

import type { LibraryForEditing } from "@/lib/strapi-api/content/server"

import { blocksToPlainText } from "./wizard.changes"
import type { FormData } from "./wizard.types"

const str = (v: unknown) => (typeof v === "string" ? v : "")

/** The record's current values in the wizard's shape. */
export function prefillLibrary(lib: LibraryForEditing): Partial<FormData> {
  const location = lib.location as { lat?: unknown; lng?: unknown } | null
  const openingTimes = lib.openingTimes as { days?: unknown } | null
  const ids = (rel: unknown) =>
    Array.isArray(rel)
      ? rel
          .map((r) => (r as { documentId?: string })?.documentId)
          .filter((id): id is string => !!id)
      : []

  return {
    name: str(lib.name),
    shortName: str(lib.shortName),
    summary: str(lib.summary),
    libraryType: str(lib.libraryType),
    mobileTimetable: normalizeMobileTimetable(lib.mobileTimetable),
    homeLibrary:
      (lib.homeLibrary as { documentId?: string } | null)?.documentId ?? "",
    operatorName: str(lib.operatorName),
    timetableUrl: str(lib.timetableUrl),
    operatorType: str(lib.operatorType),
    operationalStatus: str(lib.operationalStatus),
    closureReason: str(lib.closureReason),
    streetAddress: str(lib.streetAddress),
    district: str(lib.district),
    city: str(lib.city),
    country: str(lib.country?.name),
    postalCode: str(lib.postalCode),
    lat: location?.lat != null ? String(location.lat) : "",
    lng: location?.lng != null ? String(location.lng) : "",
    continentDocumentId: lib.continent?.documentId ?? "",
    countryDocumentId: lib.country?.documentId ?? "",
    regionDocumentId: lib.region?.documentId ?? "",
    areaDocumentId: lib.area?.documentId ?? "",
    website: str(lib.website),
    planVisitUrl: str(lib.planVisitUrl),
    catalogueUrl: str(lib.catalogueUrl),
    membershipUrl: str(lib.membershipUrl),
    bookingUrl: str(lib.bookingUrl),
    virtualTourUrl: str(lib.virtualTourUrl),
    virtualTourEmbed: str(lib.virtualTourEmbed),
    donationUrl: str(lib.donationUrl),
    admissionInfo: str(lib.admissionInfo),
    visitNotes: blocksToPlainText(lib.visitNotes),
    accessibilityNotes: blocksToPlainText(lib.accessibilityNotes),
    phone: str(lib.phone),
    email: str(lib.email),
    transitInfo: str(lib.transitInfo),
    languagesServed: str(lib.languagesServed),
    ...(openingTimes && Array.isArray(openingTimes.days)
      ? { openingTimes: openingTimes as FormData["openingTimes"] }
      : {}),
    services: ids(lib.services),
    amenities: ids(lib.amenities),
    accessibility: ids(lib.accessibility),
    socialLinks: (lib.socialLinks ?? []).map((s) => ({
      platform: s.platform,
      url: s.url,
      label: s.label ?? "",
    })),
    classificationSystem: str(lib.classificationSystem),
    iiifEndpoint: str(lib.iiifEndpoint),
    foundedYear: str(lib.foundedYear),
    openedYear: str(lib.openedYear),
    closedYear: str(lib.closedYear),
    architect: str(lib.architect),
    buildingInfo: str(lib.buildingInfo),
    sourceRecords: [],
  }
}
