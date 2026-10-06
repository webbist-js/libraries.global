"use client"

import { Notice } from "@/components/ds/Notice"
import type { FindState } from "@/components/index-page/find-helpers"
import { T } from "@/lib/design-tokens"
import { driveHref, plainDriveTitle } from "@/lib/drives/drive-view"
import { type FindDrive, matchDriveForFind } from "@/lib/drives/find-match"
import { Link } from "@/lib/navigation"

/**
 * The open drive this search is about, between the filter chips and the
 * results. A signed-in reader with a place and a fillable need but no match
 * sees "Propose a drive from these results" instead (D2 Task 4's `/community
 * /propose`); until that route exists, a search with no matching drive shows
 * nothing.
 */
export function FindDriveBanner({
  drives,
  state,
}: {
  readonly drives?: readonly FindDrive[]
  readonly state: FindState
}) {
  const match = matchDriveForFind(drives ?? [], state)
  if (!match) return null

  return (
    <div role="status">
      <Notice
        icon="mdi:pin-outline"
        title="There’s a drive for this search"
        tone="info"
      >
        <p className="m-0" style={{ color: T.ink.base }}>
          {plainDriveTitle(match.title)}. Join in and fill these gaps together.
        </p>
        <Link
          href={driveHref(match.slug)}
          className="mt-1 inline-flex self-start font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          Open the drive
        </Link>
      </Notice>
    </div>
  )
}
