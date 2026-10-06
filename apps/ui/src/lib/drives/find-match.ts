/**
 * Pure: the one open drive a Find libraries search is "about", if any, so
 * the results page can point to it instead of (or alongside) filtering.
 */
import type { DriveFocus, DriveScope } from "@repo/shared-data"

import type { FindState } from "@/components/index-page/find-helpers"

export type FindDrive = {
  documentId: string
  slug: string
  title: string
  focus: DriveFocus
  scope: DriveScope
}

/**
 * The open drive this search is about, or null. It matches when the state
 * has a place, the drive's focus is gaps sharing at least one of the
 * state's needs, the drive's scope has no explicit library list and names
 * that exact place at that level, and (if the drive draws on a Dataset) the
 * state's source is the same one. The first match in list order wins.
 */
export function matchDriveForFind(
  drives: readonly FindDrive[],
  state: FindState
): FindDrive | null {
  const place = state.place
  if (!place) return null
  const needs: readonly string[] = state.needs

  return (
    drives.find((drive) => {
      if (drive.focus.kind !== "gaps") return false
      if (!drive.focus.gaps.some((gap) => needs.includes(gap))) return false
      if (drive.scope.libraries && drive.scope.libraries.length > 0) {
        return false
      }
      const named = drive.scope.places?.[place.level]
      if (!named || !named.includes(place.slug)) return false
      if (drive.scope.source && drive.scope.source !== state.source) {
        return false
      }

      return true
    }) ?? null
  )
}
