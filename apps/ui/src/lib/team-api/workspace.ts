import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { preferredTeams, sessionTeamsOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { apiDashboard } from "@/lib/team-api/dashboard"
import { requireApiTeam } from "@/lib/team-api/team"
import type { ApiDashboard } from "@/lib/team-api/types"

/** Public docs never depend on private reads succeeding. Recheck Team access server-side. */
export const apiWorkspaceAccess = cache(async () => {
  const session = await getSessionSSR(await headers())
  const teams = preferredTeams(sessionTeamsOf(session?.user))
  let data: ApiDashboard | null = null
  let unavailable = false
  const conflict = teams.length > 1
  if (session?.user && teams.length === 1) {
    try {
      const team = await requireApiTeam(teams[0]!.id, session.user)
      data = await apiDashboard(authDbPool, team)
    } catch {
      unavailable = true
    }
  }

  return {
    signedIn: Boolean(session?.user),
    scope: contributionAccountScope(session?.user),
    data,
    unavailable,
    conflict,
    showUsageWarning: !session?.user.dismissedPrompts?.includes(
      "api-playground-usage"
    ),
  }
})
