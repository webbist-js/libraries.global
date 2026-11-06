"use client"

import { createContext, useContext, useEffect } from "react"

import type { StaffLibrarySummary } from "@/lib/access-server"

export type StaffWorkspaceRecord = StaffLibrarySummary & {
  readonly canSeeTeam: boolean
  readonly suggestions: number
}

/** A child loader can resolve staff records beyond the session's capped summary. */
export const StaffWorkspaceRecordContext = createContext<
  ((record: StaffWorkspaceRecord) => () => void) | null
>(null)

export function useStaffWorkspaceRecord(record: StaffWorkspaceRecord) {
  const register = useContext(StaffWorkspaceRecordContext)
  const {
    id,
    slug,
    name,
    libraryType,
    role,
    canGoLive,
    canSeeTeam,
    suggestions,
  } = record
  useEffect(
    () =>
      register?.({
        id,
        slug,
        name,
        libraryType,
        role,
        canGoLive,
        canSeeTeam,
        suggestions,
      }),
    [
      register,
      id,
      slug,
      name,
      libraryType,
      role,
      canGoLive,
      canSeeTeam,
      suggestions,
    ]
  )
}
