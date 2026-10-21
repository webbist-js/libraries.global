import "server-only"

import type { Pool } from "pg"

import type { TeamDetail } from "@/lib/staff/types"
import { teamActive } from "@/lib/team-api/team"

import { teamBillingConfig } from "./config"
import type { TeamBillingDashboard, TeamMembership } from "./types"

export async function teamBillingDashboard(
  pool: Pool,
  team: TeamDetail
): Promise<TeamBillingDashboard> {
  const config = teamBillingConfig()
  const row = (
    await pool.query<{
      snapshot: TeamMembership
      revision: string
      synced_revision: string
    }>(
      "select m.snapshot,m.revision,m.synced_revision from team_billing_memberships m join team_billing_accounts a on a.id=m.account_id and a.current_subscription_id=m.subscription_id where a.team_id=$1 and a.mode=$2",
      [team.documentId, config.mode]
    )
  ).rows[0]
  const pending = await pool.query(
    "select 1 from team_billing_attempts t join team_billing_accounts a on a.id=t.account_id where a.team_id=$1 and a.mode=$2 and t.state in ('preparing','open') limit 1",
    [team.documentId, config.mode]
  )

  return {
    teamId: team.documentId,
    name: team.name,
    organiser: team.viewerRole === "organiser",
    source: team.source ?? "admin",
    active: teamActive(team),
    used: team.used,
    seats: team.seats,
    purchasing: config.purchasing,
    discounted: team.publicServiceApproved === true,
    mode: config.mode,
    pending: Boolean(pending.rowCount),
    synced: !row || row.revision === row.synced_revision,
    membership: row?.snapshot ?? null,
  }
}
