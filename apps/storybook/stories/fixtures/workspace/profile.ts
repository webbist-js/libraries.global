import type { Workspace } from "@/components/profile/profile-workspace.types"
import type { UserProfile, Topic } from "@/lib/types/profile"

import { readerSession } from "../../../.storybook/FixtureSession"

export { readerSession }
export const profile: UserProfile = {
  id: 1,
  username: "example-reader",
  firstName: "Maya",
  lastName: "Example",
  bio: "A reader who loves community libraries and local history.",
  city: "Northbridge",
  country: "GB",
  timezone: "Europe/London",
  profileBackground: "violet",
  profileVisibility: "public",
  isVerifiedLibrarian: false,
  contributorRole: "reader",
  notifPrefs: {
    weeklyDigest: false,
    editsReviewed: true,
    newFollowers: true,
    editorialMessages: true,
    soundOn: false,
    marketing: false,
  },
  followedLibraries: [
    {
      id: 1,
      documentId: "example-library",
      name: "Northbridge Library",
      slug: "northbridge",
      libraryType: "Public",
      heroImageUrl: "/library-placeholder.svg",
      path: "/libraries/northbridge",
    },
  ],
  followedProfiles: [
    {
      username: "example-ben",
      displayName: "Ben T.",
      bio: "Exploring local history collections.",
    },
  ],
  points: 124,
  pointsThisMonth: 24,
  streak: 3,
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-15T12:00:00Z",
}
export const profileWorkspace: Workspace = {
  actorId: readerSession.user.id,
  asOf: Date.parse("2026-01-15T12:00:00Z"),
  profile,
  avatarUrl: null,
  imageUploadsEnabled: false,
  followedDrives: [],
  affiliations: [],
}
export const topics: Topic[] = [
  {
    documentId: "example-reading",
    name: "Reading groups",
    slug: "reading-groups",
    status: "approved",
  },
  {
    documentId: "example-history",
    name: "Local history",
    slug: "local-history",
    status: "approved",
  },
  {
    documentId: "example-access",
    name: "Accessible libraries",
    slug: "accessible-libraries",
    status: "approved",
  },
]
export const profileResponses = {
  "GET /api/topics": { body: { data: topics } },
  "POST /api/profile/me/suggest-topic": { body: { ok: true } },
  "GET /api/profile/check-username": { body: { available: true } },
  "GET /api/profile/me/follow-user": { body: { following: false } },
  "POST /api/profile/me/follow-user": { body: { ok: true } },
  "PUT /api/profile/me": { body: { ok: true } },
  "PUT /api/profile/me/newsletter": { body: { ok: true } },
  "PUT /api/profile/me/notifications": { body: { ok: true } },
  "POST /api/notifications": { body: { ok: true } },
  "GET /api/libraries/search": {
    body: {
      hits: [
        {
          id: 1,
          name: "Northbridge Library",
          city: "Northbridge",
          country_name: "Example country",
          entityRef: "EXAMPLE-LIBRARY",
          website: "https://example.invalid",
          libraryType: "Public",
        },
      ],
    },
  },
  "POST /api/profile/me/claim-library": {
    body: { status: "pending", method: "moderator_review" },
  },
  "GET /api/profile/workspace": { body: profileWorkspace },
  "GET /api/profile/example-reader/contributions": {
    body: {
      data: [
        {
          documentId: "example-correction",
          submissionType: "library_edit",
          status: "approved",
          editSummary: "Updated Northbridge Library opening hours",
          targetEntityType: "library",
          targetLabel: "Northbridge Library",
          updatedAt: "2026-01-15T12:00:00Z",
          reviewedAt: "2026-01-15T12:00:00Z",
          createdAt: "2026-01-15T12:00:00Z",
          targetSlug: "northbridge",
        },
      ],
    },
  },
  "GET /api/profile/example-reader/badges": { body: { data: [] } },
  "GET /api/profile/example-reader/drives": { body: { data: [] } },
  "GET /api/profile/me/sessions": { body: { data: [] } },
  "GET /api/profile/me/connections": { body: { data: [] } },
  "GET /api/profile/me/newsletter": {
    body: { subscribed: false, suppressed: false },
  },
  "GET /api/notifications": {
    body: {
      data: [
        {
          documentId: "example-notification",
          title: "Your library correction was approved",
          body: "The updated opening hours are now visible on the library record.",
          kind: "submission_approved",
          href: "/libraries/northbridge",
          readAt: null,
          createdAt: "2026-01-15T12:00:00Z",
        },
      ],
      unread: 1,
      soundOn: false,
    },
  },
}
