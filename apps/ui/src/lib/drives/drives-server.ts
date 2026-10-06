import "server-only"

import type { Locale } from "next-intl"

import { logNonBlockingError } from "@/lib/logging"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type { APIResponse } from "@/types/api"

import type {
  Drive,
  DriveLeaderboardEntry,
  DriveLeaderboardPeriod,
  DriveStats,
  PublicDriveStatus,
} from "./types"

/** Drive reads are cheap to re-ask for and change often while a Drive is open. */
const REVALIDATE_SECONDS = 60

/** `["drive", "drive:<entry>", ...]` — always the model tag, plus one per entry key. */
function driveTags(...entries: (string | undefined | null)[]): string[] {
  return [
    "drive",
    ...entries.filter((e): e is string => !!e).map((e) => `drive:${e}`),
  ]
}

function driveRequestInit(
  ...entries: (string | undefined | null)[]
): RequestInit {
  return {
    next: { revalidate: REVALIDATE_SECONDS, tags: driveTags(...entries) },
  }
}

function logDriveError(message: string, e: unknown): void {
  logNonBlockingError({
    message,
    error: {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    },
  })
}

/**
 * Drives in `status` (never `draft` — the public list never serves it),
 * pinned first, for the Noticeboard. `GET /api/drives?state=&limit=&locale=`
 * — `state`, never `status`: a global Strapi middleware strips any query
 * key literally named `status` from an unauthenticated request.
 */
export async function fetchDrives(
  status: PublicDriveStatus,
  locale?: string,
  limit?: number
): Promise<Drive[]> {
  try {
    const res = (await PublicStrapiClient.fetchAPI(
      "/drives",
      { state: status, locale: locale as Locale | undefined, limit },
      driveRequestInit()
    )) as APIResponse<Drive[]>

    return res.data ?? []
  } catch (e: unknown) {
    logDriveError(`Error fetching drives (state: ${status})`, e)

    return []
  }
}

/** The one Drive with this slug, or null (not found, or Strapi failed). */
export async function fetchDrive(
  slug: string,
  locale?: string
): Promise<Drive | null> {
  try {
    const res = (await PublicStrapiClient.fetchAPI(
      `/drives/by-slug/${encodeURIComponent(slug)}`,
      { locale: locale as Locale | undefined },
      driveRequestInit(slug)
    )) as APIResponse<Drive | null>

    return res.data ?? null
  } catch (e: unknown) {
    logDriveError(`Error fetching drive '${slug}'`, e)

    return null
  }
}

/** `{ inReview, helpers, credits }` for a Drive's progress card. */
export async function fetchDriveStats(
  documentId: string
): Promise<DriveStats | null> {
  try {
    const res = (await PublicStrapiClient.fetchAPI(
      `/drives/${encodeURIComponent(documentId)}/stats`,
      {},
      driveRequestInit(documentId)
    )) as APIResponse<DriveStats>

    return res.data ?? null
  } catch (e: unknown) {
    logDriveError(`Error fetching stats for drive '${documentId}'`, e)

    return null
  }
}

/**
 * `targetDocumentId`s of this Drive's `pending`/`needs_info` Submissions —
 * the libraries the task panel hides as already being worked on.
 */
export async function fetchDriveInReview(
  documentId: string
): Promise<string[]> {
  try {
    const res = (await PublicStrapiClient.fetchAPI(
      `/drives/${encodeURIComponent(documentId)}/in-review`,
      {},
      driveRequestInit(documentId)
    )) as APIResponse<string[]>

    return res.data ?? []
  } catch (e: unknown) {
    logDriveError(
      `Error fetching in-review libraries for drive '${documentId}'`,
      e
    )

    return []
  }
}

/** A Drive's leaderboard, `period` "week" (last 7 days) or "all". */
export async function fetchDriveLeaderboard(
  documentId: string,
  period: DriveLeaderboardPeriod
): Promise<DriveLeaderboardEntry[]> {
  try {
    const res = (await PublicStrapiClient.fetchAPI(
      `/drives/${encodeURIComponent(documentId)}/leaderboard`,
      { period },
      driveRequestInit(documentId)
    )) as APIResponse<DriveLeaderboardEntry[]>

    return res.data ?? []
  } catch (e: unknown) {
    logDriveError(`Error fetching leaderboard for drive '${documentId}'`, e)

    return []
  }
}
