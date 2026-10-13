import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamApiDashboard } from "@/components/staff/TeamApiDashboard"
import { sessionTeamsOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { BillingError } from "@/lib/billing/config"
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
  if (!session?.user) redirect("/auth/signin?callbackUrl=%2Fstaff%2Fteam%2Fapi")
  const teams = sessionTeamsOf(session.user)
  const chosen = query.team
    ? teams.find((team) => team.id === query.team)
    : (teams.find((team) => team.role === "organiser") ?? teams[0])
  if (!chosen) notFound()
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
        compact
        breadcrumb={[
          { label: "Staff area", href: "/staff" },
          { label: "Your Team", href: `/staff/team?team=${chosen.id}` },
          { label: "API access" },
        ]}
        eyebrow="Team API add-on"
        title="API access"
        lead="Connect your own applications to public Library search and records. Manage keys and see how much your Team uses."
      />
      <Container className="py-10">
        {data ? (
          <TeamApiDashboard
            key={data.teamId}
            initial={data}
            teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            confirming={query.payment === "confirming"}
          />
        ) : (
          <StaffLoadError what="API access" status={503} />
        )}
      </Container>
    </>
  )
}
