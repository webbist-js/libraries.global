import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { TeamSignup } from "@/components/staff/TeamSignup"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import type { NetworkWorkspace } from "@/lib/networks/types"
import { fetchStaff } from "@/lib/staff-proxy"

function signupReturnPath(network?: string) {
  const query = new URLSearchParams()
  if (network) query.set("network", network)

  return `/staff/teams/new${query.size ? `?${query}` : ""}`
}

export default async function NewTeamPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ network?: string }>
}) {
  const [session, query] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
  ])
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(signupReturnPath(query.network))}`
    )

  if (sessionTeamsOf(session.user).length)
    redirect(
      `/staff/teams${query.network ? `?network=${encodeURIComponent(query.network)}` : ""}`
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
        lead="Create a free Team, add your libraries and invite your colleagues."
      />
      <Container className="py-10">
        <TeamSignup
          verified={session.user.emailVerified}
          initialNetwork={initialNetwork}
          user={{ name: session.user.name, email: session.user.email }}
        />
      </Container>
    </>
  )
}
