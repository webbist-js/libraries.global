import {
  FACILITY_CHECKLIST,
  normalizeOpeningSchedule,
  openingMinute,
  type WidgetLibrary,
} from "@repo/shared-data"

import type { LibraryRecord } from "./widget-records"

function coordinates(location: LibraryRecord["location"]) {
  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng) ||
    Math.abs(location.lat) > 90 ||
    Math.abs(location.lng) > 180
  )
    return null

  return { lat: location.lat, lng: location.lng }
}
function recordedHours(value: unknown) {
  const schedule = normalizeOpeningSchedule(value)

  return schedule.days.flatMap((day) =>
    day.enabled
      ? day.timeframes
          .filter(
            (t) =>
              openingMinute(t.startTime) !== null &&
              openingMinute(t.endTime) !== null
          )
          .map((t) => {
            const staffing =
              {
                self_service: " (self service)",
                appointment: " (appointment)",
              }[t.staffing] ?? ""

            return `${day.day}: ${t.startTime}–${t.endTime}${t.overnight ? " (+1 day)" : ""}${staffing}`
          })
      : []
  )
}
function recordHref(r: LibraryRecord) {
  const slugs = [r.continent?.slug, r.country?.slug, r.region?.slug, r.slug]
  if (slugs.some((slug) => !slug)) return null

  return `/${slugs.map(encodeURIComponent).join("/")}`
}
function recordedFacilities(r: LibraryRecord): WidgetLibrary["facilities"] {
  const absent = Array.isArray(r.absentFacilities) ? r.absentFacilities : []
  const relations = {
    amenity: "amenities",
    service: "services",
    accessibility: "accessibility",
  } as const

  return FACILITY_CHECKLIST.map((c) => {
    const key = relations[c.collection]
    if ((r[key] ?? []).some((v) => v.name === c.name)) return "yes"

    return absent.includes(c.label) ? "no" : "unknown"
  })
}

export function projectWidgetLibrary(
  r: LibraryRecord,
  why: string[]
): WidgetLibrary {
  return {
    documentId: r.documentId,
    name: r.name,
    href: recordHref(r),
    city: r.city ?? null,
    address: [r.streetAddress, r.city, r.postalCode].filter(Boolean).join(", "),
    libraryType: r.libraryType?.name ?? "Other",
    country: r.country?.name ?? null,
    location: coordinates(r.location),
    hours: recordedHours(r.openingTimes),
    operationalStatus: r.operationalStatus ?? "unknown",
    facilities: recordedFacilities(r),
    why,
    locale: r.locale ?? "en",
    updatedAt: r.updatedAt ?? null,
  }
}
