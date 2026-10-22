import "server-only"

import type { Pool } from "pg"

import { billingStripe } from "@/lib/billing/provider"
import type { TeamDetail } from "@/lib/staff/types"

import { apiPrice } from "./billing"
import { apiAccessActive, apiConfig } from "./config"
import { apiMembership, apiUsage } from "./store"
import { teamActive } from "./team"
import type { ApiDashboard } from "./types"

export async function apiDashboard(
  pool: Pool,
  team: TeamDetail,
  keyOffset = 0
): Promise<ApiDashboard> {
  const config = apiConfig()
  const [membership, usage, attempts, price] = await Promise.all([
    apiMembership(pool, team.documentId),
    apiUsage(pool, team.documentId, keyOffset),
    pool.query(
      "select 1 from team_api_attempts where team_id=$1 and state in ('preparing','open') limit 1",
      [team.documentId]
    ),
    config.purchasing
      ? apiPrice(billingStripe())
          .then((p) => ({ unitAmount: p.unit_amount!, currency: p.currency }))
          .catch(() => null)
      : null,
  ])
  const limits = apiAccessActive(membership)
    ? membership!.limits
    : config.limits

  return {
    teamId: team.documentId,
    teamName: team.name,
    organiser: team.viewerRole === "organiser",
    teamActive: teamActive(team),
    membership,
    active: teamActive(team) && apiAccessActive(membership),
    purchasing: config.purchasing && Boolean(price),
    price,
    limits,
    ...usage,
    pendingPayment: Boolean(
      attempts.rowCount ||
      (membership &&
        !membership.paidThrough &&
        ["active", "incomplete", "past_due"].includes(membership.status))
    ),
    warnings: [
      ...(usage.usage.requests >= limits.requests * 0.8
        ? ["requests" as const]
        : []),
      ...(usage.usage.bytes >= limits.bytes * 0.8 ? ["bytes" as const] : []),
    ],
  }
}
