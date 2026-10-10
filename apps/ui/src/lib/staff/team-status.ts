import type { TeamSummary } from "./types"

/** Current coverage on an authenticated request, independent of a stale session. */
export function isActiveTeam(
  team: Pick<TeamSummary, "status" | "expiresAt">,
  now = Date.now()
): boolean {
  return (
    team.status === "active" &&
    (!team.expiresAt || Date.parse(team.expiresAt) > now)
  )
}
