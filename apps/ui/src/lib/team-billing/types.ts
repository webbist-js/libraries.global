import type { PaidTeamMembership } from "@repo/access"

export type { PaidTeamMembership as TeamMembership } from "@repo/access"

export const TEAM_TERMS_VERSION = "1.2"
export {
  TEAM_MIN_SEATS as MIN_TEAM_SEATS,
  TEAM_MAX_SEATS as MAX_TEAM_SEATS,
} from "@repo/access"

export type TeamBillingDashboard = {
  teamId: string
  name: string
  organiser: boolean
  source: string
  active: boolean
  used: number
  seats: number
  purchasing: boolean
  discounted: boolean
  mode: "sandbox" | "live"
  pending: boolean
  synced: boolean
  membership: PaidTeamMembership | null
}
