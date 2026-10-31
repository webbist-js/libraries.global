import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { isActiveTeam } from "@/lib/staff/team-status"
import type { TeamSummary } from "@/lib/staff/types"

/** Visibility follows actual workspace membership, independently of plan or editorial role. */
export function hasStaffWorkspace(user: unknown): boolean {
  return staffLibrariesOf(user).length > 0 || sessionTeamsOf(user).length > 0
}

/** Matches the staff creation route; payment alone never grants record access. */
export function canAddStaffLibrary(
  libraryCount: number,
  teams: readonly TeamSummary[]
): boolean {
  return (
    libraryCount > 0 ||
    teams.some((team) => team.verified && isActiveTeam(team))
  )
}
