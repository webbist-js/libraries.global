import { headers } from "next/headers"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { NetworkWorkspace } from "@/components/networks/NetworkWorkspace"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { WidgetWorkspaceReady } from "@/components/widgets/WidgetWorkspaceReady"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"

export default async function NetworksWorkspacePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ network?: string; request?: string }>
}) {
  const session = await getSessionSSR(await headers()),
    { network, request } = await searchParams
  const query = new URLSearchParams({
    ...(network ? { network } : {}),
    ...(request ? { request } : {}),
  })
  const returnTo = `/staff/networks${query.size ? `?${query}` : ""}`
  if (!session?.user)
    return <FeatureAccessLanding feature="networks" returnTo={returnTo} />
  const team = sessionTeamsOf(session.user)[0]
  const teamId = team?.id

  return (
    <>
      <WorkspacePageHeader
        title="Services & networks"
        breadcrumb={[
          { label: "Staff area", href: "/staff" },
          { label: "Services & networks" },
        ]}
        lead="Review affiliations, request service management and follow grouped access updates."
        tabs={<StaffAreaTabs active="networks" teamId={teamId} />}
      />
      <Container className="py-10">
        <WidgetWorkspaceReady returnTo={returnTo}>
          <NetworkWorkspace
            initialNetwork={network}
            initialRequestId={request}
            teamId={team?.role === "organiser" ? teamId : null}
          />
        </WidgetWorkspaceReady>
      </Container>
    </>
  )
}
