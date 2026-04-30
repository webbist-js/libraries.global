import type React from "react"

import { emptyOpeningTimes, type OpeningTimesData } from "./OpeningTimesEditor"

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

export interface AddLibraryWizardProps {
  sessionUser: { id: string; name: string | null; email: string }
  /** Edit mode: pre-populate the form with an existing library's data */
  initialData?: Partial<FormData>
  /** documentId of the library being edited (sets submissionType = library_edit) */
  targetDocumentId?: string
  /** slug of the library being edited */
  targetSlug?: string
}
