import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getLocale } from "next-intl/server"

import { Badge, PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamApiDashboard } from "@/components/staff/TeamApiDashboard"
import { TeamMembershipConflict } from "@/components/staff/TeamMembershipConflict"
import { preferredTeams, sessionTeamsOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { BillingError } from "@/lib/billing/config"
import { teamWorkspaceHref } from "@/lib/staff/paths"
import { apiDashboard } from "@/lib/team-api/dashboard"
import { requireApiTeam } from "@/lib/team-api/team"

export default async function TeamApiPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ team?: string; payment?: string }>
}) {
  const [session, query] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
  ])
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=%2Fstaff%2Fteams%2Fapi")
  if (query.team) {
    const locale = await getLocale()
    redirect(teamWorkspaceHref("/api", locale, query))
  }
  const teams = preferredTeams(sessionTeamsOf(session.user))
  if (teams.length > 1) return <TeamMembershipConflict />
  const chosen = teams[0]
  if (!chosen) redirect("/staff/teams")
  let data = null
  try {
    const team = await requireApiTeam(chosen.id, session.user)
    data = await apiDashboard(authDbPool, team)
  } catch (error) {
    if (error instanceof BillingError && error.status === 404) notFound()
  }

  return (
    <>
      <PageHero
        staff
        breadcrumb={[
          { label: "Staff area", href: "/staff" },
          { label: chosen.name, href: "/staff/teams" },
          { label: "API access" },
        ]}
        eyebrow="Team API add-on"
        title="API access"
        plainTitle
        chips={
          data ? (
            <Badge
              label={
                data.active ? "API add-on active" : "API add-on not active"
              }
              color={data.active ? "ok" : "warn"}
              icon="mdi:code-tags"
            />
          ) : undefined
        }
        tabs={<StaffAreaTabs active="api" teamId={chosen.id} />}
        lead="Connect applications to public Library data. Every key shares your Team’s monthly request and response-data allowance."
      />
      <Container className="py-10">
        {data ? (
          <TeamApiDashboard
            key={data.teamId}
            initial={data}
            confirming={query.payment === "confirming"}
          />
        ) : (
          <StaffLoadError what="API access" status={503} />
        )}
      </Container>
    </>
  )
}
