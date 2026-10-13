import "server-only"

import { BillingError } from "@/lib/billing/config"
import { isDocumentIdParam } from "@/lib/bridge-params"
import type { TeamDetail } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

export function teamActive(team: Pick<TeamDetail, "status" | "expiresAt">) {
  return (
    team.status === "active" &&
    (!team.expiresAt || Date.parse(team.expiresAt) > Date.now())
  )
}

export async function requireApiTeam(
  teamId: string,
  user: { id: string; email: string; name?: string | null },
  mutation = false,
  requireActive = mutation
) {
  if (!isDocumentIdParam(teamId)) throw new BillingError("team_not_found", 404)
  const result = await fetchStaff<TeamDetail>(user, `teams/${teamId}`, "access")
  if ([403, 404].includes(result.status))
    throw new BillingError("team_not_found", 404)
  if (result.status !== 200 || !result.body)
    throw new BillingError("team_service_unavailable")
  const team = result.body
  if (mutation && team.viewerRole !== "organiser")
    throw new BillingError("organiser_required", 403)
  if (requireActive && !teamActive(team))
    throw new BillingError("team_inactive", 403)

  return team
}

export async function checkApiTeamActive(teamId: string) {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret || !isDocumentIdParam(teamId))
    throw new BillingError("team_service_unavailable")
  const response = await fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/api/teams/${teamId}/status`,
    {
      headers: { "X-Service-Secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }
  )
  if (response.status === 404) throw new BillingError("team_inactive", 403)
  if (!response.ok) throw new BillingError("team_service_unavailable")
  const body = await response.json()
  if (body.active !== true) throw new BillingError("team_inactive", 403)
}
