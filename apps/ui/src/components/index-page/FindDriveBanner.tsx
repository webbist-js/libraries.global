"use client"

import { PANEL_GAPS } from "@repo/shared-data"

import { Notice } from "@/components/ds/Notice"
import type { FindState } from "@/components/index-page/find-helpers"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { driveHref, plainDriveTitle } from "@/lib/drives/drive-view"
import { type FindDrive, matchDriveForFind } from "@/lib/drives/find-match"
import { prefillFromFindState, proposeHref } from "@/lib/drives/propose-link"
import { Link } from "@/lib/navigation"

/**
 * The open drive this search is about, between the filter chips and the
 * results. With no match, a signed-in viewer who can propose a drive
 * (`submit.driveProposal`), with a place and at least one fillable need, sees
 * "Propose a drive from these results" linking to `/community/propose`
 * instead.
 */
export function FindDriveBanner({
  drives,
  state,
}: {
  readonly drives?: readonly FindDrive[]
  readonly state: FindState
}) {
  const { has, ready } = useCapabilities()
  const match = matchDriveForFind(drives ?? [], state)

  if (match) {
    return (
      <div role="status">
        <Notice
          icon="mdi:pin-outline"
          title="There’s a drive for this search"
          tone="info"
        >
          <p className="m-0" style={{ color: T.ink.base }}>
            {plainDriveTitle(match.title)}. Join in and fill these gaps
            together.
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

  const canPropose =
    ready &&
    has("submit.driveProposal") &&
    Boolean(state.place) &&
    state.needs.some((need) => (PANEL_GAPS as readonly string[]).includes(need))
  if (!canPropose) return null

  return (
    <Link
      href={proposeHref(prefillFromFindState(state))}
      className="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors hover:bg-(--t-bg-surface)"
      style={{ borderColor: T.border.hi, color: T.accent.primary }}
    >
      Propose a drive from these results
    </Link>
  )
}
