// Pure helpers for the library Changes section and the article Edit
// history panel. Kept out of the client timeline so the server section can
// import them as values.

import { normalizeMobileTimetable, summarizeTimetable } from "@repo/shared-data"

import type {
  HistoryActor,
  LibraryHistoryBatch,
  LibraryHistoryField,
  LibraryHistoryStats,
} from "@/lib/strapi-api/content/server"

import { LIB_ICONS } from "./LibrarySectionCard"

/**
 * Human names for library fields, worded as the Index editor asks for
 * them. Unknown keys are shown as they are.
 */
export const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  shortName: "Short name",
  officialName: "Official name",
  libraryType: "Library type",
  operatorType: "Operator",
  operationalStatus: "Status",
  closureReason: "Closure reason",
  summary: "Summary",
  description: "Description",
  streetAddress: "Street address",
  district: "District",
  city: "City",
  country: "Country",
  postalCode: "Postcode",
  location: "Map location",
  continent: "Continent",
  region: "Region",
  area: "Area",
  website: "Website",
  planVisitUrl: "Plan your visit link",
  catalogueUrl: "Catalogue link",
  membershipUrl: "Membership link",
  bookingUrl: "Booking link",
  virtualTourUrl: "Virtual tour link",
  virtualTourEmbed: "Virtual tour embed",
  donationUrl: "Donation link",
  admissionInfo: "Admission",
  visitNotes: "Visit notes",
  accessibilityNotes: "Accessibility notes",
  phone: "Phone",
  email: "Email",
  transitInfo: "Getting there",
  languagesServed: "Languages",
  openingTimes: "Opening hours",
  mobileTimetable: "Stops & times",
  homeLibrary: "Home base",
  operatorName: "Run by",
  timetableUrl: "Timetable link",
  timezone: "Time zone",
  services: "Services",
  amenities: "Amenities",
  accessibility: "Accessibility",
  absentFacilities: "Facilities not offered",
  socialLinks: "Social links",
  collectionSize: "Collection size",
  collectionTypes: "Collection types",
  collectionStats: "Collection figures",
  libraryStats: "Library figures",
  specialCollections: "Special collections",
  classificationSystem: "Classification system",
  iiifEndpoint: "IIIF endpoint",
  foundedYear: "Founded",
  openedYear: "Opened",
  closedYear: "Closed",
  architect: "Architect",
  architecturalStyle: "Architectural style",
  buildingInfo: "Building",
  heroImage: "Main photo",
  gallery: "Photos",
  imageCredit: "Photo credit",
  source: "Source",
  sourceUrl: "Source link",
  lastVerifiedAt: "Last checked",
  featured: "Pillar institution",
  wikidataId: "Wikidata ID",
  entityRef: "Reference",
  slug: "Web address",
}

export const fieldLabel = (key: string): string => FIELD_LABELS[key] ?? key

