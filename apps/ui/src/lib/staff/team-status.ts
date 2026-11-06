import type { TeamSummary } from "./types"

/**
 * Whether a staff workspace is open. Workspaces are free and never lapse
 * for payment; only a legacy row the server still reports as `lapsed`
 * reads as closed. Membership never grants library authority either way.
 */
export function isActiveTeam(team: Pick<TeamSummary, "status">): boolean {
  return team.status !== "lapsed"
}
