import { verifyRecordOf } from "@/components/library/verify.logic"
import type { LibraryAreaData } from "@/lib/strapi-api/content/library-area"
import type {
  PopulatedLibraryData,
  LibraryHistoryPage,
  LibraryHistoryStats,
} from "@/lib/strapi-api/content/server"

import { jsonFixture } from "../json"
import { libraryFixture } from "../library"
import { timetable } from "./mobile"
import { geographyResponses } from "./responses"
import { discovery } from "../public/articles"
import { publicResponses, publicServerFixtures } from "../public/server"
import { discussionResponses } from "../workspace/discussions"
import { eventFixtures, eventResponses } from "../workspace/events"

/** Synthetic, expanded record for the library pattern library. */
export const completeLibrary = {
  ...libraryFixture,
  entityRef: "EXAMPLE-LIBRARY",
  city: "Northbridge",
  summary:
    "A community reading room, family activities and a local history collection, all in the heart of Northbridge.",
  country: {
    id: 1,
    documentId: "example-country",
    name: "Example Country",
    slug: "example-country",
  },
  region: {
    id: 1,
    documentId: "example-region",
    name: "Northbridge",
    slug: "northbridge",
  },
  continent: {
    id: 1,
    documentId: "example-continent",
    name: "Europe",
    slug: "europe",
  },
  accessibility: [
    {
      id: 1,
      documentId: "example-step-free",
      name: "Step-free access",
      summary:
        "A level entrance leads from Example Square to the reading room.",
    },
  ],
  amenities: [{ id: 1, documentId: "example-wifi", name: "Wi-Fi" }],
  services: [{ id: 1, documentId: "example-lending", name: "Book lending" }],
  operatorName: "Northbridge Community Trust",
  operatorType: "Community Managed",
  architect: "Example Architects",
  buildingInfo:
    "A converted community hall with a level entrance and quiet reading room.",
  transitInfo:
    "Buses stop at Example Square, a two-minute level walk from the entrance.",
  nearestStation: "Northbridge Central",
  admissionInfo:
    "Free to visit. Join with proof of your name and address to borrow books.",
  visitNotes: [
    {
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "The quieter reading room is on the ground floor.",
        },
      ],
    },
  ],
  catalogueUrl: "https://example.invalid/catalogue",
  membershipUrl: "https://example.invalid/join",
  foundedYear: "1926",
  hasActiveFeed: true,
} satisfies PopulatedLibraryData

export const mobileLibrary = {
  ...completeLibrary,
  documentId: "example-mobile",
  name: "Northbridge Mobile Library",
  slug: "northbridge-mobile",
  libraryType: { id: 2, documentId: "example-mobile-type", name: "Mobile" },
  mobileTimetable: jsonFixture(timetable),
} satisfies PopulatedLibraryData
export const digitalLibrary = {
  ...completeLibrary,
  name: "Northbridge Digital Library",
  libraryType: { id: 3, documentId: "example-digital-type", name: "Digital" },
} satisfies PopulatedLibraryData
export const wizardLibrary = {
  documentId: completeLibrary.documentId,
  slug: completeLibrary.slug,
  name: completeLibrary.name,
  place: "Northbridge",
}
export const verifyLibrary = {
  ...wizardLibrary,
  ...verifyRecordOf(completeLibrary),
}
export const libraryPath =
  "/europe/example-country/northbridge/northbridge-community-library"
export const libraryArea: LibraryAreaData = {
  neighbours: [
    {
      id: "example-archive",
      name: "Riverside Local History Archive",
      href: "/europe/example-country/northbridge/riverside",
      libraryType: "Archive",
      city: "Northbridge",
      lat: 51.515,
      lng: -0.08,
      km: 2.2,
    },
  ],
  regionTotal: 12,
  withinRadius: 3,
  sundays: { open: 4, total: 12, includesThis: false },
}
export const libraryHistory: LibraryHistoryPage = {
  data: [
    {
      batchId: "example-hours",
      changedAt: "2026-10-24T12:00:00Z",
      action: "update",
      source: "submission",
      actor: { kind: "contributor", username: "example-reader" },
      fields: [
        {
          field: "openingTimes",
          summary:
            "Saturday opening hours checked against the library website.",
        },
      ],
      submissionDocumentId: "example-submission",
    },
    {
      batchId: "example-address",
      changedAt: "2026-09-15T10:00:00Z",
      action: "update",
      source: "admin",
      actor: { kind: "admin", username: null },
      fields: [
        {
          field: "streetAddress",
          previous: "Example Square",
          next: "1 Example Square, Northbridge",
        },
      ],
      submissionDocumentId: null,
    },
    {
      batchId: "example-created",
      changedAt: "2026-01-01T12:00:00Z",
      action: "create",
      source: "import",
      actor: { kind: "system", username: null },
      fields: [
        { field: "name", next: completeLibrary.name },
        { field: "website", next: completeLibrary.website },
      ],
      submissionDocumentId: null,
    },
  ],
  meta: { page: 1, pageSize: 20, total: 3 },
}
export const emptyHistory: LibraryHistoryPage = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0 },
}
export const libraryHistoryStats: LibraryHistoryStats = {
  months: Array.from({ length: 24 }, (_, i) => ({
    month: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    batches: i % 4,
    fields: (i % 4) * 2,
    contributors: i % 3,
  })),
  byField: [
    { field: "openingTimes", count: 4 },
    { field: "website", count: 2 },
  ],
  byAction: [{ action: "update", count: 6 }],
  verificationEvents: ["2026-10"],
}
export const libraryResponses = {
  ...publicResponses,
  ...geographyResponses,
  ...eventResponses,
  "POST /api/submissions": {
    body: { data: { documentId: "example-verification", status: "pending" } },
    status: 201,
  },
  ...discussionResponses,
  "GET /api/discussions/session": {
    body: { signedIn: false, canModerate: false, viewerId: null },
  },
  "GET /api/profile/me/follow": { body: { following: false } },
  "POST /api/profile/me/follow": { body: { following: true } },
  "GET /api/public-proxy/api/events/library/EXAMPLE-LIBRARY": {
    body: eventFixtures,
  },
  "GET /api/libraries/example-library/history": { body: libraryHistory },
  "GET /api/drives/for-library/example-library": {
    body: {
      data: {
        documentId: "example-drive",
        slug: "opening-hours-for-every-library",
        title: "Opening hours for every library",
        focus: { kind: "gaps", gaps: ["hours"] },
        unit: "library",
        done: 24,
        total: 40,
      },
    },
  },
  "GET /api/profile/me/affiliations": { body: { affiliations: [] } },
}
export const libraryServerFixtures = {
  ...publicServerFixtures,
  "cms.public.fetchAPI": discovery,
}