/** "Website, Phone and 2 more": at most `max` names. */
export function fieldNames(
  fields: readonly { field: string }[],
  max = 4
): string {
  const names = fields.map((f) => fieldLabel(f.field))
  if (names.length <= max) {
    if (names.length < 2) return names.join("")

    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
  }

  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`
}

type BatchLike = Pick<LibraryHistoryBatch, "action" | "source" | "actor">

/** The row's verb and icon, by source then action. */
export function batchVerb(b: Pick<BatchLike, "action" | "source">): {
  verb: string
  icon: string
} {
  if (b.source === "import")
    return { verb: "Imported", icon: LIB_ICONS.download }
  switch (b.action) {
    case "create":
      return { verb: "Added", icon: LIB_ICONS.plus }
    case "publish":
      return { verb: "Published", icon: LIB_ICONS.globe }
    case "unpublish":
      return { verb: "Unpublished", icon: LIB_ICONS.shield }
    case "delete":
      return { verb: "Removed", icon: LIB_ICONS.shield }

    default:
      return { verb: "Changed", icon: LIB_ICONS.pencil }
  }
}

/**
 * Who made a change, as shown publicly. A contributor is named only when
 * Strapi sent their username (their activity is public).
 */
export function actorLabel(b: { source?: string; actor: HistoryActor }): {
  text: string
  href?: string
} {
  if (b.source === "import") return { text: "Data import" }
  if (b.source === "staff") return { text: "Library staff" }
  switch (b.actor.kind) {
    case "contributor":
      return b.actor.username
        ? {
            text: `@${b.actor.username}`,
            href: `/profile/${encodeURIComponent(b.actor.username)}`,
          }
        : { text: "A contributor" }
    case "admin":
      return { text: "Libraries Global staff" }
    case "token":
      return { text: "Data import" }

    default:
      return { text: "Libraries Global" }
  }
}

/**
 * What a field can show:
 * - "recorded": a previous → next pair to show;
 * - "unrecorded": both values null, as on backfilled Change Records,
 *   whose values were never recorded;
 * - "withheld": no values sent, because the viewer lacks `library.history`.
 */
export function valueState(
  f: LibraryHistoryField
): "recorded" | "unrecorded" | "withheld" {
  if (!("previous" in f) && !("next" in f)) return "withheld"

  return f.previous == null && f.next == null ? "unrecorded" : "recorded"
}

type ValuePair = LibraryHistoryField

/** True when the field carries a value pair to show. */
export const hasValues = (f: ValuePair) => valueState(f) === "recorded"

/** True when a value pair exists but the viewer wasn't sent it. */
export const isWithheld = (f: ValuePair) => valueState(f) === "withheld"

/** True when the field's values were never recorded. */
export const isUnrecorded = (f: ValuePair) => valueState(f) === "unrecorded"

export const UNRECORDED_NOTE = "Earlier change: values weren't recorded."

/** A value as one short line: "Empty" for nothing, JSON for objects. */
export function formatValue(v: unknown, max = 160): string {
  if (v === null || v === undefined || v === "") return "Empty"
  const timetable = normalizeMobileTimetable(v)
  if (timetable) {
    const summary = summarizeTimetable(timetable)

    return `${summary.stopCount} ${summary.stopCount === 1 ? "stop" : "stops"}, ${summary.visitCount} ${summary.visitCount === 1 ? "visit" : "visits"}, ${summary.cycleWeeks}-week cycle`
  }
  const text =
    typeof v === "string"
      ? v
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : JSON.stringify(v)

  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** "Oct 2025" from "2025-10". */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number)
  if (!y || !m) return month

  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "1 Oct 2026" from an ISO date. */
export function dayName(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** The five most-changed fields, most first, with their labels. */
export function topFields(
  byField: LibraryHistoryStats["byField"],
  n = 5
): { field: string; label: string; count: number }[] {
  return [...byField]
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field))
    .slice(0, n)
    .map((f) => ({ ...f, label: fieldLabel(f.field) }))
}

const PHOTO_FIELDS = new Set(["heroImage", "gallery", "imageCredit"])

export type RowTone = "indigo" | "ok" | "photo" | "import"

/** "1 detail changed", "3 details confirmed". */
export const detailCount = (n: number, verb: string) =>
  `${n} ${n === 1 ? "detail" : "details"} ${verb}`

/**
 * A timeline row's headline, icon, tint and detail count, worded for
 * readers: "Opening hours updated", "Details checked", "Photo added".
 */
export function batchRow(
  b: Pick<LibraryHistoryBatch, "action" | "source" | "fields">
): { title: string; icon: string; tone: RowTone; count: string | null } {
  const keys = b.fields.map((f) => f.field)
  const n = keys.length
  if (b.source === "import")
    return {
      title:
        b.action === "create" ? "Record created" : "Updated from a dataset",
      icon: LIB_ICONS.download,
      tone: "import",
      count: n ? detailCount(n, "imported") : null,
    }
  if (keys.includes("lastVerifiedAt")) {
    const rest = n - 1

    return {
      title: "Details checked",
      icon: LIB_ICONS.shield,
      tone: "ok",
      count: rest > 0 ? detailCount(rest, "confirmed") : null,
    }
  }
  if (n > 0 && keys.every((k) => PHOTO_FIELDS.has(k)))
    return {
      title: "Photo added",
      icon: LIB_ICONS.camera,
      tone: "photo",
      count: null,
    }
  const { verb, icon } = batchVerb(b)
  if (b.action !== "update" || n === 0)
    return {
      title: b.action === "create" ? "Record added" : verb,
      icon,
      tone: "indigo",
      count: n ? detailCount(n, "changed") : null,
    }

  return {
    title: `${fieldNames(b.fields, 2)} updated`,
    icon,
    tone: "indigo",
    count: detailCount(n, "changed"),
  }
}

/** The import that created the record: shown as the "Record created" row. */
export const isImportCreate = (
  b: Pick<LibraryHistoryBatch, "action" | "source">
) => b.source === "import" && b.action === "create"
