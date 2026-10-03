import type React from "react"

import { emptyOpeningTimes, type OpeningTimesData } from "./opening-times.types"

export interface SocialLink {
  platform: string
  url: string
  label: string
}

export interface UploadedImage {
  strapiId: number
  url: string
  isHero: boolean
}

export interface FormData {
  // Step 1 – Identity
  name: string
  shortName: string
  libraryType: string
  operatorType: string
  operationalStatus: string
  officialName: string
  summary: string
  closureReason: string
  // Step 2 – Location
  streetAddress: string
  district: string
  city: string
  country: string
  postalCode: string
  lat: string
  lng: string
  // Step 2 – Hierarchy relations
  continentDocumentId: string
  countryDocumentId: string
  regionDocumentId: string
  areaDocumentId: string
  // Step 2 – A missing region or area the contributor asked for (a
  // `location_request`); approval files the library under it.
  proposedRegionName: string
  proposedAreaName: string
  locationRequestDocumentId: string
  // Step 3 – Visit
  website: string
  planVisitUrl: string
  catalogueUrl: string
  membershipUrl: string
  bookingUrl: string
  virtualTourUrl: string
  virtualTourEmbed: string
  donationUrl: string
  admissionInfo: string
  visitNotes: string
  accessibilityNotes: string
  phone: string
  email: string
  transitInfo: string
  languagesServed: string
  // Step 3 – Opening times
  openingTimes: OpeningTimesData
  // Step 3 – Relations
  services: string[]
  amenities: string[]
  accessibility: string[]
  // Step 3 – Social links
  socialLinks: SocialLink[]
  // Step 4 – Collections
  collectionSize: string
  collectionTypes: string
  specialCollections: string
  classificationSystem: string
  iiifEndpoint: string
  // Step 5 – Building
  foundedYear: string
  openedYear: string
  closedYear: string
  architect: string
  architecturalStyle: string
  buildingInfo: string
  // Step 6 – Imagery
  uploadedImages: UploadedImage[]
  imageCredit: string
  imageNote: string
  // Step 7 – Sources
  evidenceType: string
  evidenceUrl: string
  source: string
  sourceUrl: string
  editSummary: string
  note: string
}

export const EMPTY_FORM: FormData = {
  name: "",
  shortName: "",
  libraryType: "",
  operatorType: "",
  operationalStatus: "",
  officialName: "",
  summary: "",
  closureReason: "",
  streetAddress: "",
  district: "",
  city: "",
  country: "",
  postalCode: "",
  lat: "",
  lng: "",
  continentDocumentId: "",
  countryDocumentId: "",
  regionDocumentId: "",
  areaDocumentId: "",
  proposedRegionName: "",
  proposedAreaName: "",
  locationRequestDocumentId: "",
  website: "",
  planVisitUrl: "",
  catalogueUrl: "",
  membershipUrl: "",
  bookingUrl: "",
  virtualTourUrl: "",
  virtualTourEmbed: "",
  donationUrl: "",
  admissionInfo: "",
  visitNotes: "",
  accessibilityNotes: "",
  phone: "",
  email: "",
  transitInfo: "",
  languagesServed: "",
  openingTimes: emptyOpeningTimes(),
  services: [],
  amenities: [],
  accessibility: [],
  socialLinks: [],
  collectionSize: "",
  collectionTypes: "",
  specialCollections: "",
  classificationSystem: "",
  iiifEndpoint: "",
  foundedYear: "",
  openedYear: "",
  closedYear: "",
  architect: "",
  architecturalStyle: "",
  buildingInfo: "",
  uploadedImages: [],
  imageCredit: "",
  imageNote: "",
  evidenceType: "",
  evidenceUrl: "",
  source: "",
  sourceUrl: "",
  editSummary: "",
  note: "",
}

export type StepProps = {
  f: FormData
  set: (k: keyof FormData, v: string) => void
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}

/** The record the Index editor is improving. */
export interface WizardTarget {
  documentId: string
  slug: string
  name: string
  entityRef: string | null
  /** The signed-in user holds a claim on it: edits go in as `library_edit`. */
  isClaimed: boolean
  /** Record-completeness keys the record already has (see computeCompleteness). */
  completeSections: string[]
}

/** The locale an improve-mode edit loads from and is applied to. */
export interface WizardLocale {
  /** The locale being edited (`?locale=`, else the default). */
  code: string
  /** Strapi's default locale. */
  defaultCode: string
  /** `code`'s language name, e.g. "Czech". */
  languageName: string
  /** No version in `code` exists yet: the form is prefilled from the default. */
  missing?: boolean
}

export interface IndexRecordWizardProps {
  /** `new` adds a library; `improve` edits the given target. */
  mode: "new" | "improve"
  /** Improve mode: the record's current values. New mode: optional prefill. */
  initialData?: Partial<FormData>
  target?: WizardTarget
  /**
   * Improve mode: the locale being edited. A non-default locale is
   * translation mode: only localized fields change and the submission
   * carries `locale`. Omitted means the default locale.
   */
  locale?: WizardLocale
}

/** Form keys that aren't library fields: they describe the submission itself. */
export const SUBMISSION_META_KEYS = [
  "editSummary",
  "evidenceType",
  "evidenceUrl",
  "note",
] as const satisfies readonly (keyof FormData)[]
