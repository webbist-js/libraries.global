import "server-only"

import type { FollowedDrive } from "@/lib/types/profile"

import type { DriveView } from "./drive-view"
import { loadDriveViews } from "./drive-view-server"
import { fetchDrive } from "./drives-server"
import { FOLLOWED_DRIVES_SHOWN, orderFollowedDrives } from "./followed-drives"
import type { Drive } from "./types"

/**
 * The drives a profile follows, as cards for its Following tab: each read
 * by slug (the public read never serves a draft, and a drive that's gone
 * is dropped), at most `FOLLOWED_DRIVES_SHOWN`, open and scheduled first.
 */
export async function loadFollowedDriveViews(
  followed: readonly FollowedDrive[],
  locale: string
): Promise<DriveView[]> {
  const slugs = [...new Set(followed.map((d) => d.slug).filter(Boolean))]
  if (slugs.length === 0) return []

  const drives = await Promise.all(
    slugs
      .slice(0, FOLLOWED_DRIVES_SHOWN)
      .map((slug) => fetchDrive(slug, locale))
  )

  return loadDriveViews(
    orderFollowedDrives(drives.filter((d): d is Drive => d !== null)),
    locale
  )
}
