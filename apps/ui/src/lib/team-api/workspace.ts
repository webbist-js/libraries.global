import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { preferredTeams, sessionTeamsOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { apiDashboard, apiProspect } from "@/lib/team-api/dashboard"
import { requireApiTeam } from "@/lib/team-api/team"
import type { ApiDashboard, ApiProspect } from "@/lib/team-api/types"

/**
 * Public docs never depend on private reads succeeding. Organisation access
 * is rechecked server-side. A signed-in account without an organisation gets
 * the individual API offer (`prospect`); checkout creates its organisation.
 */
export const apiWorkspaceAccess = cache(async () => {
  const session = await getSessionSSR(await headers())
  const teams = preferredTeams(sessionTeamsOf(session?.user))
  let data: ApiDashboard | null = null
  let prospect: ApiProspect | null = null
  let unavailable = false
  const conflict = teams.length > 1
  if (session?.user && teams.length === 1) {
    try {
      const team = await requireApiTeam(teams[0]!.id, session.user)
      data = await apiDashboard(authDbPool, team)
    } catch {
      unavailable = true
    }
  } else if (session?.user && teams.length === 0) {
    try {
      prospect = await apiProspect(Boolean(session.user.emailVerified))
    } catch {
      unavailable = true
    }
  }

  return {
    signedIn: Boolean(session?.user),
    scope: contributionAccountScope(session?.user),
    data,
    prospect,
    accountName: session?.user.name?.trim() || session?.user.email || "",
    unavailable,
    conflict,
    showUsageWarning: !session?.user.dismissedPrompts?.includes(
      "api-playground-usage"
    ),
  }
})
