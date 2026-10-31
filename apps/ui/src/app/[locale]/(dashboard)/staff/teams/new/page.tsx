import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { TeamSignup } from "@/components/staff/TeamSignup"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import type { NetworkWorkspace } from "@/lib/networks/types"
import { fetchStaff } from "@/lib/staff-proxy"
import { teamBillingConfig } from "@/lib/team-billing/config"
import { MAX_TEAM_SEATS, MIN_TEAM_SEATS } from "@/lib/team-billing/types"

function signupReturnPath(
  seats: number,
  api: boolean,
  publicService: boolean,
  network?: string
) {
  const query = new URLSearchParams({ seats: String(seats) })
  if (api) query.set("api", "1")
  if (publicService) query.set("service", "public")
  if (network) query.set("network", network)

  return `/staff/teams/new?${query}`
}

export default async function NewTeamPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    seats?: string
    network?: string
    api?: string
    service?: string
  }>
}) {
  const [session, query] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
  ])
  const requested = Number(query.seats ?? MIN_TEAM_SEATS)
  const initialApiAddon = query.api === "1"
  const initialPublicService = query.service === "public"
  const initialSeats =
    Number.isSafeInteger(requested) &&
    requested >= MIN_TEAM_SEATS &&
    requested <= MAX_TEAM_SEATS
      ? requested
      : MIN_TEAM_SEATS
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(signupReturnPath(initialSeats, initialApiAddon, initialPublicService, query.network))}`
    )

  if (sessionTeamsOf(session.user).length)
    redirect(
      initialApiAddon
        ? "/staff/teams/billing?api=1"
        : `/staff/teams${query.network ? `?network=${encodeURIComponent(query.network)}` : ""}`
    )

  const affiliations = query.network
    ? null
    : await fetchStaff<NetworkWorkspace>(session.user, "networks/me", "access")
  const initialNetwork =
    query.network ??
    affiliations?.body?.affiliations.find((row) => row.status === "verified")
      ?.network.documentId

  return (
    <>
      <WorkspacePageHeader
        density="task"
        title="Create your Team"
        lead="Choose annual billing, invite your colleagues and manage your subscription online."
      />
      <Container className="py-10">
        <TeamSignup
          available={teamBillingConfig().purchasing}
          verified={session.user.emailVerified}
          initialSeats={initialSeats}
          initialApiAddon={initialApiAddon}
          initialPublicService={initialPublicService}
          initialNetwork={initialNetwork}
          sandbox={teamBillingConfig().mode === "sandbox"}
          user={{ name: session.user.name, email: session.user.email }}
        />
      </Container>
    </>
  )
}
