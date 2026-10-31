import { toCorrectionRecord } from "@/components/contribute/correction.logic"
import type { DriveView } from "@/lib/drives/drive-view"
import type {
  Drive,
  DriveTask,
  DriveLeaderboardEntry,
} from "@/lib/drives/types"
import { driveProgress } from "@repo/shared-data"

import { libraryFixture } from "../library"
import { weeklyHours } from "../opening-times"

export const driveNow = new Date("2026-01-20T12:00:00Z")
export const drive: Drive = {
  documentId: "example-drive",
  title: "Opening hours for *every library*",
  slug: "opening-hours-for-every-library",
  summary:
    "Help visitors plan their trip by checking regular opening hours against public sources.",
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["northbridge"] } },
  unit: "library",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2026-01-31T23:59:59Z",
  goalPercent: 80,
  status: "open",
  pinned: true,
  featured: true,
  locale: "en",
  createdAt: "2025-12-15T12:00:00Z",
  updatedAt: "2026-01-15T12:00:00Z",
  publishedAt: "2026-01-01T00:00:00Z",
  steps: [
    { text: "Choose a library and check its official website." },
    { text: "Add the regular hours and a public source." },
    { text: "A moderator checks the submitted change." },
  ],
  whereToLook: {
    name: "Library websites",
    url: "https://example.invalid/libraries",
    licenceNote: "Use only published factual opening hours.",
  },
  progressLog: [
    { day: "2026-01-18", total: 50, done: 20, inReview: 3 },
    { day: "2026-01-19", total: 50, done: 28, inReview: 4 },
  ],
}
export const driveView: DriveView = {
  drive,
  href: "/community/drives/opening-hours-for-every-library",
  place: "Northbridge",
  source: "Published library websites",
  progress: driveProgress({ total: 50, todo: 18, inReview: 4 }, 80),
  helpers: 12,
}
export const closedDriveView: DriveView = {
  ...driveView,
  drive: {
    ...drive,
    status: "closed",
    closedAt: "2026-01-20T12:00:00Z",
    closedReason: "goal",
    final: { total: 50, done: 42, closedGaps: 42, helpers: 12, credits: 84 },
  },
}
export const driveTasks: DriveTask[] = [
  {
    documentId: "example-library",
    slug: "northbridge",
    name: "Northbridge Community Library",
    city: "Northbridge",
    region_name: "Example region",
    website: "https://example.invalid/library",
    href: "/europe/example-country/northbridge/northbridge",
    inReview: false,
    needs: ["hours"],
    completeness: 65,
  },
  {
    documentId: "example-archive",
    slug: "northbridge-archive",
    name: "Northbridge Local History Archive",
    href: "/libraries?q=northbridge-archive",
    inReview: true,
    needs: ["hours"],
    completeness: 72,
  },
]
export const driveHelpers: DriveLeaderboardEntry[] = [
  {
    rank: 1,
    credits: 24,
    username: "example-maya",
    displayName: "Maya S.",
    avatarUrl: null,
  },
  {
    rank: 2,
    credits: 18,
    username: "example-ben",
    displayName: "Ben T.",
    avatarUrl: null,
  },
]

export const driveCorrectionRecord = toCorrectionRecord({
  ...libraryFixture,
  openingTimes: null,
})
export const driveCorrectionWithHours = toCorrectionRecord({
  ...libraryFixture,
  openingTimes: weeklyHours,
})
