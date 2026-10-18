import { libraryTypeName, type LibraryTypeValue } from "./library-types"
// ── Facility checklist ────────────────────────────────────────────────────────
// The eight questions the library page asks readers ("Tap Yes or No"), and the
// taxonomy entry each one stands for. The UI uses it to decide what's
// documented; content-moderation uses it to apply approved answers to the
// library's relations. Change a `name` only together with the CMS entry.

export type FacilityCollection = "accessibility" | "amenity" | "service"

export interface FacilityCheck {
  /** The question as the page shows it. */
  label: string
  /** Which of the library's relations the answer lands in. */
  collection: FacilityCollection
  /** The existing CMS entry's name in that collection. */
  name: string
}

export const FACILITY_CHECKLIST: readonly FacilityCheck[] = [
  {
    label: "Step-free entrance",
    collection: "accessibility",
    name: "Step-free access",
  },
  {
    label: "Accessible toilets",
    collection: "accessibility",
    name: "Accessible toilets",
  },
  { label: "Hearing loop", collection: "accessibility", name: "Hearing loop" },
  {
    label: "Quiet study space",
    collection: "accessibility",
    name: "Quiet room",
  },
  { label: "Wi-Fi", collection: "amenity", name: "Wi-Fi" },
  {
    label: "Public computers",
    collection: "amenity",
    name: "Public computers",
  },
  { label: "Café", collection: "service", name: "Cafes & restaurant" },
  {
    label: "Large-print materials",
    collection: "accessibility",
    name: "Low vision support",
  },
]

export type FacilityAnswer = "yes" | "no"

export const MOBILE_FACILITY_CHECKLIST: readonly FacilityCheck[] = [
  {
    label: "Step-free lift",
    collection: "accessibility",
    name: "Step-free lift",
  },
  { label: "Wi-Fi", collection: "amenity", name: "Wi-Fi" },
  {
    label: "Low-height shelves",
    collection: "accessibility",
    name: "Low-height shelves",
  },
  {
    label: "Wheelchair space inside",
    collection: "accessibility",
    name: "Wheelchair space inside",
  },
  { label: "Hearing loop", collection: "accessibility", name: "Hearing loop" },
]
export function facilityChecklistFor(
  libraryType: LibraryTypeValue | undefined
): readonly FacilityCheck[] {
  if (libraryTypeName(libraryType) === "Digital") return []

  return libraryTypeName(libraryType) === "Mobile"
    ? MOBILE_FACILITY_CHECKLIST
    : FACILITY_CHECKLIST
}
