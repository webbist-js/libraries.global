/**
 * The Drive type as `api::drive.drive`'s public routes return it
 * (`toPublic` in `apps/strapi/src/api/drive/services/drive.ts`): every
 * field a public reader may see, never `createdByUserId` or
 * `proposalSubmissionDocumentId`.
 */
import type {
  DriveFocus,
  DriveScope,
  DriveStatus,
  DriveUnit,
} from "@repo/shared-data"

export type { DriveFocus, DriveScope, DriveStatus, DriveUnit }

/** One line of a Drive's "How to help" list (`drive.step` component). */
export interface DriveStep {
  id?: number
  text: string
}

/** Where to look: an optional named, linked, licensed source. */
export interface DriveSource {
  id?: number
  name?: string | null
  url?: string | null
  licenceNote?: string | null
}

/** A Drive's progress when it opened: `openOneDrive`'s snapshot. */
export interface DriveBaseline {
  total: number
  done: number
  at: string
  centroid?: { lat: number; lng: number } | null
}

/** One day's entry in a Drive's `progressLog` (at most 90, one per day). */
export interface DriveProgressLogEntry {
  day: string
  total: number
  done: number
  inReview: number
}

/** A closed Drive's final tally: `closeOneDrive`'s summary. */
export interface DriveFinal {
  total: number
  done: number
  closedGaps: number
  helpers: number
  credits: number
}

export interface Drive {
  documentId: string
  title: string
  slug: string
  summary: string
  focus: DriveFocus
  scope: DriveScope
  unit: DriveUnit
  startsAt: string
  endsAt: string
  goalPercent: number
  status: DriveStatus
  closedReason?: "goal" | "ended" | "cancelled" | null
  pinned: boolean
  pinOrder?: number | null
  featured: boolean
  openedAt?: string | null
  closedAt?: string | null
  baseline?: DriveBaseline | null
  progressLog?: DriveProgressLogEntry[] | null
  final?: DriveFinal | null
  locale: string
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  steps: DriveStep[]
  whereToLook?: DriveSource | null
  /** The slug of the Journal article telling a finished drive's story. */
  storySlug?: string | null
}

/** `GET /drives/:documentId/stats` — a Drive's progress-card counts. */
export interface DriveStats {
  inReview: number
  helpers: number
  credits: number
}

/** One row of `GET /drives/:documentId/leaderboard` — never a `baUserId`. */
export interface DriveLeaderboardEntry {
  rank: number
  credits: number
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type DriveLeaderboardPeriod = "week" | "all"

/** The lifecycle states the public list and detail routes ever serve. */
export type PublicDriveStatus = "open" | "scheduled" | "closed"

/**
 * One library in a Drive's open task list (`GET /api/drives/[slug]/tasks`):
 * a page of the Meilisearch `library` index, with the library page's path
 * (`href`, null when a parent slug is missing), and `distanceKm` when the
 * list was asked for "near" a point.
 */
export interface DriveTask {
  documentId: string
  slug: string
  name: string
  city?: string | null
  district?: string | null
  area_name?: string | null
  region_name?: string | null
  website?: string | null
  _geo?: { lat: number; lng: number } | null
  href: string | null
  inReview: boolean
  distanceKm?: number
  /** Someone else currently holds this library in this drive. */
  heldByOther?: boolean
  /** When the current hold on this library (the reader's own) expires. */
  heldUntil?: string | null
}
